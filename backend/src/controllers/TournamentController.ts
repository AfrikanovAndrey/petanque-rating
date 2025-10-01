import { Request, Response } from "express";
import * as XLSX from "xlsx";
import {
  getAllCupPointsConfig,
  getPointsExample,
  getCupPoints,
  getWinsPoints,
} from "../config/cupPoints";
import { pool } from "../config/database";
import { PlayerModel } from "../models/PlayerModel";
import { TeamModel } from "../models/TeamModel";
import { TournamentModel } from "../models/TournamentModel";
import { GoogleSheetsService } from "../services/GoogleSheetsService";
import {
  CupPosition,
  CupTeamResult,
  StageInfo,
  Team,
  TournamentUploadData,
  PointsReason,
} from "../types";
import { PlayerTournamentPointsModel } from "../models/PlayerTournamentPointsModel";

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

  // Нормализация имени игрока для сравнения
  static normalizePlayerName(name: string): string {
    return name
      .toLowerCase()
      .replace(/\s+/g, " ") // заменяем множественные пробелы на одинарные
      .replace(/[-.]/g, " ") // заменяем дефисы и точки на пробелы
      .trim();
  }

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

  // Проверка совпадения имен игроков с учетом различий в написании
  static findPlayerMatch(
    playerName: string,
    registeredPlayersNormalizedSet: Set<string>,
    registeredPlayersArray: string[]
  ): {
    found: boolean;
    exactMatch?: string;
    suggestion?: string;
    ambiguous?: boolean;
  } {
    const normalizedPlayerName = this.normalizePlayerName(playerName);

    // 1. Быстрая проверка точного совпадения через Set (O(1))
    if (registeredPlayersNormalizedSet.has(normalizedPlayerName)) {
      // Находим оригинальное написание в массиве
      const exactMatch = registeredPlayersArray.find(
        (player) => this.normalizePlayerName(player) === normalizedPlayerName
      );
      return { found: true, exactMatch: exactMatch || playerName };
    }

    // 2. Если точного совпадения нет, ищем частичные совпадения
    const playerWords = normalizedPlayerName
      .split(" ")
      .filter((word) => word.length > 0);

    // Список найденных частичных совпадений для ранжирования
    const partialMatches: Array<{
      player: string;
      score: number;
      type: string;
    }> = [];

    for (const registeredPlayer of registeredPlayersArray) {
      const registeredWords = this.normalizePlayerName(registeredPlayer)
        .split(" ")
        .filter((word) => word.length > 0);

      // Проверяем совпадение по фамилии (первое слово)
      if (playerWords.length > 0 && registeredWords.length > 0) {
        const playerSurname = playerWords[0];
        const registeredSurname = registeredWords[0];

        // Точное совпадение фамилии
        if (playerSurname === registeredSurname) {
          // Если у игрока в кубке только фамилия (нет дополнительных слов)
          if (playerWords.length === 1) {
            // Собираем все игроков с такой же фамилией
            const sameLastNamePlayers = registeredPlayersArray.filter(
              (regPlayer) => {
                const regWords = this.normalizePlayerName(regPlayer)
                  .split(" ")
                  .filter((word) => word.length > 0);
                return regWords.length > 0 && regWords[0] === playerSurname;
              }
            );

            // Если найдено несколько игроков с такой фамилией - это неоднозначность
            if (sameLastNamePlayers.length > 1) {
              console.log(
                `❌ Неоднозначная фамилия "${playerName}". Найдено игроков: ${sameLastNamePlayers.join(
                  ", "
                )}`
              );
              return {
                found: false,
                ambiguous: true,
                suggestion: `Неоднозначная фамилия "${playerName}". Найдено несколько игроков: ${sameLastNamePlayers.join(
                  ", "
                )}. Укажите полное имя.`,
              };
            }

            // Если найден только один игрок с такой фамилией - возвращаем его
            console.log(
              `✓ Найдено единственное совпадение по фамилии: "${playerName}" -> "${registeredPlayer}"`
            );
            return { found: true, exactMatch: registeredPlayer };
          }

          // Если есть дополнительные слова, проверяем инициалы или полные имена
          const playerInitials = this.extractInitials(playerWords.slice(1));
          const registeredInitials = this.extractInitials(
            registeredWords.slice(1)
          );

          // Совпадение инициалов или частичное совпадение имени
          if (
            playerInitials === registeredInitials ||
            this.hasPartialNameMatch(
              playerWords.slice(1),
              registeredWords.slice(1)
            )
          ) {
            console.log(
              `✓ Найдено точное совпадение по фамилии и именам/инициалам: "${playerName}" -> "${registeredPlayer}"`
            );
            return { found: true, exactMatch: registeredPlayer };
          }
        }

        // Похожие фамилии (для возможных опечаток)
        if (this.isSimilarString(playerSurname, registeredSurname)) {
          partialMatches.push({
            player: registeredPlayer,
            score: 0.7, // средний приоритет для похожих фамилий
            type: "similar_surname",
          });
        }
      }

      // Дополнительная проверка: ищем совпадения в любом порядке слов
      for (const playerWord of playerWords) {
        for (const registeredWord of registeredWords) {
          if (playerWord === registeredWord && playerWord.length >= 3) {
            const existingMatch = partialMatches.find(
              (m) => m.player === registeredPlayer
            );
            if (existingMatch) {
              existingMatch.score += 0.3; // увеличиваем score для существующего совпадения
            } else {
              partialMatches.push({
                player: registeredPlayer,
                score: 0.5, // средний приоритет для частичных совпадений
                type: "partial_word_match",
              });
            }
          }
        }
      }
    }

    // Если есть частичные совпадения, возвращаем лучший вариант
    if (partialMatches.length > 0) {
      // Сортируем по score (лучшие первые)
      partialMatches.sort((a, b) => b.score - a.score);
      const bestMatch = partialMatches[0];

      console.log(
        `⚠️ Точное совпадение не найдено для "${playerName}". Лучший вариант: "${bestMatch.player}" (score: ${bestMatch.score}, type: ${bestMatch.type})`
      );

      return {
        found: false,
        suggestion: `Возможно, имелся в виду: "${bestMatch.player}"`,
      };
    }

    return { found: false };
  }

  // Извлечение инициалов из массива слов имени
  static extractInitials(nameWords: string[]): string {
    return nameWords
      .map((word) => word.charAt(0))
      .join("")
      .toLowerCase();
  }

  // Проверка частичного совпадения имен
  static hasPartialNameMatch(
    playerNameWords: string[],
    registeredNameWords: string[]
  ): boolean {
    // Проверяем, есть ли хотя бы одно полное совпадение слов имени
    return playerNameWords.some((playerWord) =>
      registeredNameWords.some(
        (registeredWord) =>
          playerWord.length > 1 &&
          registeredWord.length > 1 &&
          playerWord === registeredWord
      )
    );
  }

  // Проверка схожести строк (улучшенный алгоритм для опечаток)
  static isSimilarString(str1: string, str2: string): boolean {
    if (Math.abs(str1.length - str2.length) > 2) return false;
    if (str1.length < 3 || str2.length < 3) return false;

    // Вычисляем расстояние Левенштейна (упрощенная версия)
    const distance = this.calculateLevenshteinDistance(str1, str2);
    const maxLength = Math.max(str1.length, str2.length);

    // Если различие составляет менее 30% от длины строки, считаем их похожими
    return distance / maxLength < 0.3;
  }

  // Простая реализация расстояния Левенштейна
  static calculateLevenshteinDistance(str1: string, str2: string): number {
    const matrix = [];

    for (let i = 0; i <= str2.length; i++) {
      matrix[i] = [i];
    }

    for (let j = 0; j <= str1.length; j++) {
      matrix[0][j] = j;
    }

    for (let i = 1; i <= str2.length; i++) {
      for (let j = 1; j <= str1.length; j++) {
        if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
          matrix[i][j] = matrix[i - 1][j - 1];
        } else {
          matrix[i][j] = Math.min(
            matrix[i - 1][j - 1] + 1, // замена
            matrix[i][j - 1] + 1, // вставка
            matrix[i - 1][j] + 1 // удаление
          );
        }
      }
    }

    return matrix[str2.length][str1.length];
  }

  // Валидация критических ошибок перед парсингом
  static validateCriticalErrors(workbook: XLSX.WorkBook): string[] {
    const errors: string[] = [];

    // Проверка наличия листа регистрации
    const registrationSheetNames = [
      "Лист регистрации",
      "Лист Регистрации",
      "ЛИСТ РЕГИСТРАЦИИ",
      "Регистрация",
      "РЕГИСТРАЦИЯ",
      "Registration",
      "Sheet1",
      "Команды",
      "КОМАНДЫ",
      "Teams",
    ];

    const hasRegistrationSheet = registrationSheetNames.some(
      (name) => workbook.Sheets[name]
    );

    if (!hasRegistrationSheet) {
      errors.push(
        `Отсутствует обязательный лист регистрации. Ожидаемые названия: ${registrationSheetNames.join(
          ", "
        )}`
      );
    }

    // Проверка наличия листов кубков A и B
    const cupANames = [
      "Кубок A",
      "КубокA",
      "КУБОК A",
      "Кубок А",
      "КУБОК А",
      "КубокА",
    ];
    const cupBNames = [
      "Кубок B",
      "КубокB",
      "КУБОК B",
      "Кубок Б",
      "КУБОК Б",
      "КубокБ",
    ];

    const hasCupA = cupANames.some((name) => workbook.Sheets[name]);
    const hasCupB = cupBNames.some((name) => workbook.Sheets[name]);

    if (!hasCupA) {
      errors.push(
        `Отсутствует обязательный лист Кубок A. Ожидаемые названия: ${cupANames.join(
          ", "
        )}`
      );
    }

    if (!hasCupB) {
      errors.push(
        `Отсутствует обязательный лист Кубок B. Ожидаемые названия: ${cupBNames.join(
          ", "
        )}`
      );
    }

    return errors;
  }

  // Валидация игроков на листах кубков
  static validatePlayersInCups(
    workbook: XLSX.WorkBook,
    registeredPlayersNormalizedSet: Set<string>,
    registeredPlayersArray: string[]
  ): string[] {
    const errors: string[] = [];
    const warnings: string[] = [];
    const cupNames = ["A", "B"]; // Обрабатываем только кубки A и B

    // Объединяем все ячейки игроков в один массив
    const allPlayerCells = [
      ...this.quarterFinalsPlayersCells,
      ...this.semiFinalsPlayersCells,
      ...this.finalsPlayersCells,
      ...this.thirdPlacePlayersCells,
    ];

    for (const cupName of cupNames) {
      const possibleSheetNames = [
        `Кубок ${cupName}`,
        `Кубок${cupName}`,
        `КУБОК ${cupName}`,
        cupName === "A" ? "Кубок А" : "Кубок Б",
      ];

      let worksheet = null;
      let foundSheetName = null;

      for (const possibleName of possibleSheetNames) {
        if (workbook.Sheets[possibleName]) {
          worksheet = workbook.Sheets[possibleName];
          foundSheetName = possibleName;
          break;
        }
      }

      if (!worksheet) continue;

      // Проверяем всех игроков в ячейках кубка
      for (const cellAddress of allPlayerCells) {
        const cell = worksheet[cellAddress];
        if (cell && cell.v && typeof cell.v === "string" && cell.v.trim()) {
          const playerName = cell.v.trim();

          // Используем улучшенную функцию поиска игроков
          const matchResult = this.findPlayerMatch(
            playerName,
            registeredPlayersNormalizedSet,
            registeredPlayersArray
          );

          if (!matchResult.found) {
            let errorMessage = `Игрок "${playerName}" в листе "${foundSheetName}" (ячейка ${cellAddress})`;

            // Обрабатываем неоднозначные фамилии как критические ошибки
            if (matchResult.ambiguous) {
              errorMessage += ` - ${matchResult.suggestion}`;
              errors.push(errorMessage);
            } else {
              errorMessage += ` не найден в листе регистрации`;

              // Добавляем предложение если есть похожие имена
              if (matchResult.suggestion) {
                errorMessage += `. ${matchResult.suggestion}`;
                warnings.push(errorMessage);
              } else {
                errors.push(errorMessage);
              }
            }
          } else if (
            matchResult.exactMatch &&
            matchResult.exactMatch !== playerName
          ) {
            // Логируем информацию о найденном совпадении
            console.log(
              `✓ Игрок "${playerName}" в ячейке ${cellAddress} сопоставлен с зарегистрированным игроком "${matchResult.exactMatch}"`
            );
          }
        }
      }
    }

    // Добавляем предупреждения в конец списка ошибок
    if (warnings.length > 0) {
      console.warn("Обнаружены возможные несоответствия в именах игроков:");
      warnings.forEach((warning) => console.warn(`  - ${warning}`));
      errors.push(...warnings);
    }

    return errors;
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
        const aPriority = positionPriority[a.points_reason] || 999;
        const bPriority = positionPriority[b.points_reason] || 999;

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

  // Парсинг команд из листа регистрации
  static parseTeamsFromRegistrationSheet(workbook: XLSX.WorkBook): Team[] {
    // Пробуем различные варианты названий листа регистрации
    const possibleRegistrationSheetNames = [
      "Лист регистрации",
      "Лист Регистрации",
      "ЛИСТ РЕГИСТРАЦИИ",
      "Регистрация",
      "РЕГИСТРАЦИЯ",
      "Registration",
      "Sheet1", // На случай если это первый лист
      "Команды",
      "КОМАНДЫ",
      "Teams",
    ];

    let registrationSheet = null;
    let foundSheetName = null;

    // Проверяем все возможные варианты названий
    for (const possibleName of possibleRegistrationSheetNames) {
      if (workbook.Sheets[possibleName]) {
        registrationSheet = workbook.Sheets[possibleName];
        foundSheetName = possibleName;
        break;
      }
    }

    // Если не найден ни один из ожидаемых листов, пробуем первый лист в файле
    if (!registrationSheet && workbook.SheetNames.length > 0) {
      const firstSheetName = workbook.SheetNames[0];
      registrationSheet = workbook.Sheets[firstSheetName];
      foundSheetName = firstSheetName;
      console.log(
        `Не найден лист регистрации с ожидаемым названием. Используется первый лист: "${firstSheetName}"`
      );
    }

    if (!registrationSheet) {
      const availableSheets = workbook.SheetNames.join(", ");
      throw new Error(
        `Не найден лист регистрации команд. Проверенные варианты: ${possibleRegistrationSheetNames.join(
          ", "
        )}. Доступные листы в файле: ${availableSheets}`
      );
    }

    console.log(`Найден лист регистрации: "${foundSheetName}"`);

    const teams: Team[] = [];

    try {
      // Парсим команды из листа регистрации
      const registrationData = XLSX.utils.sheet_to_json(registrationSheet, {
        header: 1,
      });

      if (registrationData.length === 0) {
        throw new Error(
          `Лист "${foundSheetName}" пуст или не содержит данных для парсинга`
        );
      }

      console.log(
        `Найдено строк в листе регистрации: ${registrationData.length}`
      );

      for (let i = 0; i < registrationData.length; i++) {
        const row = registrationData[i] as any[];
        if (row && row.length >= 2) {
          const teamNumber = parseInt(String(row[0]));
          if (!isNaN(teamNumber)) {
            const players: string[] = [];

            // Добавляем всех игроков команды (от 1 до 4)
            for (let j = 1; j <= 4 && j < row.length; j++) {
              const player = String(row[j]).trim();
              if (player && player !== "undefined") {
                players.push(player);
              }
            }

            if (players.length > 0) {
              teams.push({
                number: teamNumber,
                players: players,
              });
            }
          }
        }
      }

      console.log(`Найдено команд: ${teams.length}`);
      return teams;
    } catch (error) {
      throw new Error(
        `Ошибка при парсинге листа регистрации "${foundSheetName}": ${
          (error as Error).message
        }`
      );
    }
  }

  // Валидация игроков из листа регистрации против базы данных
  static async validatePlayerNamesFromRegistration(
    playerNames: string[]
  ): Promise<string[]> {
    const errors: string[] = [];

    // Получаем всех игроков из базы данных
    const allPlayers = await PlayerModel.getAllPlayers();
    const registeredPlayersArray = allPlayers.map((p) => p.name);
    const registeredPlayersNormalizedSet = new Set(
      registeredPlayersArray.map((name) => this.normalizePlayerName(name))
    );

    for (const playerName of playerNames) {
      // Используем уже существующий метод для проверки неоднозначности
      const matchResult = this.findPlayerMatch(
        playerName,
        registeredPlayersNormalizedSet,
        registeredPlayersArray
      );

      // Если имя неоднозначно - добавляем ошибку
      if (matchResult.ambiguous) {
        errors.push(
          `Неоднозначное имя игрока "${playerName}" в листе регистрации. ${matchResult.suggestion}`
        );
      }
    }

    return errors;
  }

  // Новый метод: парсинг и сохранение команд из листа регистрации в БД
  static async parseAndSaveTeamsFromRegistrationSheet(
    workbook: XLSX.WorkBook,
    tournamentId: number
  ): Promise<Array<{ teamId: number; players: string[] }>> {
    // Используем ту же логику поиска листа регистрации
    const possibleRegistrationSheetNames = [
      "Лист регистрации",
      "Лист Регистрации",
      "ЛИСТ РЕГИСТРАЦИИ",
      "Регистрация",
      "РЕГИСТРАЦИЯ",
      "Registration",
      "Sheet1", // На случай если это первый лист
      "Команды",
      "КОМАНДЫ",
      "Teams",
    ];

    let registrationSheet = null;
    let foundSheetName = null;

    // Проверяем все возможные варианты названий
    for (const possibleName of possibleRegistrationSheetNames) {
      if (workbook.Sheets[possibleName]) {
        registrationSheet = workbook.Sheets[possibleName];
        foundSheetName = possibleName;
        break;
      }
    }

    // Если не найден ни один из ожидаемых листов, пробуем первый лист в файле
    if (!registrationSheet && workbook.SheetNames.length > 0) {
      const firstSheetName = workbook.SheetNames[0];
      registrationSheet = workbook.Sheets[firstSheetName];
      foundSheetName = firstSheetName;
      console.log(
        `Не найден лист регистрации с ожидаемым названием. Используется первый лист: "${firstSheetName}"`
      );
    }

    if (!registrationSheet) {
      const availableSheets = workbook.SheetNames.join(", ");
      throw new Error(
        `Не найден лист регистрации команд. Проверенные варианты: ${possibleRegistrationSheetNames.join(
          ", "
        )}. Доступные листы в файле: ${availableSheets}`
      );
    }

    console.log(`Найден лист регистрации: "${foundSheetName}"`);

    const savedTeams: Array<{ teamId: number; players: string[] }> = [];

    try {
      // Парсим команды из листа регистрации
      const registrationData = XLSX.utils.sheet_to_json(registrationSheet, {
        header: 1,
      });

      if (registrationData.length === 0) {
        throw new Error(
          `Лист "${foundSheetName}" пуст или не содержит данных для парсинга`
        );
      }

      console.log(
        `Найдено строк в листе регистрации: ${registrationData.length}`
      );

      // Сначала собираем всех игроков для валидации
      const allPlayerNames: string[] = [];
      for (let i = 0; i < registrationData.length; i++) {
        const row = registrationData[i] as any[];
        if (row && row.length >= 2) {
          const teamNumber = parseInt(String(row[0]));
          if (!isNaN(teamNumber)) {
            // Добавляем всех игроков команды (от 1 до 4)
            for (let j = 1; j <= 4 && j < row.length; j++) {
              const player = String(row[j]).trim();
              if (player && player !== "undefined") {
                allPlayerNames.push(player);
              }
            }
          }
        }
      }

      // Валидируем все имена игроков на неоднозначность
      console.log(
        `🔍 Валидация ${allPlayerNames.length} имен игроков на неоднозначность...`
      );
      const nameValidationErrors =
        await this.validatePlayerNamesFromRegistration(allPlayerNames);
      if (nameValidationErrors.length > 0) {
        throw new Error(
          `Ошибки валидации имен игроков в листе регистрации:\n${nameValidationErrors.join(
            "\n"
          )}`
        );
      }
      console.log(`✅ Валидация имен игроков прошла успешно`);

      for (let i = 0; i < registrationData.length; i++) {
        const row = registrationData[i] as any[];
        if (row && row.length >= 2) {
          const teamNumber = parseInt(String(row[0]));
          if (!isNaN(teamNumber)) {
            const players: string[] = [];

            // Добавляем всех игроков команды (от 1 до 4)
            for (let j = 1; j <= 4 && j < row.length; j++) {
              const player = String(row[j]).trim();
              if (player && player !== "undefined") {
                players.push(player);
              }
            }

            if (players.length > 0) {
              // Сортируем игроков по фамилиям
              const sortedPlayers = players.sort();

              // Создаем или находим игроков в БД
              const playerIds: number[] = [];
              for (const playerName of sortedPlayers) {
                let playerId: number;
                let player = await PlayerModel.getPlayerByName(playerName);
                if (!player) {
                  playerId = await PlayerModel.createPlayer(playerName);
                  console.log(
                    `✓ Создан игрок: "${playerName}" (ID: ${playerId})`
                  );
                } else {
                  playerId = player.id;
                  console.log(
                    `✓ Найден игрок: "${playerName}" (ID: ${playerId})`
                  );
                }
                playerIds.push(playerId);
              }

              // Ищем существующую команду
              let existingTeam = await TeamModel.findExistingTeam(playerIds);

              let teamId: number;
              if (existingTeam) {
                teamId = existingTeam.id;
                console.log(
                  `✓ Найдена существующая команда: ID ${teamId}, игроки: ${sortedPlayers.join(
                    ", "
                  )}`
                );
              } else {
                // Создаем новую команду
                teamId = await TeamModel.createTeam(playerIds);
                console.log(
                  `✓ Создана новая команда: ID ${teamId}, игроки: ${sortedPlayers.join(
                    ", "
                  )}`
                );
              }

              savedTeams.push({
                teamId,
                players: sortedPlayers,
              });
            }
          }
        }
      }

      console.log(`Обработано команд: ${savedTeams.length}`);
      return savedTeams;
    } catch (error) {
      throw new Error(
        `Ошибка при парсинге и сохранении команд из листа регистрации "${foundSheetName}": ${
          (error as Error).message
        }`
      );
    }
  }

  // Парсинг результатов кубков A и B
  static parseCupResults(
    workbook: XLSX.WorkBook,
    teams: Team[]
  ): CupTeamResult[] {
    // Создаем маппинг игроков на команды
    const playerToTeam = new Map<string, Team>();
    teams.forEach((team) => {
      team.players.forEach((player) => {
        playerToTeam.set(player.toLowerCase(), team);
      });
    });

    const cupResults: CupTeamResult[] = [];
    const cupNames = ["A", "B"]; // Обрабатываем только кубки A и B

    for (const cupName of cupNames) {
      // Пробуем различные варианты названий листов
      const possibleSheetNames = [
        `Кубок ${cupName}`,
        `Кубок${cupName}`,
        `КУБОК ${cupName}`,
        cupName === "A" ? "Кубок А" : "Кубок Б",
      ];

      let worksheet = null;
      let foundSheetName = null;

      for (const possibleName of possibleSheetNames) {
        if (workbook.Sheets[possibleName]) {
          worksheet = workbook.Sheets[possibleName];
          foundSheetName = possibleName;
          break;
        }
      }

      if (!worksheet) {
        console.log(
          `Лист для кубка ${cupName} не найден, пропускаем. Проверены варианты: ${possibleSheetNames.join(
            ", "
          )}`
        );
        continue;
      }

      console.log(`Найден лист кубка ${cupName}: "${foundSheetName}"`);

      // Определяем ячейки для каждой стадии кубка
      const stages = {
        // 1/4 финала
        quarterFinals: [
          {
            cells: ["B4", "B8", "B12", "B16", "B20", "B24", "B28", "B32"],
            position: CupPosition.QUARTER_FINAL,
          },
        ],
        // 1/2 финала
        semiFinals: [
          {
            cells: ["F6", "F14", "F22", "F30"],
            position: CupPosition.SEMI_FINAL,
          },
        ],
        // Финал
        finals: [
          { cells: ["J10", "J26"], position: CupPosition.RUNNER_UP }, // Участники финала (2 место)
        ],
        // Игра за 3 место
        thirdPlace: [{ range: "F38", position: CupPosition.THIRD_PLACE }],
      };

      const cupTeamResults: Array<{ team: Team; position: CupPosition }> = [];

      // Парсим все стадии
      // Определяем приоритет позиций (чем выше число, тем лучше позиция)
      const positionPriority: { [key: string]: number } = {
        [CupPosition.WINNER]: 5,
        [CupPosition.RUNNER_UP]: 4,
        [CupPosition.THIRD_PLACE]: 3,
        [CupPosition.SEMI_FINAL]: 2,
        [CupPosition.QUARTER_FINAL]: 1,
      };

      Object.entries(stages).forEach(([stageName, stageRanges]) => {
        stageRanges.forEach((stageInfo: StageInfo) => {
          // Обрабатываем либо конкретные ячейки, либо range (для обратной совместимости)
          const cellsToProcess: string[] = [];

          // Type guard для StageWithCells
          if ("cells" in stageInfo) {
            cellsToProcess.push(...stageInfo.cells);
          }
          // Type guard для StageWithRange
          else if ("range" in stageInfo) {
            const range = XLSX.utils.decode_range(stageInfo.range);
            for (let row = range.s.r; row <= range.e.r; row++) {
              for (let col = range.s.c; col <= range.e.c; col++) {
                const cellAddress = XLSX.utils.encode_cell({ r: row, c: col });
                cellsToProcess.push(cellAddress);
              }
            }
          }

          cellsToProcess.forEach((cellAddress: string) => {
            const cell = worksheet[cellAddress];

            if (cell && cell.v && typeof cell.v === "string" && cell.v.trim()) {
              const playerName = cell.v.trim();
              const team = playerToTeam.get(playerName.toLowerCase());

              if (team) {
                // Ищем существующий результат команды
                const existingResultIndex = cupTeamResults.findIndex(
                  (r) => r.team.number === team.number
                );

                if (existingResultIndex !== -1) {
                  // Команда уже есть, проверяем приоритет позиций
                  const existingPriority =
                    positionPriority[
                      cupTeamResults[existingResultIndex].position
                    ] || 0;
                  const newPriority = positionPriority[stageInfo.position] || 0;

                  // Обновляем позицию, если новая позиция лучше
                  if (newPriority > existingPriority) {
                    cupTeamResults[existingResultIndex].position =
                      stageInfo.position;
                  }
                } else {
                  // Команды еще нет, добавляем
                  cupTeamResults.push({
                    team: team,
                    position: stageInfo.position,
                  });
                }
              } else {
                console.log(`Игрок "${playerName}" не найден в командах`);
              }
            }
          });
        });
      });

      // Определяем победителя финала (1 место) из ячейки N18
      try {
        const winnerCell = worksheet["N18"];
        if (
          winnerCell &&
          winnerCell.v &&
          typeof winnerCell.v === "string" &&
          winnerCell.v.trim()
        ) {
          const winnerPlayerName = winnerCell.v.trim();
          const winnerTeam = playerToTeam.get(winnerPlayerName.toLowerCase());

          if (winnerTeam) {
            // Ищем команду победителя в результатах и устанавливаем позицию WINNER
            const winnerTeamIndex = cupTeamResults.findIndex(
              (r) => r.team.number === winnerTeam.number
            );
            if (winnerTeamIndex !== -1) {
              cupTeamResults[winnerTeamIndex].position = CupPosition.WINNER;
              console.log(
                `Победитель кубка ${cupName}: команда ${winnerTeam.number} (${winnerPlayerName})`
              );
            } else {
              // Если команда победителя не найдена в результатах, добавляем её
              cupTeamResults.push({
                team: winnerTeam,
                position: CupPosition.WINNER,
              });
              console.log(
                `Добавлен победитель кубка ${cupName}: команда ${winnerTeam.number} (${winnerPlayerName})`
              );
            }
          } else {
            console.warn(
              `Команда игрока-победителя "${winnerPlayerName}" не найдена в ячейке N18 кубка ${cupName}`
            );
          }
        } else {
          console.warn(
            `Ячейка N18 пуста или не содержит данных о победителе в кубке ${cupName}`
          );
        }
      } catch (error) {
        console.error(
          `Ошибка при чтении победителя из ячейки N18 в кубке ${cupName}:`,
          error
        );
      }

      // Добавляем результаты этого кубка
      cupTeamResults.forEach((result) => {
        cupResults.push({
          team: result.team,
          cup: cupName as "A" | "B",
          points_reason: result.position,
        });
      });
    }

    return cupResults;
  }

  // Новый метод: парсинг результатов кубков с поиском команд в БД
  static async parseCupResultsFromDB(
    workbook: XLSX.WorkBook,
    tournamentId: number
  ): Promise<Array<{ teamId: number; cup: "A" | "B"; position: CupPosition }>> {
    const cupResults: Array<{
      teamId: number;
      cup: "A" | "B";
      position: CupPosition;
    }> = [];
    const cupNames = ["A", "B"] as const; // Обрабатываем только кубки A и B

    for (const cupName of cupNames) {
      // Пробуем различные варианты названий листов
      const possibleSheetNames = [
        `Кубок ${cupName}`,
        `Кубок${cupName}`,
        `КУБОК ${cupName}`,
        cupName === "A" ? "Кубок А" : "Кубок Б",
      ];

      let worksheet = null;
      let foundSheetName = null;

      for (const possibleName of possibleSheetNames) {
        if (workbook.Sheets[possibleName]) {
          worksheet = workbook.Sheets[possibleName];
          foundSheetName = possibleName;
          break;
        }
      }

      if (!worksheet) {
        console.log(
          `Лист для кубка ${cupName} не найден, пропускаем. Проверены варианты: ${possibleSheetNames.join(
            ", "
          )}`
        );
        continue;
      }

      console.log(`Найден лист кубка ${cupName}: "${foundSheetName}"`);

      // Определяем ячейки для каждой стадии кубка
      const stages = {
        // 1/4 финала
        quarterFinals: [
          {
            cells: this.quarterFinalsPlayersCells,
            position: CupPosition.QUARTER_FINAL,
          },
        ],
        // 1/2 финала
        semiFinals: [
          {
            cells: this.semiFinalsPlayersCells,
            position: CupPosition.SEMI_FINAL,
          },
        ],
        // Финал
        finals: [
          { cells: this.finalsPlayersCells, position: CupPosition.RUNNER_UP }, // Участники финала (2 место)
        ],
        // Игра за 3 место
        thirdPlace: [
          {
            cells: this.thirdPlacePlayersCells,
            position: CupPosition.THIRD_PLACE,
          },
        ],
      };

      const cupTeamResults: Array<{ teamId: number; position: CupPosition }> =
        [];

      // Парсим все стадии
      // Определяем приоритет позиций (чем выше число, тем лучше позиция)
      const positionPriority: { [key: string]: number } = {
        [CupPosition.WINNER]: 5,
        [CupPosition.RUNNER_UP]: 4,
        [CupPosition.THIRD_PLACE]: 3,
        [CupPosition.SEMI_FINAL]: 2,
        [CupPosition.QUARTER_FINAL]: 1,
      };

      // Собираем все промисы для поиска команд
      const searchPromises: Promise<void>[] = [];

      for (const [stageName, stagesList] of Object.entries(stages)) {
        for (const stageInfo of stagesList as any[]) {
          // Обрабатываем либо конкретные ячейки, либо range (для обратной совместимости)
          const cellsToProcess: string[] = [];

          // Type guard для StageWithCells
          if ("cells" in stageInfo) {
            cellsToProcess.push(...stageInfo.cells);
          }
          // Type guard для StageWithRange
          else if ("range" in stageInfo) {
            const range = XLSX.utils.decode_range(stageInfo.range);
            for (let R = range.s.r; R <= range.e.r; ++R) {
              for (let C = range.s.c; C <= range.e.c; ++C) {
                const cellAddress = XLSX.utils.encode_cell({ r: R, c: C });
                cellsToProcess.push(cellAddress);
              }
            }
          }

          cellsToProcess.forEach((cellAddress: string) => {
            const cell = worksheet[cellAddress];

            if (cell && cell.v && typeof cell.v === "string" && cell.v.trim()) {
              const playerName = cell.v.trim();

              // Добавляем промис поиска команды
              const searchPromise = TeamModel.findTeamByPlayerName(playerName)
                .then((team) => {
                  if (team) {
                    // Проверяем, есть ли уже результат для этой команды в данном кубке
                    const existingResultIndex = cupTeamResults.findIndex(
                      (r) => r.teamId === team.id
                    );

                    if (existingResultIndex !== -1) {
                      // Команда уже есть, проверяем позицию
                      const existingPriority =
                        positionPriority[
                          cupTeamResults[existingResultIndex].position
                        ] || 0;
                      const newPriority =
                        positionPriority[stageInfo.position] || 0;

                      // Обновляем позицию, если новая позиция лучше
                      if (newPriority > existingPriority) {
                        cupTeamResults[existingResultIndex].position =
                          stageInfo.position;
                      }
                    } else {
                      // Команды еще нет, добавляем
                      cupTeamResults.push({
                        teamId: team.id,
                        position: stageInfo.position,
                      });
                    }
                  } else {
                    console.log(
                      `Игрок "${playerName}" не найден ни в одной команде`
                    );
                  }
                })
                .catch((error) => {
                  console.error(
                    `Ошибка при поиске команды для игрока "${playerName}":`,
                    error
                  );
                });

              searchPromises.push(searchPromise);
            }
          });
        }
      }

      // Ждем завершения всех поисков команд
      await Promise.all(searchPromises);

      // Определяем победителя финала (1 место) из ячейки N18
      try {
        const winnerCell = worksheet["N18"];
        if (
          winnerCell &&
          winnerCell.v &&
          typeof winnerCell.v === "string" &&
          winnerCell.v.trim()
        ) {
          const winnerPlayerName = winnerCell.v.trim();
          const winnerTeam = await TeamModel.findTeamByPlayerName(
            winnerPlayerName
          );

          if (winnerTeam) {
            // Ищем команду победителя в результатах и устанавливаем позицию WINNER
            const winnerTeamIndex = cupTeamResults.findIndex(
              (r) => r.teamId === winnerTeam.id
            );
            if (winnerTeamIndex !== -1) {
              cupTeamResults[winnerTeamIndex].position = CupPosition.WINNER;
              console.log(
                `Победитель кубка ${cupName}: команда ID ${winnerTeam.id} (${winnerPlayerName})`
              );
            } else {
              cupTeamResults.push({
                teamId: winnerTeam.id,
                position: CupPosition.WINNER,
              });
              console.log(
                `Добавлен победитель кубка ${cupName}: команда ID ${winnerTeam.id} (${winnerPlayerName})`
              );
            }
          } else {
            console.log(
              `Команда победителя "${winnerPlayerName}" не найдена в кубке ${cupName}`
            );
          }
        }
      } catch (error) {
        console.warn(
          `Ошибка при чтении ячейки победителя для кубка ${cupName}: ${
            (error as Error).message
          }`
        );
      }

      // Добавляем результаты кубка
      cupTeamResults.forEach((result) => {
        cupResults.push({
          teamId: result.teamId,
          cup: cupName as "A" | "B",
          position: result.position,
        });
      });
    }

    return cupResults;
  }

  // Полный парсинг турнира с командами
  static parseTournamentData(
    fileBuffer: Buffer,
    fileName: string,
    tournamentName: string,
    tournamentDate: string
  ): TournamentUploadData {
    try {
      console.log(`Начинается парсинг файла турнира: "${fileName}"`);

      // Парсим XLSX файл
      let workbook: XLSX.WorkBook;
      try {
        workbook = XLSX.read(fileBuffer, { type: "buffer" });
        console.log(
          `Доступные листы в файле: ${workbook.SheetNames.join(", ")}`
        );
      } catch (error) {
        throw new Error(
          `Ошибка при чтении Excel файла "${fileName}": ${
            (error as Error).message
          }`
        );
      }

      // Парсим команды
      let teams: Team[];
      try {
        teams = this.parseTeamsFromRegistrationSheet(workbook);
        if (teams.length === 0) {
          console.warn("Не найдено ни одной команды в листе регистрации");
        }
      } catch (error) {
        throw new Error(
          `Ошибка при парсинге листа регистрации: ${(error as Error).message}`
        );
      }

      // Парсим результаты кубков
      let cupResults: CupTeamResult[];
      try {
        cupResults = this.parseCupResults(workbook, teams);
        console.log(`Найдено результатов кубков: ${cupResults.length}`);
      } catch (error) {
        console.warn(
          `Ошибка при парсинге результатов кубков: ${(error as Error).message}`
        );
        // Не бросаем ошибку, продолжаем с пустыми результатами
        cupResults = [];
      }

      // Преобразуем результаты команд в результаты игроков
      const playerResults: Array<{
        player_name: string;
        points_reason: string;
        cup: "A" | "B";
      }> = [];

      cupResults.forEach((teamResult) => {
        teamResult.team.players.forEach((player) => {
          playerResults.push({
            player_name: player,
            points_reason: teamResult.points_reason,
            cup: teamResult.cup,
          });
        });
      });

      console.log(`Создано результатов игроков: ${playerResults.length}`);

      // Определяем категорию турнира из названия файла
      const fileNameLower = fileName.toLowerCase();
      let category: "1" | "2" = "1"; // по умолчанию первая категория

      if (
        fileNameLower.includes("2 категория") ||
        fileNameLower.includes("2категория") ||
        fileNameLower.includes("вторая категория") ||
        fileNameLower.includes("ii категория") ||
        fileNameLower.includes("категория 2")
      ) {
        category = "2";
        console.log("Определена 2-я категория турнира из названия файла");
      } else if (
        fileNameLower.includes("1 категория") ||
        fileNameLower.includes("1категория") ||
        fileNameLower.includes("первая категория") ||
        fileNameLower.includes("i категория") ||
        fileNameLower.includes("категория 1")
      ) {
        category = "1";
        console.log("Определена 1-я категория турнира из названия файла");
      } else {
        console.log(
          "Категория турнира не определена из названия файла, используется 1-я категория по умолчанию"
        );
      }

      const result = {
        tournament_name: tournamentName,
        tournament_date: tournamentDate,
        total_teams: teams.length,
        tournament_category: category,
        results: playerResults,
      };

      console.log(
        `Парсинг завершен успешно: команд - ${teams.length}, результатов игроков - ${playerResults.length}, категория - ${category}`
      );
      return result;
    } catch (error) {
      console.error(
        `Критическая ошибка при парсинге файла турнира "${fileName}":`,
        error
      );
      throw new Error(
        `Не удалось обработать файл турнира "${fileName}": ${
          (error as Error).message
        }`
      );
    }
  }

  // Новый метод: парсинг турнира с сохранением команд в БД и валидацией критических ошибок
  static async parseTournamentDataWithDB(
    fileBuffer: Buffer,
    fileName: string,
    tournamentName: string,
    tournamentDate: string,
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

      // ВАЛИДАЦИЯ КРИТИЧЕСКИХ ОШИБОК
      console.log("🔍 Выполняется валидация критических ошибок...");

      // 1. Проверка наличия обязательных листов
      const structuralErrors = this.validateCriticalErrors(workbook);
      if (structuralErrors.length > 0) {
        throw new Error(
          `Критические ошибки структуры файла:\n${structuralErrors.join("\n")}`
        );
      }
      console.log("✓ Структура файла корректна");

      // 2. Получаем список зарегистрированных игроков для валидации
      let registeredPlayersNormalizedSet: Set<string>;
      let registeredPlayersArray: string[];
      try {
        const teams = this.parseTeamsFromRegistrationSheet(workbook);
        registeredPlayersNormalizedSet = new Set();
        registeredPlayersArray = [];

        teams.forEach((team) => {
          team.players.forEach((player) => {
            registeredPlayersNormalizedSet.add(
              this.normalizePlayerName(player)
            ); // Нормализованные имена для быстрого поиска
            registeredPlayersArray.push(player); // Сохраняем оригинальный регистр
          });
        });

        console.log(
          `✓ Найдено ${registeredPlayersNormalizedSet.size} зарегистрированных игроков`
        );
      } catch (error) {
        throw new Error(
          `Ошибка при получении списка игроков для валидации: ${
            (error as Error).message
          }`
        );
      }

      // 3. Проверка наличия игроков из кубков в листе регистрации
      const playerValidationErrors = this.validatePlayersInCups(
        workbook,
        registeredPlayersNormalizedSet,
        registeredPlayersArray
      );
      if (playerValidationErrors.length > 0) {
        throw new Error(
          `Критические ошибки в данных игроков:\n${playerValidationErrors.join(
            "\n"
          )}`
        );
      }
      console.log("✓ Все игроки в кубках найдены в листе регистрации");

      console.log("✅ Валидация критических ошибок пройдена успешно");

      // Определяем категорию турнира из названия файла
      const fileNameLower = fileName.toLowerCase();
      let category: "1" | "2" = "1"; // по умолчанию первая категория

      if (
        fileNameLower.includes("2 категория") ||
        fileNameLower.includes("2категория") ||
        fileNameLower.includes("вторая категория") ||
        fileNameLower.includes("ii категория") ||
        fileNameLower.includes("категория 2")
      ) {
        category = "2";
        console.log("Определена 2-я категория турнира из названия файла");
      } else if (
        fileNameLower.includes("1 категория") ||
        fileNameLower.includes("1категория") ||
        fileNameLower.includes("первая категория") ||
        fileNameLower.includes("i категория") ||
        fileNameLower.includes("категория 1")
      ) {
        category = "1";
        console.log("Определена 1-я категория турнира из названия файла");
      } else {
        console.log(
          "Категория турнира не определена из названия файла, используется 1-я категория по умолчанию"
        );
      }

      // 1. Создаем турнир (используем отдельное соединение)
      let tournamentId: number;
      try {
        const [tournamentResult] = await pool.execute(
          "INSERT INTO tournaments (name, date, created_at) VALUES (?, ?, NOW())",
          [tournamentName, tournamentDate]
        );
        tournamentId = (tournamentResult as any).insertId;
        console.log(`✓ Создан турнир: ID ${tournamentId}`);
      } catch (error) {
        throw new Error(
          `Ошибка при создании турнира: ${(error as Error).message}`
        );
      }

      // 2. Парсим и сохраняем команды из листа регистрации в БД (используем отдельное соединение)
      let savedTeams: Array<{ teamId: number; players: string[] }>;
      try {
        savedTeams = await this.parseAndSaveTeamsFromRegistrationSheet(
          workbook,
          tournamentId
        );
        console.log(`✓ Сохранено команд: ${savedTeams.length}`);
      } catch (error) {
        throw new Error(
          `Ошибка при парсинге и сохранении команд: ${(error as Error).message}`
        );
      }

      // 3. Парсим результаты кубков с поиском команд в БД (используем отдельное соединение)
      let cupResults: Array<{
        teamId: number;
        cup: "A" | "B";
        position: CupPosition;
      }>;
      try {
        cupResults = await this.parseCupResultsFromDB(workbook, tournamentId);
        console.log(`✓ Найдено результатов кубков: ${cupResults.length}`);
      } catch (error) {
        console.warn(
          `Предупреждение при парсинге результатов кубков: ${
            (error as Error).message
          }`
        );
        // Не бросаем ошибку, продолжаем с пустыми результатами
        cupResults = [];
      }

      // 4. Парсим данные швейцарской системы для получения побед команд
      let teamWins = new Map<string, number>();
      try {
        console.log("🎯 Парсим лист 'Итоги Швейцарки'...");
        teamWins = this.parseSwissSystemResults(workbook);
        console.log(`✓ Найдено ${teamWins.size} команд с данными о победах`);
      } catch (error) {
        console.warn(
          `Ошибка при парсинге листа 'Итоги Швейцарки': ${
            (error as Error).message
          }`
        );
        // Не бросаем ошибку, продолжаем без данных о победах
      }

      // 5. Сохраняем результаты турнира для команд кубков (используем отдельные соединения для каждого блока)
      let cupResultsCount = 0;
      for (const result of cupResults) {
        try {
          await this.saveCupTeamResult(
            result,
            tournamentId,
            teamWins,
            category,
            savedTeams.length
          );
          cupResultsCount++;
        } catch (error) {
          console.error(
            `Ошибка при сохранении результата команды ${result.teamId}:`,
            error
          );
          // Продолжаем с другими командами
        }
      }

      // 6. Сохраняем результаты команд швейцарки (не попавших в кубки)
      let swissResultsCount = 0;
      for (const savedTeam of savedTeams) {
        // Проверяем, есть ли эта команда уже в результатах кубков
        const isInCup = cupResults.some(
          (cupResult) => cupResult.teamId === savedTeam.teamId
        );

        if (!isInCup) {
          try {
            const swissResult = await this.saveSwissTeamResult(
              savedTeam,
              tournamentId,
              teamWins,
              category
            );
            if (swissResult) {
              swissResultsCount++;
            }
          } catch (error) {
            console.error(
              `Ошибка при сохранении швейцарки для команды ${savedTeam.teamId}:`,
              error
            );
            // Продолжаем с другими командами
          }
        }
      }

      console.log(
        `✅ Парсинг завершен успешно: турнир ID ${tournamentId}, команд - ${savedTeams.length}, результатов кубков - ${cupResultsCount}, результатов швейцарки - ${swissResultsCount}, категория - ${category}`
      );

      return {
        tournamentId,
        teamsCount: savedTeams.length,
        resultsCount: cupResultsCount + swissResultsCount,
      };
    } catch (error) {
      console.error(
        `❌ Критическая ошибка при парсинге файла турнира "${fileName}":`,
        error
      );
      throw new Error(
        `Не удалось обработать файл турнира "${fileName}": ${
          (error as Error).message
        }`
      );
    }
  }

  // Сохранение результата команды кубка
  static async saveCupTeamResult(
    result: { teamId: number; cup: "A" | "B"; position: CupPosition },
    tournamentId: number,
    teamWins: Map<string, number>,
    category: "1" | "2",
    totalTeams: number
  ): Promise<void> {
    // Ищем количество побед для этой команды
    let qualifying_wins = 0;

    // Получаем информацию о команде для поиска побед
    const [teamRow] = await pool.execute<any[]>(
      `SELECT t.id, GROUP_CONCAT(p.name SEPARATOR ', ') as player_names
       FROM teams t
       LEFT JOIN team_players tp ON t.id = tp.team_id
       LEFT JOIN players p ON tp.player_id = p.id
       WHERE t.id = ?
       GROUP BY t.id`,
      [result.teamId]
    );

    if (teamRow && teamRow.length > 0) {
      const teamInfo = teamRow[0];
      const playerNames = teamInfo.player_names || "";

      // Ищем точное совпадение или частичное совпадение по именам игроков
      for (const [teamName, teamWinsCount] of teamWins.entries()) {
        // Проверяем различные варианты совпадения
        if (
          playerNames.toLowerCase().includes(teamName.toLowerCase()) ||
          teamName.toLowerCase().includes(playerNames.toLowerCase())
        ) {
          qualifying_wins = teamWinsCount;
          console.log(
            `✓ Найдено совпадение: команда ID ${result.teamId} (${playerNames}) -> ${qualifying_wins} побед`
          );
          break;
        }

        // Дополнительная проверка по отдельным именам игроков
        const playersArray = playerNames.split(", ");
        for (const playerName of playersArray) {
          // Убираем запятые и улучшаем сопоставление
          const cleanTeamName = teamName.replace(/[,\s]+$/, "").toLowerCase();
          const cleanPlayerName = playerName.toLowerCase();

          // Проверяем точное совпадение фамилии или полного имени
          if (
            cleanTeamName === cleanPlayerName ||
            cleanTeamName.includes(cleanPlayerName.split(" ")[0]) ||
            cleanPlayerName.includes(cleanTeamName.split(" ")[0])
          ) {
            qualifying_wins = teamWinsCount;
            console.log(
              `✓ Найдено совпадение по игроку: команда ID ${result.teamId} (${cleanPlayerName}) совпадает с "${cleanTeamName}" -> ${qualifying_wins} побед`
            );
            break;
          }
        }
        if (qualifying_wins > 0) break;
      }
    }

    // Проверяем, есть ли в команде лицензированные игроки
    let isLicensed = false;
    const [licensedRow] = await pool.execute<any[]>(
      `SELECT COUNT(*) as licensed_count
       FROM teams t
       JOIN team_players tp ON t.id = tp.team_id
       JOIN players p ON tp.player_id = p.id
       LEFT JOIN licensed_players lp ON lp.player_id = p.id AND lp.is_active = 1
       WHERE t.id = ? AND lp.id IS NOT NULL`,
      [result.teamId]
    );

    if (licensedRow && licensedRow.length > 0) {
      isLicensed = licensedRow[0].licensed_count > 0;
    }

    // Рассчитываем очки команды (только для лицензированных)
    let points = 0;

    if (isLicensed) {
      if (result.cup) {
        // Лицензированные команды, попавшие в кубки А/Б, получают очки за место в кубке
        points = getCupPoints(
          category,
          result.cup,
          result.position as any,
          totalTeams
        );
      } else {
        // Лицензированные команды НЕ в кубках получают очки за победы в швейцарке
        points = getWinsPoints(category, qualifying_wins);
      }
    } else {
      // Нелицензированные команды не получают очки
      points = 0;
    }

    console.log(
      `📊 Команда ${result.teamId}: кубок ${result.cup}, позиция ${result.position}, побед: ${qualifying_wins}, лицензирована: ${isLicensed}, очков: ${points}`
    );

    // Позиция уже является правильным enum значением
    let pointsReason: PointsReason;

    switch (result.position) {
      case CupPosition.WINNER:
        pointsReason = PointsReason.CUP_WINNER;
        break;
      case CupPosition.RUNNER_UP:
        pointsReason = PointsReason.CUP_RUNNER_UP;
        break;
      case CupPosition.THIRD_PLACE:
        pointsReason = PointsReason.CUP_THIRD_PLACE;
        break;
      case CupPosition.SEMI_FINAL:
        pointsReason = PointsReason.CUP_SEMI_FINAL;
        break;
      case CupPosition.QUARTER_FINAL:
        pointsReason = PointsReason.CUP_QUARTER_FINAL;
        break;
      default:
        pointsReason = PointsReason.CUP_QUARTER_FINAL; // значение по умолчанию
    }

    await pool.execute(
      "INSERT INTO tournament_results (tournament_id, team_id, points_reason, cup, qualifying_wins) VALUES (?, ?, ?, ?, ?)",
      [tournamentId, result.teamId, pointsReason, result.cup, qualifying_wins]
    );

    // Собираем данные для batch вставки очков игроков
    const playerPointsBatch: Array<{
      playerId: number;
      tournamentId: number;
      points: number;
    }> = [];

    // Получаем всех игроков команды
    const [teamPlayers] = await pool.execute(
      "SELECT player_id FROM team_players WHERE team_id = ?",
      [result.teamId]
    );

    for (const teamPlayer of teamPlayers as any[]) {
      const playerId = teamPlayer.player_id;

      // Рассчитываем очки для игрока
      let playerPoints = 0;

      // Проверяем лицензию игрока
      const [licenseRows] = await pool.execute(
        `SELECT COUNT(*) as count FROM licensed_players
         WHERE year = YEAR(CURDATE()) AND is_active = TRUE
         AND player_id = ?`,
        [playerId]
      );
      const playerIsLicensed = (licenseRows as any[])[0]?.count > 0;

      if (playerIsLicensed) {
        if (result.cup) {
          // Игрок в кубке - получает очки за место в кубке
          playerPoints = getCupPoints(
            category,
            result.cup,
            result.position as any,
            totalTeams
          );
        } else {
          // Игрок не в кубке - получает очки за победы в швейцарке
          playerPoints = getWinsPoints(category, qualifying_wins);
        }
      }

      // Добавляем в batch, если очки больше 0
      if (playerPoints > 0) {
        playerPointsBatch.push({
          playerId,
          tournamentId,
          points: playerPoints,
        });
      }
    }

    // Выполняем batch вставку если есть данные
    if (playerPointsBatch.length > 0) {
      await PlayerTournamentPointsModel.createPlayerTournamentPointsBatch(
        playerPointsBatch
      );
    }
  }

  // Сохранение результата команды швейцарки
  static async saveSwissTeamResult(
    savedTeam: { teamId: number; players: string[] },
    tournamentId: number,
    teamWins: Map<string, number>,
    category: "1" | "2"
  ): Promise<boolean> {
    // Эта команда не в кубках, значит она в швейцарке
    let qualifying_wins = 0;
    const playerNames = savedTeam.players.join(", ");

    // Ищем победы для этой команды
    for (const [teamName, teamWinsCount] of teamWins.entries()) {
      let found = false;

      // Проверяем совпадение по именам игроков
      for (const playerName of savedTeam.players) {
        const cleanTeamName = teamName.replace(/[,\s]+$/, "").toLowerCase();
        const cleanPlayerName = playerName.toLowerCase();

        // Разбиваем имена на части для более точного сравнения
        const teamParts = cleanTeamName.split(" ");
        const playerParts = cleanPlayerName.split(" ");

        // Проверяем различные варианты совпадения
        let match = false;

        // 1. Точное совпадение
        if (cleanTeamName === cleanPlayerName) {
          match = true;
        }

        // 2. Совпадение по фамилии (первое слово)
        else if (teamParts[0] === playerParts[0]) {
          match = true;
        }

        // 3. Совпадение по фамилии, если в швейцарке только фамилия
        else if (
          teamParts.length === 1 &&
          playerParts.length >= 1 &&
          teamParts[0] === playerParts[0]
        ) {
          match = true;
        }

        if (match) {
          qualifying_wins = teamWinsCount;
          found = true;
          break;
        }
      }
      if (found) break;
    }

    // Проверяем лицензированность команды
    let isLicensed = false;
    const [licensedRow] = await pool.execute<any[]>(
      `SELECT COUNT(*) as licensed_count
       FROM teams t
       JOIN team_players tp ON t.id = tp.team_id
       JOIN players p ON tp.player_id = p.id
       LEFT JOIN licensed_players lp ON lp.player_id = p.id AND lp.is_active = 1
       WHERE t.id = ? AND lp.id IS NOT NULL`,
      [savedTeam.teamId]
    );
    isLicensed = licensedRow && licensedRow[0].licensed_count > 0;

    // Рассчитываем очки для швейцарки
    let points = 0;
    if (isLicensed && qualifying_wins > 0) {
      points = getWinsPoints(category, qualifying_wins);
    }

    // Сохраняем результат швейцарки только для команд с победами (qualifying_wins > 0)
    if (qualifying_wins > 0) {
      // Определяем причину получения очков в зависимости от количества побед
      let pointsReason;
      if (qualifying_wins >= 3) {
        pointsReason = "QUALIFYING_HIGH";
      } else {
        pointsReason = "QUALIFYING_LOW";
      }

      await pool.execute(
        "INSERT INTO tournament_results (tournament_id, team_id, points_reason, cup, qualifying_wins) VALUES (?, ?, ?, ?, ?)",
        [
          tournamentId,
          savedTeam.teamId,
          pointsReason,
          null, // не кубок
          qualifying_wins,
        ]
      );

      // Собираем данные для batch вставки очков игроков швейцарки
      const swissPlayerPointsBatch: Array<{
        playerId: number;
        tournamentId: number;
        points: number;
      }> = [];

      // Получаем всех игроков команды
      const [teamPlayers] = await pool.execute(
        "SELECT player_id FROM team_players WHERE team_id = ?",
        [savedTeam.teamId]
      );

      for (const teamPlayer of teamPlayers as any[]) {
        const playerId = teamPlayer.player_id;

        // Рассчитываем очки для игрока
        let playerPoints = 0;

        // Проверяем лицензию игрока
        const [licenseRows] = await pool.execute(
          `SELECT COUNT(*) as count FROM licensed_players
           WHERE year = YEAR(CURDATE()) AND is_active = TRUE
           AND player_id = ?`,
          [playerId]
        );
        const playerIsLicensed = (licenseRows as any[])[0]?.count > 0;

        // Игроки в швейцарке получают очки за победы (только лицензированные)
        if (playerIsLicensed && qualifying_wins > 0) {
          playerPoints = getWinsPoints(category, qualifying_wins);
        }

        // Добавляем в batch, если очки больше 0
        if (playerPoints > 0) {
          swissPlayerPointsBatch.push({
            playerId,
            tournamentId,
            points: playerPoints,
          });
        }
      }

      // Выполняем batch вставку если есть данные
      if (swissPlayerPointsBatch.length > 0) {
        await PlayerTournamentPointsModel.createPlayerTournamentPointsBatch(
          swissPlayerPointsBatch
        );
      }

      return true;
    }

    return false;
  }

  // Парсинг результатов кубков с использованием существующего соединения
  static async parseCupResultsFromDBWithConnection(
    workbook: XLSX.WorkBook,
    tournamentId: number,
    connection: any
  ): Promise<Array<{ teamId: number; cup: "A" | "B"; position: CupPosition }>> {
    const cupResults: Array<{
      teamId: number;
      cup: "A" | "B";
      position: CupPosition;
    }> = [];
    const cupNames = ["A", "B"] as const; // Обрабатываем только кубки A и B

    for (const cupName of cupNames) {
      const possibleSheetNames = [
        `Кубок ${cupName}`,
        `Кубок${cupName}`,
        `КУБОК ${cupName}`,
        cupName === "A" ? "Кубок А" : "Кубок Б",
      ];

      let worksheet = null;
      let foundSheetName = null;

      for (const possibleName of possibleSheetNames) {
        if (workbook.Sheets[possibleName]) {
          worksheet = workbook.Sheets[possibleName];
          foundSheetName = possibleName;
          break;
        }
      }

      if (!worksheet) {
        console.log(`Лист для кубка ${cupName} не найден, пропускаем`);
        continue;
      }

      console.log(`Найден лист кубка ${cupName}: "${foundSheetName}"`);

      const stages = {
        quarterFinals: [
          {
            cells: ["B4", "B8", "B12", "B16", "B20", "B24", "B28", "B32"],
            position: CupPosition.QUARTER_FINAL,
          },
        ],
        semiFinals: [
          {
            cells: ["F6", "F14", "F22", "F30"],
            position: CupPosition.SEMI_FINAL,
          },
        ],
        finals: [{ cells: ["J10", "J26"], position: CupPosition.RUNNER_UP }],
        thirdPlace: [{ range: "F38", position: CupPosition.THIRD_PLACE }],
      };

      const cupTeamResults: Array<{ teamId: number; position: CupPosition }> =
        [];
      const positionPriority: { [key: string]: number } = {
        [CupPosition.WINNER]: 5,
        [CupPosition.RUNNER_UP]: 4,
        [CupPosition.THIRD_PLACE]: 3,
        [CupPosition.SEMI_FINAL]: 2,
        [CupPosition.QUARTER_FINAL]: 1,
      };

      for (const [stageName, stageRanges] of Object.entries(stages)) {
        for (const stageInfo of stageRanges as any[]) {
          const cellsToProcess: string[] = [];

          if ("cells" in stageInfo) {
            cellsToProcess.push(...stageInfo.cells);
          } else if ("range" in stageInfo) {
            const range = XLSX.utils.decode_range(stageInfo.range);
            for (let row = range.s.r; row <= range.e.r; row++) {
              for (let col = range.s.c; col <= range.e.c; col++) {
                const cellAddress = XLSX.utils.encode_cell({ r: row, c: col });
                cellsToProcess.push(cellAddress);
              }
            }
          }

          for (const cellAddress of cellsToProcess) {
            const cell = worksheet[cellAddress];
            if (cell && cell.v && typeof cell.v === "string" && cell.v.trim()) {
              const playerName = cell.v.trim();

              // Ищем команду по имени игрока через новую структуру team_players (с частичным совпадением)
              const [teamResult] = (await connection.execute(
                `
                SELECT t.id as team_id 
                FROM teams t
                JOIN team_players tp ON t.id = tp.team_id
                JOIN players p ON tp.player_id = p.id
                WHERE p.name LIKE ? OR p.name LIKE ?
                LIMIT 1
              `,
                [`%${playerName}%`, `${playerName}%`]
              )) as any;

              if (teamResult.length > 0) {
                const teamId = teamResult[0].team_id;
                console.log(
                  `✓ Найдена команда ${teamId} для игрока "${playerName}" в позиции ${stageInfo.position}`
                );

                const existingResultIndex = cupTeamResults.findIndex(
                  (r) => r.teamId === teamId
                );

                if (existingResultIndex !== -1) {
                  const existingPriority =
                    positionPriority[
                      cupTeamResults[existingResultIndex].position
                    ] || 0;
                  const newPriority = positionPriority[stageInfo.position] || 0;

                  if (newPriority > existingPriority) {
                    console.log(
                      `✓ Обновляем позицию команды ${teamId} с ${cupTeamResults[existingResultIndex].position} на ${stageInfo.position}`
                    );
                    cupTeamResults[existingResultIndex].position =
                      stageInfo.position;
                  }
                } else {
                  cupTeamResults.push({ teamId, position: stageInfo.position });
                  console.log(
                    `✓ Добавляем результат для команды ${teamId}: ${stageInfo.position}`
                  );
                }
              } else {
                console.log(`⚠️ Команда для игрока "${playerName}" не найдена`);
              }
            }
          }
        }
      }

      // Определяем победителя из ячейки N18
      try {
        const winnerCell = worksheet["N18"];
        if (
          winnerCell &&
          winnerCell.v &&
          typeof winnerCell.v === "string" &&
          winnerCell.v.trim()
        ) {
          const winnerPlayerName = winnerCell.v.trim();
          const [winnerTeamResult] = (await connection.execute(
            `
            SELECT t.id as team_id 
            FROM teams t
            JOIN team_players tp ON t.id = tp.team_id
            JOIN players p ON tp.player_id = p.id
            WHERE p.name LIKE ? OR p.name LIKE ?
            LIMIT 1
          `,
            [`%${winnerPlayerName}%`, `${winnerPlayerName}%`]
          )) as any;

          if (winnerTeamResult.length > 0) {
            const winnerTeamId = winnerTeamResult[0].team_id;
            console.log(
              `🏆 Найден победитель кубка ${cupName}: команда ${winnerTeamId} (игрок "${winnerPlayerName}")`
            );

            // Ищем команду победителя в результатах и устанавливаем позицию WINNER
            const winnerTeamIndex = cupTeamResults.findIndex(
              (r) => r.teamId === winnerTeamId
            );
            if (winnerTeamIndex !== -1) {
              cupTeamResults[winnerTeamIndex].position = CupPosition.WINNER;
            } else {
              cupTeamResults.push({
                teamId: winnerTeamId,
                position: CupPosition.WINNER,
              });
            }
          } else {
            console.log(
              `⚠️ Команда победителя "${winnerPlayerName}" не найдена в кубке ${cupName}`
            );
          }
        } else {
          console.log(
            `⚠️ Ячейка N18 пуста или не содержит данных о победителе в кубке ${cupName}`
          );
        }
      } catch (error) {
        console.warn(
          `Ошибка при чтении ячейки победителя для кубка ${cupName}: ${
            (error as Error).message
          }`
        );
      }

      cupTeamResults.forEach((result) => {
        cupResults.push({
          teamId: result.teamId,
          cup: cupName,
          position: result.position,
        });
      });
    }

    return cupResults;
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

  // Парсинг XLSX файла с командными турнирами (включает кубки A и B) - Express endpoint
  static async parseTournamentWithTeams(req: Request, res: Response) {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: "Файл не загружен",
      });
    }

    try {
      // Получаем имя турнира и дату из URL параметров или используем дефолтные
      const tournamentName = "Турнир кубков";
      const originalName = req.file.originalname.replace(/\.xlsx?$/i, "");
      const dateMatch = originalName.match(/(\d{4})/);
      const tournamentDate = dateMatch
        ? `${dateMatch[1]}-01-01`
        : new Date().toISOString().split("T")[0];

      // Парсим данные турнира
      const parseData = this.parseTournamentData(
        req.file.buffer,
        req.file.originalname,
        tournamentName,
        tournamentDate
      );

      // Сохраняем в базу данных
      const tournamentId = await TournamentModel.uploadTournamentData(
        parseData
      );

      res.json({
        success: true,
        message: `Данные турнира с командами успешно загружены. Обработано команд: ${parseData.total_teams}, результатов игроков: ${parseData.results.length}. Категория турнира: ${parseData.tournament_category}.`,
        data: {
          tournament_id: tournamentId,
          teams_count: parseData.total_teams,
          total_teams: parseData.total_teams,
          tournament_category: parseData.tournament_category,
          player_results_count: parseData.results.length,
          tournament_name: parseData.tournament_name,
          tournament_date: parseData.tournament_date,
        },
      });
    } catch (error) {
      console.error("Ошибка при парсинге файла турнира с командами:", error);
      res.status(500).json({
        success: false,
        message: "Ошибка при обработке файла: " + (error as Error).message,
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

  // Парсинг листа "Итоги Швейцарки" для извлечения количества побед команд
  static parseSwissSystemResults(workbook: XLSX.WorkBook): Map<string, number> {
    // Пробуем различные варианты названий листа "Итоги Швейцарки"
    const possibleSwissSheetNames = [
      "Итоги Швейцарки",
      "Итоги швейцарки",
      "ИТОГИ ШВЕЙЦАРКИ",
      "Итоги Швейцарской системы",
      "Швейцарская система",
      "Швейцарка",
      "Swiss",
      "Swiss System",
    ];

    let swissSheet = null;
    let foundSheetName = null;

    // Проверяем все возможные варианты названий
    for (const possibleName of possibleSwissSheetNames) {
      if (workbook.Sheets[possibleName]) {
        swissSheet = workbook.Sheets[possibleName];
        foundSheetName = possibleName;
        break;
      }
    }

    if (!swissSheet) {
      console.log(
        `Лист "Итоги Швейцарки" не найден. Проверенные варианты: ${possibleSwissSheetNames.join(
          ", "
        )}. Доступные листы: ${workbook.SheetNames.join(", ")}`
      );
      return new Map(); // Возвращаем пустую карту, если лист не найден
    }

    console.log(`Найден лист швейцарской системы: "${foundSheetName}"`);

    try {
      // Парсим данные из листа
      const swissData = XLSX.utils.sheet_to_json(swissSheet, {
        header: 1,
      });

      const teamWins = new Map<string, number>();

      // Начинаем обработку со строки 2 (индекс 1), так как в B2 начинаются команды
      // В таблице: A=Место, B=Имя, C=Результат(победы), D=Бхгц, E=Прогресс, F=Детал
      for (let rowIndex = 1; rowIndex < swissData.length; rowIndex++) {
        const row = swissData[rowIndex] as any[];

        if (!row || row.length < 3) continue;

        // Столбец B (индекс 1) - название команды
        // Столбец C (индекс 2) - количество побед (результат)
        const teamName =
          typeof row[1] === "string"
            ? row[1].replace(/,?$/, "").trim()
            : row[1];
        const winsValue = row[2];

        if (!teamName || teamName === "" || typeof teamName !== "string") {
          continue; // Пропускаем пустые строки
        }

        // Парсим количество побед
        let qualifying_wins = 0;

        if (typeof winsValue === "number") {
          qualifying_wins = Math.floor(winsValue); // Округляем до целого числа
        } else if (typeof winsValue === "string") {
          const parsed = parseInt(winsValue, 10);
          qualifying_wins = isNaN(parsed) ? 0 : parsed;
        } else if (winsValue === undefined || winsValue === null) {
          qualifying_wins = 0;
        }

        // Нормализуем название команды для поиска
        const normalizedTeamName = teamName.toString().trim();

        if (normalizedTeamName) {
          teamWins.set(normalizedTeamName, qualifying_wins);
          console.log(
            `Найдена команда "${normalizedTeamName}" с ${qualifying_wins} побед(ами)`
          );
        }
      }

      console.log(
        `Обработано ${teamWins.size} команд из листа "${foundSheetName}"`
      );
      return teamWins;
    } catch (error) {
      console.error(`Ошибка при парсинге листа "${foundSheetName}":`, error);
      return new Map(); // Возвращаем пустую карту при ошибке
    }
  }

  // ========== МЕТОДЫ ДЛЯ РАБОТЫ С GOOGLE SHEETS ==========

  /**
   * Загрузка и парсинг турнира из Google Sheets
   */
  static async parseTournamentFromGoogleSheets(
    googleSheetsUrl: string,
    tournamentName: string,
    tournamentDate: string
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
      return await this.parseTournamentDataWithDB(
        Buffer.alloc(0), // Пустой buffer, так как мы используем workbook напрямую
        fileName,
        tournamentName,
        tournamentDate,
        workbook // Передаем готовый workbook
      );
    } catch (error) {
      console.error("Ошибка при загрузке турнира из Google Sheets:", error);
      throw new Error(
        `Не удалось загрузить турнир из Google таблицы: ${
          (error as Error).message
        }`
      );
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
