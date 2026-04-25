import { Request, Response } from "express";
import { RowDataPacket } from "mysql2";
import * as XLSX from "xlsx";
import { getAllCupPointsConfig, getPoints } from "../config/cupPoints";
import { pool } from "../config/database";
// import removed: PlayerTournamentPointsModel больше не используется
import {
  BUTTING_MATCH_LIST_REGEXP,
  generateTeamDescription,
  GROUP_RESULTS_LIST_REGEXP,
  ManualInputTeam,
  MANUAL_INPUT_LIST,
  normalizeName,
  REGISTRATION_LIST,
  SWISS_RESULTS_LIST,
  TeamPlayers,
  TeamQualifyingResults,
  TournamentParser,
} from "../controllers/TournamentParser";
import { TeamModel } from "../models/TeamModel";
import { TournamentModel } from "../models/TournamentModel";
import { TournamentRegistrationModel } from "../models/TournamentRegistrationModel";
import { GoogleSheetsService } from "../services/GoogleSheetsService";
import {
  Cup,
  CupPosition,
  TeamResults,
  TournamentCategoryEnum,
  TournamentStatus,
  TournamentType,
} from "../types";
import ExcelUtils from "../utils/excelUtils";
import {
  buildStoredRosterFromRequestSlots,
  legacyPlayerIdsToRequestSlots,
  parseRegistrationRosterRequestSlots,
  registrationRosterHasNewPlayer,
  validateRegistrationRequestSlotsShape,
  type RegistrationRosterRequestSlot,
} from "../utils/registrationRosterUtils";

export class TournamentController {
  /**
   * Преобразование TournamentCategoryEnum в строковое представление для getCupPoints
   */
  private static convertCategoryEnumToString(
    categoryEnum: TournamentCategoryEnum
  ): "1" | "2" {
    return categoryEnum === TournamentCategoryEnum.FEDERAL ||
      categoryEnum === (TournamentCategoryEnum.FEDERAL as number)
      ? "1"
      : "2";
  }

  /**
   * Получить эффективное количество команд для расчёта очков при загрузке турнира
   * Если в этот день уже есть парный турнир (DOUBLETTE_MALE/FEMALE или TET_A_TET_MALE/FEMALE), суммируем команды
   */
  private static async getEffectiveTeamsCountForNewTournament(
    tournamentDate: string,
    tournamentType: TournamentType,
    currentTeamsCount: number
  ): Promise<number> {
    // Проверяем, является ли турнир DOUBLETTE_MALE/FEMALE или TET_A_TET_MALE/FEMALE
    const isDoublette =
      tournamentType === TournamentType.DOUBLETTE_MALE ||
      tournamentType === TournamentType.DOUBLETTE_FEMALE;

    const isTetATet =
      tournamentType === TournamentType.TET_A_TET_MALE ||
      tournamentType === TournamentType.TET_A_TET_FEMALE;

    if (!isDoublette && !isTetATet) {
      // Для других типов турниров просто возвращаем количество команд
      return currentTeamsCount;
    }

    // Определяем парный тип турнира
    let pairType: TournamentType;
    if (isDoublette) {
      pairType =
        tournamentType === TournamentType.DOUBLETTE_MALE
          ? TournamentType.DOUBLETTE_FEMALE
          : TournamentType.DOUBLETTE_MALE;
    } else {
      pairType =
        tournamentType === TournamentType.TET_A_TET_MALE
          ? TournamentType.TET_A_TET_FEMALE
          : TournamentType.TET_A_TET_MALE;
    }

    const [pairTournaments] = await pool.execute<any[]>(
      `SELECT id FROM tournaments WHERE date = ? AND type = ?`,
      [tournamentDate, pairType]
    );

    if (pairTournaments.length > 0) {
      // Найден парный турнир, суммируем команды
      const pairTournamentId = pairTournaments[0].id;
      const pairTournamentTeams = await TournamentModel.getTournamentTeamsCount(
        pairTournamentId
      );
      const totalTeams = currentTeamsCount + pairTournamentTeams;

      console.log(
        `   🔗 Найден парный турнир (${pairType}) в тот же день. Суммируем команды: ${currentTeamsCount} + ${pairTournamentTeams} = ${totalTeams}`
      );

      return totalTeams;
    }

    // Парный турнир не найден, возвращаем количество команд текущего турнира
    return currentTeamsCount;
  }

  /**
   * Обновить результаты команд данными с кубков
   * @param cup - кубок
   * @param cupTeamResults - результаты команд в кубке
   * @param teams - команды
   * @param teamResults - результаты команд с квалификационного этапа
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
        throw new Error(
          `Обработка кубка ${cup}: Отсутствуют результаты квалификационного этапа для команды #${
            teamOrderNum + 1
          }(${teams[teamOrderNum].players
            .map((player) => player.name)
            .join(", ")})`
        );
      }

      let winsModifier = 0;
      let losesModifier = 0;

      switch (cupTeamResults.size / 4) {
        // Кубок на 4 команды
        case 1:
          switch (cupPosition) {
            case CupPosition.WINNER:
              winsModifier = 2;
              losesModifier = 0;
              break;
            case CupPosition.RUNNER_UP:
              winsModifier = 1;
              losesModifier = 1;
              break;
            case CupPosition.THIRD_PLACE:
              winsModifier = 1;
              losesModifier = 1;
              break;
            case CupPosition.ROUND_OF_4:
              winsModifier = 0;
              losesModifier = 2;
              break;
          }
          break;
        // Кубок на 8 команд
        case 2:
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
            case CupPosition.ROUND_OF_4:
              winsModifier = 1;
              losesModifier = 1;
              break;
            case CupPosition.ROUND_OF_8:
              winsModifier = 0;
              losesModifier = 1;
              break;
          }
          break;
        // Кубок на 16 команд
        case 4:
          switch (cupPosition) {
            case CupPosition.WINNER:
              winsModifier = 4;
              losesModifier = 0;
              break;
            case CupPosition.RUNNER_UP:
              winsModifier = 3;
              losesModifier = 1;
              break;
            case CupPosition.THIRD_PLACE:
              winsModifier = 3;
              losesModifier = 1;
              break;
            case CupPosition.ROUND_OF_4:
              winsModifier = 2;
              losesModifier = 1;
              break;
            case CupPosition.ROUND_OF_8:
              winsModifier = 1;
              losesModifier = 1;
              break;
            case CupPosition.ROUND_OF_16:
              winsModifier = 0;
              losesModifier = 1;
              break;
          }
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

    const swissSheet = ExcelUtils.findXlsSheet(workbook, SWISS_RESULTS_LIST);
    const groupSheet = ExcelUtils.findXlsSheet(
      workbook,
      GROUP_RESULTS_LIST_REGEXP
    );

    if (!swissSheet && !groupSheet) {
      errors.push(
        `Отсутствуют листы квалификационного этапа: "${SWISS_RESULTS_LIST}" или "Группа А"`
      );
    }

    if (errors.length > 0) {
      throw new Error(`#Ошибки структуры документа:\n${errors.join("\n")}`);
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
        const positionPriority: Record<CupPosition, number> = {
          [CupPosition.WINNER]: 1,
          [CupPosition.RUNNER_UP]: 2,
          [CupPosition.THIRD_PLACE]: 3,
          [CupPosition.ROUND_OF_4]: 4,
          [CupPosition.ROUND_OF_8]: 5,
          [CupPosition.ROUND_OF_16]: 6,
        };

        // Сначала сортируем по кубку (A, затем B)
        if (a.cup !== b.cup) {
          return a.cup!.localeCompare(b.cup!);
        }

        // Затем сортируем по приоритету позиции внутри одного кубка
        const aPriority = a.cup_position
          ? positionPriority[a.cup_position] || 999
          : 999;
        const bPriority = b.cup_position
          ? positionPriority[b.cup_position] || 999
          : 999;

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

  /**
   * Публичная страница регистрации: турнир в статусе REGISTRATION + записанные команды (без авторизации).
   */
  static async getPublicTournamentRegistration(
    req: Request,
    res: Response,
  ): Promise<void> {
    const tournamentId = parseInt(req.params.id);

    if (isNaN(tournamentId)) {
      res.status(400).json({ success: false, message: "Неверный ID турнира" });
      return;
    }

    try {
      const tournament = await TournamentModel.getTournamentById(tournamentId);
      if (!tournament) {
        res.status(404).json({ success: false, message: "Турнир не найден" });
        return;
      }

      if (tournament.status !== TournamentStatus.REGISTRATION) {
        res.status(400).json({
          success: false,
          message:
            "Страница доступна только для турниров в статусе «Регистрация»",
        });
        return;
      }

      const teams =
        await TournamentRegistrationModel.listRegisteredTeamsWithPlayers(
          tournamentId,
          tournament.type as TournamentType,
          { confirmedOnly: true },
        );

      res.json({
        success: true,
        data: {
          tournament,
          teams,
        },
      });
    } catch (error) {
      console.error("Ошибка публичной страницы регистрации турнира:", error);
      res.status(500).json({
        success: false,
        message: "Внутренняя ошибка сервера",
      });
    }
  }

  /** Проверка состава команды по типу турнира (игроки уже загружены из БД). */
  private static validateTeamRegistrationRoster(
    type: TournamentType,
    players: { id: number; gender: string | null }[]
  ): string | null {
    const n = players.length;
    const ge = (i: number) => players[i]?.gender;

    switch (type) {
      case TournamentType.TRIPLETTE:
        if (n < 3 || n > 4) {
          return "В триплете укажите от 3 до 4 игроков.";
        }
        return null;
      case TournamentType.TET_A_TET_MALE:
        if (n !== 1) return "Тет-а-тет: нужен один игрок.";
        if (ge(0) !== "male") {
          return ge(0)
            ? "Нужен игрок мужского пола."
            : "У выбранного игрока не указан пол в базе.";
        }
        return null;
      case TournamentType.TET_A_TET_FEMALE:
        if (n !== 1) return "Тет-а-тет: нужен один игрок.";
        if (ge(0) !== "female") {
          return ge(0)
            ? "Нужен игрок женского пола."
            : "У выбранного игрока не указан пол в базе.";
        }
        return null;
      case TournamentType.DOUBLETTE_MALE:
        if (n !== 2) return "Дуплет: укажите двух игроков.";
        if (players.some((p) => p.gender !== "male")) {
          return "Оба игрока должны быть мужского пола (пол указан в карточке игрока).";
        }
        return null;
      case TournamentType.DOUBLETTE_FEMALE:
        if (n !== 2) return "Дуплет: укажите двух игроков.";
        if (players.some((p) => p.gender !== "female")) {
          return "Оба игрока должны быть женского пола (пол указан в карточке игрока).";
        }
        return null;
      case TournamentType.DOUBLETTE_MIXT:
        if (n !== 2) return "Дуплет микст: укажите двух игроков.";
        if (players.some((p) => !p.gender)) {
          return "У обоих игроков должен быть указан пол в базе.";
        }
        {
          const hasM = players.some((p) => p.gender === "male");
          const hasF = players.some((p) => p.gender === "female");
          if (!hasM || !hasF) {
            return "Микст: один игрок мужского и один женского пола.";
          }
        }
        return null;
      default:
        return "Неизвестный тип турнира.";
    }
  }

  /**
   * Публичная регистрация команды на турнир в статусе REGISTRATION.
   * Тело: { slots: [...] } или устаревшее { player_ids: number[] }.
   */
  static async registerPublicTeam(req: Request, res: Response): Promise<void> {
    const tournamentId = parseInt(req.params.id, 10);
    if (Number.isNaN(tournamentId)) {
      res.status(400).json({ success: false, message: "Неверный ID турнира" });
      return;
    }

    const tournament = await TournamentModel.getTournamentById(tournamentId);
    if (!tournament) {
      res.status(404).json({ success: false, message: "Турнир не найден" });
      return;
    }
    if (tournament.status !== TournamentStatus.REGISTRATION) {
      res.status(400).json({
        success: false,
        message: "Регистрация на этот турнир закрыта",
      });
      return;
    }

    const ttype = tournament.type as TournamentType;
    const body = req.body as { player_ids?: unknown; slots?: unknown };

    let requestSlots: RegistrationRosterRequestSlot[] | null =
      parseRegistrationRosterRequestSlots(body.slots);

    if (!requestSlots && Array.isArray(body.player_ids)) {
      const nums: number[] = [];
      for (const item of body.player_ids) {
        const n =
          typeof item === "number" && Number.isInteger(item)
            ? item
            : parseInt(String(item), 10);
        if (!Number.isFinite(n) || n <= 0) {
          res.status(400).json({
            success: false,
            message: "Некорректный идентификатор игрока",
          });
          return;
        }
        nums.push(n);
      }
      const playerIds = [...new Set(nums)];
      if (playerIds.length !== nums.length) {
        res.status(400).json({
          success: false,
          message: "Один игрок указан дважды",
        });
        return;
      }
      requestSlots = legacyPlayerIdsToRequestSlots(ttype, playerIds);
    }

    if (!requestSlots) {
      res.status(400).json({
        success: false,
        message: "Передайте слоты состава (slots) или массив player_ids",
      });
      return;
    }

    const shapeErr = validateRegistrationRequestSlotsShape(ttype, requestSlots);
    if (shapeErr) {
      res.status(400).json({ success: false, message: shapeErr });
      return;
    }

    const dbIdsOrdered: number[] = [];
    for (const s of requestSlots) {
      if (s.kind === "player") {
        dbIdsOrdered.push(s.player_id);
      }
    }
    const uniqueDb = [...new Set(dbIdsOrdered)];
    if (uniqueDb.length !== dbIdsOrdered.length) {
      res.status(400).json({
        success: false,
        message: "Один игрок из базы указан в составе дважды",
      });
      return;
    }

    const hasNew = requestSlots.some((s) => s.kind === "new");
    const hasFilled = requestSlots.some(
      (s) => s.kind === "player" || s.kind === "new",
    );
    if (!hasFilled) {
      res.status(400).json({
        success: false,
        message: "Укажите хотя бы одного игрока",
      });
      return;
    }

    let lockKey = "";
    let lockAcquired = false;
    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();
      lockKey = `tr_reg:${tournamentId}:${uniqueDb
        .slice()
        .sort((a, b) => a - b)
        .join(":")}${hasNew ? ":new" : ""}`.substring(0, 60);
      const [lockRows] = await connection.query<RowDataPacket[]>(
        "SELECT GET_LOCK(?, 20) AS got",
        [lockKey],
      );
      const got = (lockRows[0] as { got?: number })?.got;
      if (got !== 1) {
        await connection.rollback();
        res.status(503).json({
          success: false,
          message: "Сервер занят, повторите попытку через несколько секунд",
        });
        return;
      }
      lockAcquired = true;

      const idToName = new Map<number, string>();
      const idToGender = new Map<number, "male" | "female" | null>();

      if (uniqueDb.length > 0) {
        const [playerRows] = await connection.execute<RowDataPacket[]>(
          `SELECT id, gender, name FROM players WHERE id IN (${uniqueDb
            .map(() => "?")
            .join(",")})`,
          uniqueDb,
        );
        if (playerRows.length !== uniqueDb.length) {
          await connection.rollback();
          res.status(400).json({
            success: false,
            message: "Один или несколько игроков не найдены",
          });
          return;
        }
        for (const r of playerRows) {
          const row = r as {
            id: number;
            gender?: string | null;
            name?: string | null;
          };
          idToName.set(row.id, String(row.name ?? ""));
          const g = row.gender;
          idToGender.set(
            row.id,
            g === "male" || g === "female" ? g : null,
          );
        }

        if (!hasNew) {
          const orderedPlayers = dbIdsOrdered.map((id) => ({
            id,
            gender: idToGender.get(id) ?? null,
          }));
          const rosterError = TournamentController.validateTeamRegistrationRoster(
            ttype,
            orderedPlayers,
          );
          if (rosterError) {
            await connection.rollback();
            res.status(400).json({ success: false, message: rosterError });
            return;
          }
        }
      }

      const stored = buildStoredRosterFromRequestSlots(requestSlots, idToName);
      if (!stored) {
        await connection.rollback();
        res.status(400).json({
          success: false,
          message: "Не удалось разобрать состав команды",
        });
        return;
      }

      let teamId: number;
      if (hasNew) {
        teamId = await TeamModel.createTeam(uniqueDb, connection);
      } else {
        const team = await TeamModel.findExistingTeam(uniqueDb, connection);
        teamId = team
          ? team.id
          : await TeamModel.createTeam(uniqueDb, connection);
      }

      const rosterForDb = registrationRosterHasNewPlayer(stored)
        ? stored
        : null;

      const already = await TournamentRegistrationModel.isTeamRegistered(
        tournamentId,
        teamId,
        connection,
      );
      if (already) {
        await connection.rollback();
        res.status(409).json({
          success: false,
          message: "Эта команда уже зарегистрирована на турнир",
        });
        return;
      }

      await TournamentRegistrationModel.addRegistration(
        tournamentId,
        teamId,
        connection,
        rosterForDb,
      );
      await connection.commit();
      res.json({ success: true, message: "Команда успешно зарегистрирована" });
    } catch (error) {
      await connection.rollback();
      console.error("Ошибка публичной регистрации команды:", error);
      res.status(500).json({
        success: false,
        message: "Внутренняя ошибка сервера",
      });
    } finally {
      if (lockAcquired && lockKey) {
        try {
          await connection.query("SELECT RELEASE_LOCK(?)", [lockKey]);
        } catch (e) {
          console.error("RELEASE_LOCK:", e);
        }
      }
      connection.release();
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
    tournamentType: TournamentType,
    tournamentCategory: TournamentCategoryEnum,
    providedWorkbook?: XLSX.WorkBook
  ): Promise<{
    tournamentId: number;
    teamsCount: number;
    resultsCount: number;
  }> {
    console.log(`🚀 Начинается парсинг файла: "${fileName}"`);

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

      // 1. Проверяем наличие листа "Ручной ввод"
      const manualInputSheet = ExcelUtils.findXlsSheet(
        workbook,
        MANUAL_INPUT_LIST
      );

      let teams: TeamPlayers[];
      let teamResults: Map<number, TeamResults>;
      let isManualInput = false; // Флаг для определения режима ручного ввода

      if (manualInputSheet) {
        // ====== РЕЖИМ: Ручной ввод ======
        isManualInput = true;
        console.log(
          `📝 Обнаружен лист "${MANUAL_INPUT_LIST}" - используем режим ручного ввода`
        );

        // Парсим лист с ручным вводом
        const manualInputTeams: ManualInputTeam[] =
          await TournamentParser.parseManualInputSheet(workbook);

        // Создаем результаты из данных ручного ввода
        teamResults = new Map<number, TeamResults>();
        for (const team of manualInputTeams) {
          // Преобразуем строковые значения в нужные типы
          const cup = team.cup as Cup | undefined;
          const cupPosition = team.position as CupPosition | undefined;

          teamResults.set(team.orderNum, {
            cup: cup,
            cupPosition: cupPosition,
            qualifyingWins: 0,
            wins: 0,
            loses: 0,
            points: team.points,
          });
        }

        // Конвертируем ManualInputTeam[] в TeamPlayers[] для дальнейшего использования
        teams = manualInputTeams.map((t) => ({
          orderNum: t.orderNum,
          players: t.players,
        }));

        console.log(
          `✓ Режим ручного ввода: обработано ${teams.length} команд(ы)`
        );
      } else {
        // ====== РЕЖИМ: Стандартный парсинг ======
        console.log(`📋 Используем стандартный режим парсинга турнира`);

        // Проверка наличия обязательных листов
        this.validateDocumentStructure(workbook);
        console.log("✓ Структура файла корректна");

        // 2. Парсинг данных c листов
        // Сбор данных о командах
        teams = await TournamentParser.parseTeamsFromRegistrationSheet(
          workbook
        );

        // 3. Сбор данных об играх квалификационного этапа

        const teamQualifyingResults =
          await TournamentParser.parseQualifyingResults(workbook, teams);

        const abButtingMatchResults =
          await TournamentParser.parseABButtingMatchResults(workbook, teams);

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
        teamResults = new Map<number, TeamResults>(); // key = teamOrderNum

        // Привязка результатов квалификационного этапа - команде
        for (const [teamOrderNum, qualifyingResults] of teamQualifyingResults) {
          teamResults.set(teamOrderNum, {
            qualifyingWins: qualifyingResults.wins,
            wins: qualifyingResults.wins,
            loses: qualifyingResults.loses,
          });
        }

        // Привязка результатов стыковочных игр - команде
        for (const [teamOrderNum, result] of abButtingMatchResults) {
          let curTeamResults = teamResults.get(teamOrderNum);
          if (!curTeamResults) {
            throw new Error(
              `Обработка стыковочных игр: Отсутствуют результаты квалификационного этапа для команды #${generateTeamDescription(
                teams[teamOrderNum]
              )}`
            );
          }
          if (result) curTeamResults.wins++;
          else {
            curTeamResults.loses++;
          }
          teamResults.set(teamOrderNum, curTeamResults);
        }

        // Привязка результатов кубков - команде
        // Кубок А
        await this.modifyTeamResultsWithCupResults(
          "A",
          aCupTeamsResults,
          teams,
          teamResults
        );

        if (bCupTeamsResults) {
          await this.modifyTeamResultsWithCupResults(
            "B",
            bCupTeamsResults,
            teams,
            teamResults
          );
        }

        if (cCupTeamsResults) {
          await this.modifyTeamResultsWithCupResults(
            "C",
            cCupTeamsResults,
            teams,
            teamResults
          );
        }
      }

      // 5. Сохраняем данные в БД (в транзакции)
      const connection = await pool.getConnection();
      let tournamentId: number;

      try {
        await connection.beginTransaction();
        console.log("🔄 Начата транзакция сохранения турнира");

        tournamentId = await TournamentModel.createTournament(
          tournamentName,
          tournamentType,
          tournamentCategory,
          tournamentDate,
          isManualInput,
          connection
        );

        // Рассчитываем эффективное количество команд (с учётом парных турниров в один день)
        const effectiveTeamsCount =
          await TournamentController.getEffectiveTeamsCountForNewTournament(
            tournamentDate,
            tournamentType,
            teams.length
          );

        console.log(
          `📊 Эффективное количество команд для расчёта очков: ${effectiveTeamsCount}`
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
          const foundedTeam = await TeamModel.findExistingTeam(
            teamPlayers,
            connection
          );
          if (!foundedTeam) {
            teamId = await TeamModel.createTeam(teamPlayers, connection);
          } else {
            teamId = foundedTeam?.id;
          }

          const results = teamResults.get(team.orderNum);
          if (!results) {
            console.log(
              `Не найдены результаты для команды #${generateTeamDescription(
                team
              )}`
            );
            throw new Error("Не может такого быть ))");
          }

          // Рассчитываем количество рейтинговых очков
          // Для режима ручного ввода используем points из данных, для стандартного режима - рассчитываем
          const points =
            results.points !== undefined
              ? results.points
              : getPoints(
                tournamentType,
                  tournamentCategory,
                  results.cup,
                  results.cupPosition,
                  effectiveTeamsCount,
                  results.qualifyingWins,
                  team.players.length
                );

          // Записываем результат команды в БД
          await TournamentModel.addTournamentResult(
            tournamentId,
            teamId,
            results.wins,
            results.loses,
            results.cupPosition,
            results.cup,
            results.qualifyingWins!,
            points,
            connection
          );
        }

        await connection.commit();
        console.log("✅ Транзакция успешно завершена");

        // Если это DOUBLETTE или TET-A-TET турнир и найден парный турнир, нужно пересчитать его очки
        const isDoublette =
          tournamentType === TournamentType.DOUBLETTE_MALE ||
          tournamentType === TournamentType.DOUBLETTE_FEMALE;

        const isTetATet =
          tournamentType === TournamentType.TET_A_TET_MALE ||
          tournamentType === TournamentType.TET_A_TET_FEMALE;

        if ((isDoublette || isTetATet) && effectiveTeamsCount > teams.length) {
          console.log(
            "🔄 Пересчитываем очки для парного турнира с учётом нового турнира..."
          );

          // Находим парный турнир
          let pairType: TournamentType;
          if (isDoublette) {
            pairType =
              tournamentType === TournamentType.DOUBLETTE_MALE
                ? TournamentType.DOUBLETTE_FEMALE
                : TournamentType.DOUBLETTE_MALE;
          } else {
            pairType =
              tournamentType === TournamentType.TET_A_TET_MALE
                ? TournamentType.TET_A_TET_FEMALE
                : TournamentType.TET_A_TET_MALE;
          }

          const [pairTournaments] = await pool.execute<any[]>(
            `SELECT id FROM tournaments WHERE date = ? AND type = ? AND id != ?`,
            [tournamentDate, pairType, tournamentId]
          );

          if (pairTournaments.length > 0) {
            const pairTournamentId = pairTournaments[0].id;
            // Используем централизованную функцию пересчёта
            await TournamentModel.recalculateTournamentPoints(pairTournamentId);
          }
        }
      } catch (error) {
        await connection.rollback();
        console.error(
          "❌ Ошибка при сохранении турнира, транзакция отменена:",
          error
        );
        throw error;
      } finally {
        connection.release();
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

  // ========== МЕТОДЫ ДЛЯ РАБОТЫ С GOOGLE SHEETS ==========

  /**
   * Загрузка и парсинг турнира из Google Sheets
   */
  static async parseTournamentFromGoogleSheets(
    googleSheetsUrl: string,
    tournamentName: string,
    tournamentDate: string,
    tournamentType: TournamentType,
    tournamentCategory: TournamentCategoryEnum
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
        tournamentType,
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

export default TournamentController;
