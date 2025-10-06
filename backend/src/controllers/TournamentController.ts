import { Request, Response } from "express";
import * as XLSX from "xlsx";
import {
  getAllCupPointsConfig,
  getCupPoints,
  getPointsByQualifyingStage,
  getPointsExample,
} from "../config/cupPoints";
// import removed: PlayerTournamentPointsModel больше не используется
import {
  normalizeName,
  REGISTRATION_LIST,
  SWISS_RESULTS_LIST,
  TeamPlayers,
  TeamQualifyingResults,
  TournamentParser,
} from "../controllers/TournamentParser";
import { TeamModel } from "../models/TeamModel";
import { TournamentModel } from "../models/TournamentModel";
import { GoogleSheetsService } from "../services/GoogleSheetsService";
import { Cup, CupPosition, TeamResults } from "../types";
import ExcelUtils from "../utils/excelUtils";

export class TournamentController {
  private static readonly quarterFinalsPlayersCells = [
    "B4",
    "B8",
    "B12",
    "B16",
    "B20",
    "B24",
    "B28",
    "B32",
  ];
  private static readonly semiFinalsPlayersCells = ["F6", "F14", "F22", "F30"];
  private static readonly finalsPlayersCells = ["J10", "J26"];
  private static readonly thirdPlacePlayersCells = ["F38"];

  // Сопоставление строковых позиций из Excel с enum CupPosition
  static mapExcelPositionToCupPosition(excelPosition: string): CupPosition {
    switch (excelPosition.trim()) {
      case "1":
        return CupPosition.WINNER;
      case "2":
        return CupPosition.RUNNER_UP;
      case "3":
        return CupPosition.THIRD_PLACE;
      case "1/2":
        return CupPosition.SEMI_FINAL;
      case "1/4":
        return CupPosition.QUARTER_FINAL;
      default:
        console.warn(
          `Неизвестная позиция из Excel: "${excelPosition}", используем QUARTER_FINAL по умолчанию`
        );
        return CupPosition.QUARTER_FINAL;
    }
  }

  /**
   * Обновить результаты команд данными с кубков
   * @param cup
   * @param cupTeamResults
   * @param teams
   * @param teamResults
   */
  static async modifyTeamResultsWithCupResults(
    cup: Cup,
    cupTeamResults: Map<number, CupPosition>,
    teams: TeamPlayers[],
    teamResults: Map<number, TeamResults>
  ) {
    for (const [teamOrderNum, cupPosition] of cupTeamResults) {
      const curTeamResults = teamResults.get(teamOrderNum);

      if (!curTeamResults) {
        throw new Error(`Отсутствует запись для команды #${teamOrderNum}`);
      }

      let winsModifier = 0;
      let losesModifier = 0;

      switch (cupPosition) {
        case CupPosition.WINNER:
          winsModifier = 3;
          losesModifier = 0;
          break;
        case CupPosition.RUNNER_UP:
          winsModifier = 2;
          losesModifier = 1;
          break;
        case CupPosition.THIRD_PLACE:
          winsModifier = 2;
          losesModifier = 1;
          break;
        case CupPosition.SEMI_FINAL:
          winsModifier = 1;
          losesModifier = 1;
          break;
        case CupPosition.QUARTER_FINAL:
          winsModifier = 0;
          losesModifier = 1;
          break;
      }

      teamResults.set(teamOrderNum, {
        cup,
        cupPosition,
        qualifyingWins: curTeamResults.wins,
        wins: curTeamResults.wins + winsModifier,
        loses: curTeamResults.loses + losesModifier,
      });
    }
  }

  // Валидация критических ошибок перед парсингом
  static validateDocumentStructure(workbook: XLSX.WorkBook) {
    console.log("🔍 Выполняется валидация обязательных листов документа");
    const errors: string[] = [];

    if (!ExcelUtils.findXlsSheet(workbook, REGISTRATION_LIST)) {
      errors.push(`Отсутствует обязательный лист регистрации.`);
    }

    if (!ExcelUtils.findXlsSheet(workbook, /^кубок [aа]$/)) {
      errors.push(`Отсутствует обязательный лист 'Кубок А'`);
    }

    if (!ExcelUtils.findXlsSheet(workbook, /^кубок [bб]$/)) {
      errors.push(`Отсутствует обязательный лист 'Кубок Б'`);
    }

    const swissSheet = ExcelUtils.findXlsSheet(workbook, SWISS_RESULTS_LIST);
    const groupSheet = ExcelUtils.findXlsSheet(workbook, /Группа \w+/);

    if (!swissSheet && !groupSheet) {
      errors.push(
        `Отсутствуют листы квалификационного этапа: "${SWISS_RESULTS_LIST}" или "Группа А"`
      );
    }

    if (errors.length > 0) {
      throw new Error(errors.join("\n"));
    }
  }

  // Получить список всех турниров (публичный доступ)
  static async getAllTournaments(req: Request, res: Response) {
    try {
      const tournaments = await TournamentModel.getAllTournaments();
      res.json({ success: true, data: tournaments });
    } catch (error) {
      console.error("Ошибка при получении списка турниров:", error);
      res
        .status(500)
        .json({ success: false, message: "Внутренняя ошибка сервера" });
    }
  }

  // Получить турнир с результатами (публичный доступ)
  static async getTournamentDetails(req: Request, res: Response) {
    const tournamentId = parseInt(req.params.id);

    if (isNaN(tournamentId)) {
      return res
        .status(400)
        .json({ success: false, message: "Неверный ID турнира" });
    }

    try {
      const tournament = await TournamentModel.getTournamentById(tournamentId);

      if (!tournament) {
        return res
          .status(404)
          .json({ success: false, message: "Турнир не найден" });
      }

      const results = await TournamentModel.getTournamentResults(tournamentId);

      // Применяем фильтрацию по кубкам
      const filteredResults = results.filter((result) => result.cup);

      const sortedResults = filteredResults.sort((a, b) => {
        // Порядок позиций по приоритету (лучшие позиции первыми)
        const positionPriority: Record<string, number> = {
          WINNER: 1,
          "1": 1, // тоже победитель
          RUNNER_UP: 2,
          "2": 2, // тоже второе место
          THIRD_PLACE: 3,
          "3": 3, // тоже третье место
          SEMI_FINAL: 4,
          "1/2": 4, // полуфинал
          QUARTER_FINAL: 5,
          "1/4": 5, // четвертьфинал
        };

        // Сначала сортируем по кубку (A, затем B)
        if (a.cup !== b.cup) {
          return a.cup!.localeCompare(b.cup!);
        }

        // Затем сортируем по приоритету позиции внутри одного кубка
        const aPriority = positionPriority[a.cup_position] || 999;
        const bPriority = positionPriority[b.cup_position] || 999;

        return aPriority - bPriority;
      });

      res.json({
        success: true,
        data: {
          ...tournament,
          results: sortedResults,
        },
      });
    } catch (error) {
      console.error(
        `Ошибка при получении деталей турнира ${tournamentId}:`,
        error
      );
      res
        .status(500)
        .json({ success: false, message: "Внутренняя ошибка сервера" });
    }
  }

  // Получить статистику турниров (публичный доступ)
  static async getTournamentsStats(req: Request, res: Response) {
    try {
      const tournaments = await TournamentModel.getAllTournaments();

      const stats = {
        totalTournaments: tournaments.length,
        recentTournaments: tournaments
          .sort(
            (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
          )
          .slice(0, 5),
        tournamentsThisYear: tournaments.filter(
          (t) => new Date(t.date).getFullYear() === new Date().getFullYear()
        ).length,
      };

      res.json({ success: true, data: stats });
    } catch (error) {
      console.error("Ошибка при получении статистики турниров:", error);
      res
        .status(500)
        .json({ success: false, message: "Внутренняя ошибка сервера" });
    }
  }

  // ========== МЕТОДЫ ДЛЯ РАБОТЫ С КУБКАМИ ==========

  // Получить все результаты кубков (публичный доступ)
  static async getAllCupResults(req: Request, res: Response) {
    try {
      const results = await TournamentModel.getCupResults();
      res.json({ success: true, data: results });
    } catch (error) {
      console.error("Ошибка при получении результатов кубков:", error);
      res.status(500).json({
        success: false,
        message: "Внутренняя ошибка сервера",
      });
    }
  }

  // Получить результаты кубков для турнира (публичный доступ)
  static async getCupResultsByTournament(req: Request, res: Response) {
    const tournamentId = parseInt(req.params.id);

    if (isNaN(tournamentId)) {
      return res.status(400).json({
        success: false,
        message: "Неверный ID турнира",
      });
    }

    try {
      const results = await TournamentModel.getCupResultsByTournament(
        tournamentId
      );
      res.json({ success: true, data: results });
    } catch (error) {
      console.error("Ошибка при получении результатов кубков турнира:", error);
      res.status(500).json({
        success: false,
        message: "Внутренняя ошибка сервера",
      });
    }
  }

  // Получить результаты конкретного кубка в турнире (публичный доступ)
  static async getCupResultsByCup(req: Request, res: Response) {
    const tournamentId = parseInt(req.params.id);
    const cup = req.params.cup;

    if (isNaN(tournamentId)) {
      return res.status(400).json({
        success: false,
        message: "Неверный ID турнира",
      });
    }

    if (!cup) {
      return res.status(400).json({
        success: false,
        message: "Название кубка не указано",
      });
    }

    try {
      const results = await TournamentModel.getCupResultsByCup(
        tournamentId,
        cup
      );
      res.json({ success: true, data: results });
    } catch (error) {
      console.error("Ошибка при получении результатов кубка:", error);
      res.status(500).json({
        success: false,
        message: "Внутренняя ошибка сервера",
      });
    }
  }

  // ################################################################
  // Парсинг данных турнира
  // ################################################################
  static async parseTournamentData(
    fileBuffer: Buffer,
    fileName: string,
    tournamentName: string,
    tournamentDate: string,
    tournamentCategory: "1" | "2",
    providedWorkbook?: XLSX.WorkBook
  ): Promise<{
    tournamentId: number;
    teamsCount: number;
    resultsCount: number;
  }> {
    console.log(
      `🚀 Начинается парсинг файла турнира без транзакции: "${fileName}"`
    );

    // Убираем большую транзакцию для предотвращения блокировок
    // Используем отдельные соединения для разных операций

    try {
      console.log(
        `Начинается парсинг файла турнира с валидацией: "${fileName}"`
      );

      // Парсим XLSX файл или используем предоставленный workbook
      let workbook: XLSX.WorkBook;
      try {
        if (providedWorkbook) {
          workbook = providedWorkbook;
          console.log(
            `Использован предоставленный workbook (Google Sheets). Доступные листы: ${workbook.SheetNames.join(
              ", "
            )}`
          );
        } else {
          workbook = XLSX.read(fileBuffer, { type: "buffer" });
          console.log(
            `Доступные листы в файле: ${workbook.SheetNames.join(", ")}`
          );
        }
      } catch (error) {
        throw new Error(
          `Ошибка при чтении Excel файла "${fileName}": ${
            (error as Error).message
          }`
        );
      }

      // 1. Проверка наличия обязательных листов
      this.validateDocumentStructure(workbook);
      console.log("✓ Структура файла корректна");

      // 2. Парсинг данных c листов
      // Сбор данных о командах
      const teams = await TournamentParser.parseTeamsFromRegistrationSheet(
        workbook
      );

      // 3. Сбор данных об играх квалификационного этапа
      let teamQualifyingResults = new Map<number, TeamQualifyingResults>();

      const swissSheet = ExcelUtils.findXlsSheet(
        workbook,
        normalizeName(SWISS_RESULTS_LIST)
      );
      const groupSheet = ExcelUtils.findXlsSheet(workbook, /Группа \w+/);

      // Либо находим результаты Швейцарки, либо групп
      if (swissSheet) {
        teamQualifyingResults = await TournamentParser.parseSwissSystemResults(
          workbook,
          teams
        );
      } else if (groupSheet) {
        teamQualifyingResults = await TournamentParser.parseGroupResults(
          workbook,
          teams
        );
      }

      console.log(`### Определены результаты квалификационного этапа`);
      for (const [teamOrderNum, results] of teamQualifyingResults) {
        console.log(
          `Team #${teamOrderNum} : ${JSON.stringify(results, null, 0)}`
        );
      }

      const aCupTeamsResults = await TournamentParser.parseCupResults(
        workbook,
        "A",
        teams
      );
      const bCupTeamsResults = await TournamentParser.parseCupResults(
        workbook,
        "B",
        teams
      );
      const cCupTeamsResults = await TournamentParser.parseCupResults(
        workbook,
        "C",
        teams
      );

      // 4. Объединяем все результаты команд вместе
      const orderedTeamResults: Map<number, TeamResults> = new Map(); // key = teamOrderNum
      for (const [teamOrderNum, qualifyingResults] of teamQualifyingResults) {
        orderedTeamResults.set(teamOrderNum, {
          qualifyingWins: qualifyingResults.wins,
          wins: qualifyingResults.wins,
          loses: qualifyingResults.loses,
        });
      }

      // Привзяка результатов кубков - команде
      // Кубок А
      await this.modifyTeamResultsWithCupResults(
        "A",
        aCupTeamsResults,
        teams,
        orderedTeamResults
      );

      if (bCupTeamsResults) {
        await this.modifyTeamResultsWithCupResults(
          "B",
          bCupTeamsResults,
          teams,
          orderedTeamResults
        );
      }

      if (cCupTeamsResults) {
        await this.modifyTeamResultsWithCupResults(
          "C",
          cCupTeamsResults,
          teams,
          orderedTeamResults
        );
      }

      // Сохраняем данные

      const teamResults: Map<number, TeamResults> = new Map(); // key = teamId

      const tournamentId = await TournamentModel.createTournament(
        tournamentName,
        tournamentDate
      );

      for (const team of teams) {
        const teamPlayers: number[] = [];
        const teamPlayerNames: string[] = [];
        for (const player of team.players) {
          teamPlayers.push(player.id);
          teamPlayerNames.push(player.name);
        }

        // Находим существующую команду, или создаём новую
        let teamId;
        const foundedTeam = await TeamModel.findExistingTeam(teamPlayers);
        if (!foundedTeam) {
          teamId = await TeamModel.createTeam(teamPlayers);
        } else {
          teamId = foundedTeam?.id;
        }

        const results = orderedTeamResults.get(team.orderNum);
        if (!results) {
          throw new Error();
        }

        // Рассчитываем количество рейтинговых очков
        let points = 0;
        if (results.cup) {
          points = getCupPoints(
            tournamentCategory,
            results.cup!,
            results.cupPosition!,
            teams.length
          );
        } else {
          points = getPointsByQualifyingStage(
            tournamentCategory,
            results.qualifyingWins!
          );
        }

        // Записываем результат команды в БД
        TournamentModel.addTournamentResult(
          tournamentId,
          teamId,
          results.wins,
          results.loses,
          results.cupPosition,
          results.cup,
          results.qualifyingWins!,
          points
        );
      }

      console.log(
        `✅ Парсинг завершен успешно: турнир ID ${tournamentId}, команд - ${teams.length}`
      );

      return {
        tournamentId,
        teamsCount: teams.length,
        resultsCount: 0, //TODO: избавиться
      };
    } catch (error) {
      console.error(
        `❌ Критическая ошибка при парсинге файла турнира "${fileName}":`,
        error
      );

      // ВАЖНО: При любой ошибке НЕ сохраняем турнир
      // Просто пробрасываем ошибку дальше - турнир либо не был создан,
      // либо уже удалён в блоке try-catch выше

      throw new Error((error as Error).message);
    }
  }

  // Диагностика структуры Excel файла
  static analyzeExcelFileStructure(fileBuffer: Buffer, fileName: string) {
    try {
      const workbook = XLSX.read(fileBuffer, { type: "buffer" });

      const analysis: {
        fileName: string;
        totalSheets: number;
        sheets: Array<{
          name: string;
          rowCount: number;
          columnCount: number;
          isEmpty: boolean;
          firstRowSample: unknown;
        }>;
        registrationSheetFound: boolean;
        cupSheetsFound: string[];
        recommendations: string[];
      } = {
        fileName: fileName,
        totalSheets: workbook.SheetNames.length,
        sheets: [],
        registrationSheetFound: false,
        cupSheetsFound: [],
        recommendations: [],
      };

      // Анализируем каждый лист
      workbook.SheetNames.forEach((sheetName, index) => {
        const sheet = workbook.Sheets[sheetName];
        const jsonData = XLSX.utils.sheet_to_json(sheet, { header: 1 });

        const sheetInfo = {
          name: sheetName,
          rowCount: jsonData.length,
          columnCount:
            jsonData.length > 0
              ? Math.max(...jsonData.map((row) => (row as any[]).length))
              : 0,
          isEmpty: jsonData.length === 0,
          firstRowSample: jsonData.length > 0 ? jsonData[0] : null,
        };

        analysis.sheets.push(sheetInfo);

        // Проверяем, подходит ли для листа регистрации
        const registrationSheetNames = [
          "лист регистрации",
          "лист регистрации",
          "регистрация",
          "registration",
          "sheet1",
          "команды",
          "teams",
        ];

        if (
          registrationSheetNames.some((name) =>
            sheetName.toLowerCase().includes(name.toLowerCase())
          )
        ) {
          analysis.registrationSheetFound = true;
        }

        // Проверяем листы кубков
        if (
          sheetName.toLowerCase().includes("кубок") ||
          sheetName.toLowerCase().includes("cup")
        ) {
          analysis.cupSheetsFound.push(sheetName);
        }
      });

      // Генерируем рекомендации
      if (!analysis.registrationSheetFound) {
        analysis.recommendations.push(
          "Не найден лист регистрации. Создайте лист с названием 'Лист регистрации' или переименуйте существующий лист."
        );
      }

      if (analysis.cupSheetsFound.length === 0) {
        analysis.recommendations.push(
          "Не найдены листы кубков. Создайте листы с названиями 'Кубок А' и 'Кубок Б' для результатов турнира."
        );
      }

      return analysis;
    } catch (error) {
      throw new Error(`Ошибка анализа файла: ${(error as Error).message}`);
    }
  }

  // Endpoint для диагностики файла турнира
  static async diagnoseFile(req: Request, res: Response) {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: "Файл не загружен",
      });
    }

    try {
      const analysis = this.analyzeExcelFileStructure(
        req.file.buffer,
        req.file.originalname
      );

      res.json({
        success: true,
        message: "Анализ файла завершен",
        data: analysis,
      });
    } catch (error) {
      console.error("Ошибка диагностики файла:", error);
      res.status(500).json({
        success: false,
        message: "Ошибка при анализе файла: " + (error as Error).message,
      });
    }
  }

  // Удалить результат турнира/кубка (только админ)
  static async deleteTournamentResult(req: Request, res: Response) {
    const resultId = parseInt(req.params.resultId);

    if (isNaN(resultId)) {
      return res.status(400).json({
        success: false,
        message: "Неверный ID результата",
      });
    }

    try {
      const success = await TournamentModel.deleteTournamentResult(resultId);

      if (!success) {
        return res.status(404).json({
          success: false,
          message: "Результат не найден",
        });
      }

      res.json({
        success: true,
        message: "Результат успешно удален",
      });
    } catch (error) {
      console.error("Ошибка при удалении результата:", error);
      res.status(500).json({
        success: false,
        message: "Внутренняя ошибка сервера",
      });
    }
  }

  // Получить конфигурацию очков за кубки (публичный доступ)
  static async getCupPointsConfig(req: Request, res: Response) {
    try {
      const config = getAllCupPointsConfig();
      res.json({
        success: true,
        data: config,
        description:
          "Конфигурация очков за позиции в кубках в зависимости от количества участников",
      });
    } catch (error) {
      console.error("Ошибка при получении конфигурации очков кубка:", error);
      res.status(500).json({
        success: false,
        message: "Внутренняя ошибка сервера",
      });
    }
  }

  // Получить примеры расчета очков (публичный доступ)
  static async getCupPointsExamples(req: Request, res: Response) {
    try {
      const examples = getPointsExample();
      res.json({
        success: true,
        data: examples,
      });
    } catch (error) {
      console.error("Ошибка при получении примеров очков кубка:", error);
      res.status(500).json({
        success: false,
        message: "Внутренняя ошибка сервера",
      });
    }
  }

  // ========== МЕТОДЫ ДЛЯ РАБОТЫ С GOOGLE SHEETS ==========

  /**
   * Загрузка и парсинг турнира из Google Sheets
   */
  static async parseTournamentFromGoogleSheets(
    googleSheetsUrl: string,
    tournamentName: string,
    tournamentDate: string,
    tournamentCategory: "1" | "2"
  ): Promise<{
    tournamentId: number;
    teamsCount: number;
    resultsCount: number;
  }> {
    console.log(
      `🔗 Начинается загрузка турнира из Google Sheets: ${googleSheetsUrl}`
    );

    try {
      // Проверяем доступность таблицы
      const accessCheck = await GoogleSheetsService.checkTableAccess(
        googleSheetsUrl
      );

      if (!accessCheck.accessible) {
        throw new Error(`Google таблица недоступна: ${accessCheck.error}`);
      }

      console.log(
        `✓ Google таблица доступна. Найдены листы: ${accessCheck.sheetNames.join(
          ", "
        )}`
      );

      // Получаем данные в формате workbook
      const { workbook, fileName } =
        await GoogleSheetsService.getTournamentDataAsBuffer(googleSheetsUrl);

      // Используем существующую логику парсинга
      return await this.parseTournamentData(
        Buffer.alloc(0), // Пустой buffer, так как мы используем workbook напрямую
        fileName,
        tournamentName,
        tournamentDate,
        tournamentCategory,
        workbook // Передаем готовый workbook
      );
    } catch (error) {
      console.error("Ошибка при загрузке турнира из Google Sheets:", error);
      throw new Error((error as Error).message);
    }
  }

  /**
   * Тестирование Google Sheets API ключа
   */
  static async testGoogleSheetsApiKey(req: Request, res: Response) {
    try {
      // Тестовая таблица Google (публичная)
      const testSpreadsheetId = "1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms";

      console.log("🧪 Тестирование Google Sheets API ключа...");

      // Вызываем диагностику
      GoogleSheetsService.debugApiKey();

      // Пробуем получить имена листов из тестовой таблицы
      const sheetNames = await GoogleSheetsService.getSheetNames(
        testSpreadsheetId
      );

      res.json({
        success: true,
        message: "Google Sheets API ключ работает корректно!",
        data: {
          testSpreadsheetId,
          sheetNames,
          totalSheets: sheetNames.length,
        },
      });
    } catch (error) {
      console.error("❌ Ошибка при тестировании Google Sheets API:", error);

      res.status(500).json({
        success: false,
        message: `Ошибка Google Sheets API: ${(error as Error).message}`,
        details: {
          error: (error as Error).message,
          stack: (error as Error).stack,
        },
      });
    }
  }

  /**
   * Проверка доступности Google таблицы (endpoint для фронтенда)
   */
  static async checkGoogleSheetsAccess(req: Request, res: Response) {
    try {
      const { url } = req.body;

      if (!url) {
        return res.status(400).json({
          success: false,
          message: "URL Google таблицы обязателен",
        });
      }

      console.log(`🔍 Проверяем доступность Google таблицы: ${url}`);

      const result = await GoogleSheetsService.checkTableAccess(url);

      if (!result.accessible) {
        return res.status(400).json({
          success: false,
          message: result.error || "Google таблица недоступна",
        });
      }

      res.json({
        success: true,
        message: "Google таблица доступна для чтения",
        data: {
          spreadsheetId: result.spreadsheetId,
          sheetNames: result.sheetNames,
          totalSheets: result.sheetNames.length,
        },
      });
    } catch (error) {
      console.error("Ошибка при проверке Google таблицы:", error);
      res.status(500).json({
        success: false,
        message: `Ошибка при проверке Google таблицы: ${
          (error as Error).message
        }`,
      });
    }
  }
}

// CREATE TABLE `tournament_results` (
//   `id` int NOT NULL AUTO_INCREMENT,
//   `tournament_id` int NOT NULL,
//   `team_id` int NOT NULL,
//   `cup` enum('A','B') DEFAULT NULL,
//   `qualifying_wins` int DEFAULT '0',
//   `points` int NOT NULL DEFAULT '0',
//   `wins` int DEFAULT '0',
//   `loses` int DEFAULT '0',
//   `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
//   `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
//   `cup_position` enum('CUP_WINNER','CUP_RUNNER_UP','CUP_THIRD_PLACE','CUP_SEMI_FINAL','CUP_QUARTER_FINAL','QUALIFYING_HIGH','QUALIFYING_LOW') NOT NULL,
//   PRIMARY KEY (`id`),
//   KEY `team_id` (`team_id`),
//   KEY `idx_tournament_team` (`tournament_id`,`team_id`),
//   KEY `idx_tournament_cup` (`tournament_id`,`cup`),
//   KEY `idx_qualifying_wins` (`qualifying_wins`),
//   KEY `idx_wins` (`wins`),
//   KEY `idx_loses` (`loses`),
//   CONSTRAINT `tournament_results_ibfk_1` FOREIGN KEY (`tournament_id`) REFERENCES `tournaments` (`id`) ON DELETE CASCADE,
//   CONSTRAINT `tournament_results_ibfk_2` FOREIGN KEY (`team_id`) REFERENCES `teams` (`id`) ON DELETE CASCADE
// ) ENGINE=InnoDB AUTO_INCREMENT=777 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci

export default TournamentController;
