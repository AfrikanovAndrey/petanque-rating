import { Request, Response } from "express";
import multer from "multer";
import { RowDataPacket, ResultSetHeader } from "mysql2/promise";
import * as XLSX from "xlsx";
import { pool } from "../config/database";
import { AuthRequest } from "../middleware/auth";
import { LicensedPlayerModel } from "../models/LicensedPlayerModel";
import { PlayerModel } from "../models/PlayerModel";
import { TeamModel } from "../models/TeamModel";
import { TournamentModel } from "../models/TournamentModel";
import { TournamentRegistrationModel } from "../models/TournamentRegistrationModel";
import { TournamentGroupMatchModel } from "../models/TournamentGroupMatchModel";
import { TournamentCupMatchModel } from "../models/TournamentCupMatchModel";
import { TournamentSwissMatchModel } from "../models/TournamentSwissMatchModel";
import { UserModel } from "../models/UserModel";
import {
  buildGroupStageViews,
  validateMatchScores,
} from "../services/groupStageService";
import {
  appendSwissFreeSeedIfOdd,
  buildSwissStageView,
  isRoundComplete,
  isSwissFreeTeamId,
  nextCourtStart,
  pairNextRoundByScoreGroups,
  pairRound1HalfMethod,
  seedTeamsByExplicitOrder,
  seedTeamsByRating,
  validateSwissSeedOrder,
  type SwissMatchScores,
  type SwissMatchView,
  type SwissSeedEntry,
} from "../services/swissStageService";
import { computeTeamRatingsForSwiss } from "../services/swissTeamRating";
import { getPoints } from "../config/cupPoints";
import {
  allocateCups,
  buildAbResultQualified,
  buildAllCupFixtures,
  generateBracketFixtures,
  parseCupStageConfig,
  rankTeamsFromGroups,
  rankTeamsFromSwiss,
  resolveCupThirdPlace,
  resolveManualCupAllocation,
  validateCupStageConfig,
  type CupBracketCode,
  type ManualCupPoolsInput,
  type QualifiedTeam,
} from "../services/cupStageService";
import {
  areCupMatchesComplete,
  cupSizeForTeam,
  cupWinsLosesModifiers,
  deriveCupPlacements,
} from "../services/cupFinishService";
import { loadPlayStageSnapshot } from "../services/tournamentStageViews";
import {
  performGroupDraw,
  validateManualGroupDraw,
  validatePlaySettings,
  type TournamentPlaySettingsInput,
} from "../services/tournamentPlaySettings";
import {
  Cup,
  CupPosition,
  CupStageConfig,
  LicensedPlayerUploadData,
  TiebreakerCriterion,
  TournamentCategoryEnum,
  TournamentGroupDrawGroup,
  TournamentPlayFormat,
  TournamentStatus,
  TournamentType,
  UserRole,
} from "../types";
import { parseRegistrationCsv } from "../utils/registrationCsv";
import {
  getExpectedSlotCount,
  legacyPlayerIdsToRequestSlots,
} from "../utils/registrationRosterUtils";
import { TournamentController } from "./TournamentController";
import { TournamentParser } from "./TournamentParser";
import type { TournamentCupMatchRow } from "../models/TournamentCupMatchModel";
import type { RegisteredTeamRow } from "../models/TournamentRegistrationModel";

// Настройка multer для загрузки файлов
const storage = multer.memoryStorage();
const upload = multer({
  storage,
  fileFilter: (req, file, cb) => {
    // Разрешаем только Excel файлы
    const allowedMimes = [
      "application/vnd.ms-excel",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    ];
    if (allowedMimes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error("Разрешены только Excel файлы (.xls, .xlsx)"));
    }
  },
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB
  },
});

// Настройка multer для текстовых файлов
const textUpload = multer({
  storage: multer.memoryStorage(),
  fileFilter: (req, file, cb) => {
    // Разрешаем текстовые файлы
    const allowedMimes = ["text/plain"];
    const allowedExtensions = [".txt"];
    const fileExtension = file.originalname.toLowerCase().slice(-4);

    if (
      allowedMimes.includes(file.mimetype) ||
      allowedExtensions.includes(fileExtension)
    ) {
      cb(null, true);
    } else {
      cb(new Error("Разрешены только текстовые файлы (.txt)"));
    }
  },
  limits: {
    fileSize: 2 * 1024 * 1024, // 2MB
  },
});

export const uploadMiddleware = upload.single("tournament_file");
export const licensedPlayersUploadMiddleware = upload.single(
  "licensed_players_file"
);
export const playersTextUploadMiddleware = textUpload.single("players_file");

const registrationCsvUpload = multer({
  storage: multer.memoryStorage(),
  fileFilter: (_req, file, cb) => {
    const name = file.originalname.toLowerCase();
    const okExt = name.endsWith(".csv") || name.endsWith(".txt");
    const okMime =
      file.mimetype === "text/csv" ||
      file.mimetype === "text/plain" ||
      file.mimetype === "application/vnd.ms-excel" ||
      file.mimetype === "application/octet-stream" ||
      file.mimetype === "";
    if (okExt || okMime) {
      cb(null, true);
    } else {
      cb(new Error("Разрешены только CSV-файлы (.csv)"));
    }
  },
  limits: {
    fileSize: 2 * 1024 * 1024,
  },
});

export const registrationCsvUploadMiddleware = registrationCsvUpload.single(
  "registration_csv"
);

export class AdminController {
  /** Статусы, в которых можно подтверждать/менять/добавлять заявки. */
  private static isRegistrationEditableStatus(
    status: TournamentStatus | string,
  ): boolean {
    return (
      status === TournamentStatus.REGISTRATION ||
      status === TournamentStatus.FINAL_REGISTRATION
    );
  }

  /** Проверка состава команды по типу турнира (игроки уже загружены из БД). */
  private static validateRegistrationRoster(
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

  // Загрузка результатов турнира из Google Sheets
  static async uploadTournamentFromGoogleSheets(
    req: Request,
    res: Response
  ): Promise<void> {
    try {
      const {
        tournament_name,
        tournament_date,
        tournament_type,
        tournament_category,
        google_sheets_url,
      } = req.body;

      if (
        !tournament_name ||
        !tournament_date ||
        !tournament_type ||
        !google_sheets_url
      ) {
        res.status(400).json({
          success: false,
          message:
            "Название, дата, тип турнира и ссылка на Google таблицу обязательны",
        });
        return;
      }

      // Валидируем URL Google Sheets
      if (!google_sheets_url.includes("docs.google.com/spreadsheets")) {
        res.status(400).json({
          success: false,
          message: "Неверный формат ссылки на Google таблицу",
        });
        return;
      }

      console.log(`🔗 Загружаем турнир из Google Sheets: ${google_sheets_url}`);

      const requestedCategory =
        tournament_category === "2" || tournament_category === 2
          ? TournamentCategoryEnum.REGIONAL
          : TournamentCategoryEnum.FEDERAL;

      const result = await TournamentController.parseTournamentFromGoogleSheets(
        google_sheets_url,
        tournament_name,
        tournament_date,
        tournament_type as TournamentType,
        requestedCategory,
        {
          organizerUserId: (req as AuthRequest).userId ?? null,
        }
      );

      res.json({
        success: true,
        message: `Турнир "${tournament_name}" успешно загружен из Google таблицы. Обработано команд: ${result.teamsCount}, результатов кубков: ${result.resultsCount}.`,
        tournament_id: result.tournamentId,
        results_count: result.resultsCount,
      });
    } catch (error) {
      console.error("Ошибка загрузки турнира из Google Sheets:", error);

      // Определяем тип ошибки для более информативного сообщения
      let errorMessage = (error as Error).message;
      let statusCode = 500;

      if (errorMessage.includes("Критические ошибки")) {
        statusCode = 400;
        // Сохраняем оригинальное сообщение для критических ошибок
        // Оно уже содержит детальную информацию в нужном формате
      } else if (errorMessage.includes("имеет неполное имя")) {
        // Ошибка валидации имени игрока - форматируем как критическую
        statusCode = 400;
        errorMessage = `Критические ошибки в именах игроков (Лист регистрации):\n${errorMessage}`;
      } else if (
        errorMessage.includes("недоступна") ||
        errorMessage.includes("доступ")
      ) {
        statusCode = 400;
        errorMessage = `Ошибка доступа к Google таблице: ${errorMessage}. 
        Убедитесь, что таблица открыта для общего доступа на чтение.`;
      } else if (errorMessage.includes("Не найден лист регистрации")) {
        statusCode = 400;
        errorMessage = `Ошибка структуры таблицы: ${errorMessage}. 
        Убедитесь, что в Google таблице есть лист с названием "Лист регистрации", "Регистрация" или аналогичным, 
        содержащий данные команд в формате: номер команды, игрок 1, игрок 2, игрок 3, игрок 4.`;
      } else if (
        errorMessage.includes(
          "Не удалось загрузить данные турнира из Google таблицы"
        )
      ) {
        statusCode = 400;
        errorMessage = `Таблица повреждена или имеет неверный формат: ${errorMessage}. 
        Проверьте, что Google таблица содержит корректные данные и доступна для чтения.`;
      } else if (errorMessage.includes("пуст или не содержит данных")) {
        statusCode = 400;
        errorMessage = `Таблица не содержит данных для обработки: ${errorMessage}. 
        Убедитесь, что листы таблицы содержат данные команд и результатов турнира.`;
      } else if (errorMessage.includes("Ошибка при парсинге")) {
        statusCode = 400;
        errorMessage = `Ошибка структуры данных: ${errorMessage}. 
        Проверьте формат данных в Google таблице и убедитесь, что все обязательные поля заполнены корректно.`;
      }

      res.status(statusCode).json({
        success: false,
        message: errorMessage,
      });
    }
  }

  // Загрузка результатов турнира из Excel файла
  static async uploadTournament(req: Request, res: Response): Promise<void> {
    try {
      if (!req.file) {
        res.status(400).json({
          success: false,
          message: "Файл не был загружен",
        });
        return;
      }

      const {
        tournament_name,
        tournament_date,
        tournament_type,
        tournament_category,
      } = req.body;

      if (!tournament_name || !tournament_date || !tournament_type) {
        res.status(400).json({
          success: false,
          message: "Название, дата и тип турнира обязательны",
        });
        return;
      }

      // Проверяем и валидируем категорию турнира (но парсинг также может определить её из файла)
      const requestedCategory = tournament_category === "2" ? 2 : 1;
      console.log(`Запрошенная категория турнира: ${requestedCategory}`);

      // Используем новый алгоритм парсинга с сохранением в БД
      const result = await TournamentController.parseTournamentData(
        req.file.buffer,
        req.file.originalname,
        tournament_name,
        tournament_date,
        tournament_type,
        requestedCategory,
        undefined,
        {
          organizerUserId: (req as AuthRequest).userId ?? null,
        }
      );

      res.json({
        success: true,
        message: `Турнир "${tournament_name}" успешно загружен. Обработано команд: ${result.teamsCount}, результатов кубков: ${result.resultsCount}.`,
        tournament_id: result.tournamentId,
        results_count: result.resultsCount,
      });
    } catch (error) {
      console.error("Ошибка загрузки турнира:", error);

      // Определяем тип ошибки для более информативного сообщения
      let errorMessage = (error as Error).message;
      let statusCode = 500;

      if (errorMessage.includes("Критические ошибки")) {
        statusCode = 400;
        // Сохраняем оригинальное сообщение для критических ошибок
        // Оно уже содержит детальную информацию в нужном формате
      } else if (errorMessage.includes("имеет неполное имя")) {
        // Ошибка валидации имени игрока - форматируем как критическую
        statusCode = 400;
        errorMessage = `Критические ошибки в именах игроков (Лист регистрации):\n${errorMessage}`;
      } else if (errorMessage.includes("Не найден лист регистрации")) {
        statusCode = 400;
        errorMessage = `Ошибка структуры файла: ${errorMessage}. 
        Убедитесь, что в Excel файле есть лист с названием "Лист регистрации", "Регистрация" или аналогичным, 
        содержащий данные команд в формате: номер команды, игрок 1, игрок 2, игрок 3, игрок 4.`;
      } else if (errorMessage.includes("Ошибка при чтении Excel файла")) {
        statusCode = 400;
        errorMessage = `Файл поврежден или имеет неверный формат: ${errorMessage}. 
        Проверьте, что файл является корректным Excel файлом (.xlsx или .xls).`;
      } else if (errorMessage.includes("пуст или не содержит данных")) {
        statusCode = 400;
        errorMessage = `Файл не содержит данных для обработки: ${errorMessage}. 
        Убедитесь, что листы файла содержат данные команд и результатов турнира.`;
      }

      res.status(statusCode).json({
        success: false,
        message: errorMessage,
      });
    }
  }

  /**
   * Завершить турнир «в процессе»: загрузить Excel с результатами в ту же запись турнира.
   */
  static async completeInProgressTournamentFromExcel(
    req: Request,
    res: Response
  ): Promise<void> {
    try {
      if (!req.file) {
        res.status(400).json({
          success: false,
          message: "Файл не был загружен",
        });
        return;
      }

      const tournamentId = parseInt(req.params.tournamentId, 10);
      if (Number.isNaN(tournamentId) || tournamentId <= 0) {
        res.status(400).json({
          success: false,
          message: "Неверный ID турнира",
        });
        return;
      }

      const tournament = await TournamentModel.getTournamentById(tournamentId);
      if (!tournament) {
        res.status(404).json({
          success: false,
          message: "Турнир не найден",
        });
        return;
      }

      if (tournament.status !== TournamentStatus.IN_PROGRESS) {
        res.status(400).json({
          success: false,
          message:
            "Загрузка результатов в эту запись доступна только для турниров в статусе «В процессе»",
        });
        return;
      }

      const catRaw = String(tournament.category).toUpperCase();
      const requestedCategory =
        catRaw === "REGIONAL" || catRaw === "2"
          ? TournamentCategoryEnum.REGIONAL
          : TournamentCategoryEnum.FEDERAL;

      const rawTournamentDate = tournament.date as unknown;
      const dateStr =
        rawTournamentDate instanceof Date
          ? `${rawTournamentDate.getFullYear()}-${String(
              rawTournamentDate.getMonth() + 1
            ).padStart(2, "0")}-${String(rawTournamentDate.getDate()).padStart(
              2,
              "0"
            )}`
          : String(rawTournamentDate).slice(0, 10);

      const result = await TournamentController.parseTournamentData(
        req.file.buffer,
        req.file.originalname,
        tournament.name,
        dateStr,
        tournament.type as TournamentType,
        requestedCategory,
        undefined,
        { existingTournamentId: tournamentId }
      );

      res.json({
        success: true,
        message: `Результаты загружены, турнир завершён. Обработано команд: ${result.teamsCount}.`,
        tournament_id: result.tournamentId,
        results_count: result.resultsCount,
      });
    } catch (error) {
      console.error("Ошибка завершения турнира по файлу:", error);

      let errorMessage = (error as Error).message;
      let statusCode = 500;

      if (errorMessage.includes("Критические ошибки")) {
        statusCode = 400;
      } else if (errorMessage.includes("имеет неполное имя")) {
        statusCode = 400;
        errorMessage = `Критические ошибки в именах игроков (Лист регистрации):\n${errorMessage}`;
      } else if (errorMessage.includes("Не найден лист регистрации")) {
        statusCode = 400;
        errorMessage = `Ошибка структуры файла: ${errorMessage}. 
        Убедитесь, что в Excel файле есть лист с названием "Лист регистрации", "Регистрация" или аналогичным, 
        содержащий данные команд в формате: номер команды, игрок 1, игрок 2, игрок 3, игрок 4.`;
      } else if (errorMessage.includes("Ошибка при чтении Excel файла")) {
        statusCode = 400;
        errorMessage = `Файл поврежден или имеет неверный формат: ${errorMessage}. 
        Проверьте, что файл является корректным Excel файлом (.xlsx или .xls).`;
      } else if (errorMessage.includes("пуст или не содержит данных")) {
        statusCode = 400;
        errorMessage = `Файл не содержит данных для обработки: ${errorMessage}. 
        Убедитесь, что листы файла содержат данные команд и результатов турнира.`;
      } else if (
        errorMessage.includes("не совпадает") ||
        errorMessage.includes("доступна только в статусе")
      ) {
        statusCode = 400;
      }

      res.status(statusCode).json({
        success: false,
        message: errorMessage,
      });
    }
  }

  /**
   * Завершить турнир «в процессе»: загрузить результаты из Google Таблицы в ту же запись.
   */
  static async completeInProgressTournamentFromGoogleSheets(
    req: Request,
    res: Response
  ): Promise<void> {
    try {
      const tournamentId = parseInt(req.params.tournamentId, 10);
      if (Number.isNaN(tournamentId) || tournamentId <= 0) {
        res.status(400).json({
          success: false,
          message: "Неверный ID турнира",
        });
        return;
      }

      const { google_sheets_url } = req.body as { google_sheets_url?: unknown };
      if (
        typeof google_sheets_url !== "string" ||
        !google_sheets_url.trim()
      ) {
        res.status(400).json({
          success: false,
          message: "Укажите ссылку на Google таблицу",
        });
        return;
      }

      const url = google_sheets_url.trim();
      if (!url.includes("docs.google.com/spreadsheets")) {
        res.status(400).json({
          success: false,
          message: "Неверный формат ссылки на Google таблицу",
        });
        return;
      }

      const tournament = await TournamentModel.getTournamentById(tournamentId);
      if (!tournament) {
        res.status(404).json({
          success: false,
          message: "Турнир не найден",
        });
        return;
      }

      if (tournament.status !== TournamentStatus.IN_PROGRESS) {
        res.status(400).json({
          success: false,
          message:
            "Загрузка результатов в эту запись доступна только для турниров в статусе «В процессе»",
        });
        return;
      }

      const catRaw = String(tournament.category).toUpperCase();
      const requestedCategory =
        catRaw === "REGIONAL" || catRaw === "2"
          ? TournamentCategoryEnum.REGIONAL
          : TournamentCategoryEnum.FEDERAL;

      const rawTournamentDate = tournament.date as unknown;
      const dateStr =
        rawTournamentDate instanceof Date
          ? `${rawTournamentDate.getFullYear()}-${String(
              rawTournamentDate.getMonth() + 1
            ).padStart(2, "0")}-${String(rawTournamentDate.getDate()).padStart(
              2,
              "0"
            )}`
          : String(rawTournamentDate).slice(0, 10);

      console.log(
        `🔗 Завершение турнира ${tournamentId} из Google Sheets: ${url}`
      );

      const result = await TournamentController.parseTournamentFromGoogleSheets(
        url,
        tournament.name,
        dateStr,
        tournament.type as TournamentType,
        requestedCategory,
        { existingTournamentId: tournamentId }
      );

      res.json({
        success: true,
        message: `Результаты из Google таблицы загружены, турнир завершён. Обработано команд: ${result.teamsCount}.`,
        tournament_id: result.tournamentId,
        results_count: result.resultsCount,
      });
    } catch (error) {
      console.error("Ошибка завершения турнира из Google Sheets:", error);

      let errorMessage = (error as Error).message;
      let statusCode = 500;

      if (errorMessage.includes("Критические ошибки")) {
        statusCode = 400;
      } else if (errorMessage.includes("имеет неполное имя")) {
        statusCode = 400;
        errorMessage = `Критические ошибки в именах игроков (Лист регистрации):\n${errorMessage}`;
      } else if (
        errorMessage.includes("недоступна") ||
        errorMessage.includes("доступ")
      ) {
        statusCode = 400;
        errorMessage = `Ошибка доступа к Google таблице: ${errorMessage}. 
        Убедитесь, что таблица открыта для общего доступа на чтение.`;
      } else if (errorMessage.includes("Не найден лист регистрации")) {
        statusCode = 400;
        errorMessage = `Ошибка структуры таблицы: ${errorMessage}. 
        Убедитесь, что в Google таблице есть лист с названием "Лист регистрации", "Регистрация" или аналогичным, 
        содержащий данные команд в формате: номер команды, игрок 1, игрок 2, игрок 3, игрок 4.`;
      } else if (
        errorMessage.includes(
          "Не удалось загрузить данные турнира из Google таблицы"
        )
      ) {
        statusCode = 400;
        errorMessage = `Таблица повреждена или имеет неверный формат: ${errorMessage}. 
        Проверьте, что Google таблица содержит корректные данные и доступна для чтения.`;
      } else if (errorMessage.includes("пуст или не содержит данных")) {
        statusCode = 400;
        errorMessage = `Таблица не содержит данных для обработки: ${errorMessage}. 
        Убедитесь, что листы таблицы содержат данные команд и результатов турнира.`;
      } else if (errorMessage.includes("Ошибка при парсинге")) {
        statusCode = 400;
        errorMessage = `Ошибка структуры данных: ${errorMessage}. 
        Проверьте формат данных в Google таблице и убедитесь, что все обязательные поля заполнены корректно.`;
      } else if (
        errorMessage.includes("не совпадает") ||
        errorMessage.includes("доступна только в статусе")
      ) {
        statusCode = 400;
      }

      res.status(statusCode).json({
        success: false,
        message: errorMessage,
      });
    }
  }

  /**
   * Заменить результаты завершённого турнира: удалить все строки результатов и записать заново из Excel.
   */
  static async replaceFinishedTournamentResultsFromExcel(
    req: Request,
    res: Response
  ): Promise<void> {
    try {
      if (!req.file) {
        res.status(400).json({
          success: false,
          message: "Файл не был загружен",
        });
        return;
      }

      const tournamentId = parseInt(req.params.tournamentId, 10);
      if (Number.isNaN(tournamentId) || tournamentId <= 0) {
        res.status(400).json({
          success: false,
          message: "Неверный ID турнира",
        });
        return;
      }

      const tournament = await TournamentModel.getTournamentById(tournamentId);
      if (!tournament) {
        res.status(404).json({
          success: false,
          message: "Турнир не найден",
        });
        return;
      }

      if (tournament.status !== TournamentStatus.FINISHED) {
        res.status(400).json({
          success: false,
          message:
            "Замена результатов доступна только для турниров в статусе «Завершён»",
        });
        return;
      }

      const catRaw = String(tournament.category).toUpperCase();
      const requestedCategory =
        catRaw === "REGIONAL" || catRaw === "2"
          ? TournamentCategoryEnum.REGIONAL
          : TournamentCategoryEnum.FEDERAL;

      const rawTournamentDate = tournament.date as unknown;
      const dateStr =
        rawTournamentDate instanceof Date
          ? `${rawTournamentDate.getFullYear()}-${String(
              rawTournamentDate.getMonth() + 1
            ).padStart(2, "0")}-${String(rawTournamentDate.getDate()).padStart(
              2,
              "0"
            )}`
          : String(rawTournamentDate).slice(0, 10);

      const result = await TournamentController.parseTournamentData(
        req.file.buffer,
        req.file.originalname,
        tournament.name,
        dateStr,
        tournament.type as TournamentType,
        requestedCategory,
        undefined,
        {
          existingTournamentId: tournamentId,
          replaceFinishedResults: true,
        }
      );

      res.json({
        success: true,
        message: `Результаты турнира полностью заменены. Обработано команд: ${result.teamsCount}.`,
        tournament_id: result.tournamentId,
        results_count: result.resultsCount,
      });
    } catch (error) {
      console.error("Ошибка замены результатов завершённого турнира:", error);

      let errorMessage = (error as Error).message;
      let statusCode = 500;

      if (errorMessage.includes("Критические ошибки")) {
        statusCode = 400;
      } else if (errorMessage.includes("имеет неполное имя")) {
        statusCode = 400;
        errorMessage = `Критические ошибки в именах игроков (Лист регистрации):\n${errorMessage}`;
      } else if (errorMessage.includes("Не найден лист регистрации")) {
        statusCode = 400;
        errorMessage = `Ошибка структуры файла: ${errorMessage}. 
        Убедитесь, что в Excel файле есть лист с названием "Лист регистрации", "Регистрация" или аналогичным, 
        содержащий данные команд в формате: номер команды, игрок 1, игрок 2, игрок 3, игрок 4.`;
      } else if (errorMessage.includes("Ошибка при чтении Excel файла")) {
        statusCode = 400;
        errorMessage = `Файл поврежден или имеет неверный формат: ${errorMessage}. 
        Проверьте, что файл является корректным Excel файлом (.xlsx или .xls).`;
      } else if (errorMessage.includes("пуст или не содержит данных")) {
        statusCode = 400;
        errorMessage = `Файл не содержит данных для обработки: ${errorMessage}. 
        Убедитесь, что листы файла содержат данные команд и результатов турнира.`;
      } else if (
        errorMessage.includes("не совпадает") ||
        errorMessage.includes("только для завершённых турниров")
      ) {
        statusCode = 400;
      }

      res.status(statusCode).json({
        success: false,
        message: errorMessage,
      });
    }
  }

  /**
   * Заменить результаты завершённого турнира из Google Таблицы.
   */
  static async replaceFinishedTournamentResultsFromGoogleSheets(
    req: Request,
    res: Response
  ): Promise<void> {
    try {
      const tournamentId = parseInt(req.params.tournamentId, 10);
      if (Number.isNaN(tournamentId) || tournamentId <= 0) {
        res.status(400).json({
          success: false,
          message: "Неверный ID турнира",
        });
        return;
      }

      const { google_sheets_url } = req.body as { google_sheets_url?: unknown };
      if (
        typeof google_sheets_url !== "string" ||
        !google_sheets_url.trim()
      ) {
        res.status(400).json({
          success: false,
          message: "Укажите ссылку на Google таблицу",
        });
        return;
      }

      const url = google_sheets_url.trim();
      if (!url.includes("docs.google.com/spreadsheets")) {
        res.status(400).json({
          success: false,
          message: "Неверный формат ссылки на Google таблицу",
        });
        return;
      }

      const tournament = await TournamentModel.getTournamentById(tournamentId);
      if (!tournament) {
        res.status(404).json({
          success: false,
          message: "Турнир не найден",
        });
        return;
      }

      if (tournament.status !== TournamentStatus.FINISHED) {
        res.status(400).json({
          success: false,
          message:
            "Замена результатов доступна только для турниров в статусе «Завершён»",
        });
        return;
      }

      const catRaw = String(tournament.category).toUpperCase();
      const requestedCategory =
        catRaw === "REGIONAL" || catRaw === "2"
          ? TournamentCategoryEnum.REGIONAL
          : TournamentCategoryEnum.FEDERAL;

      const rawTournamentDate = tournament.date as unknown;
      const dateStr =
        rawTournamentDate instanceof Date
          ? `${rawTournamentDate.getFullYear()}-${String(
              rawTournamentDate.getMonth() + 1
            ).padStart(2, "0")}-${String(rawTournamentDate.getDate()).padStart(
              2,
              "0"
            )}`
          : String(rawTournamentDate).slice(0, 10);

      console.log(
        `🔗 Замена результатов завершённого турнира ${tournamentId} из Google Sheets: ${url}`
      );

      const result = await TournamentController.parseTournamentFromGoogleSheets(
        url,
        tournament.name,
        dateStr,
        tournament.type as TournamentType,
        requestedCategory,
        {
          existingTournamentId: tournamentId,
          replaceFinishedResults: true,
        }
      );

      res.json({
        success: true,
        message: `Результаты турнира полностью заменены данными из Google таблицы. Обработано команд: ${result.teamsCount}.`,
        tournament_id: result.tournamentId,
        results_count: result.resultsCount,
      });
    } catch (error) {
      console.error(
        "Ошибка замены результатов завершённого турнира из Google Sheets:",
        error
      );

      let errorMessage = (error as Error).message;
      let statusCode = 500;

      if (errorMessage.includes("Критические ошибки")) {
        statusCode = 400;
      } else if (errorMessage.includes("имеет неполное имя")) {
        statusCode = 400;
        errorMessage = `Критические ошибки в именах игроков (Лист регистрации):\n${errorMessage}`;
      } else if (
        errorMessage.includes("недоступна") ||
        errorMessage.includes("доступ")
      ) {
        statusCode = 400;
        errorMessage = `Ошибка доступа к Google таблице: ${errorMessage}. 
        Убедитесь, что таблица открыта для общего доступа на чтение.`;
      } else if (errorMessage.includes("Не найден лист регистрации")) {
        statusCode = 400;
        errorMessage = `Ошибка структуры таблицы: ${errorMessage}. 
        Убедитесь, что в Google таблице есть лист с названием "Лист регистрации", "Регистрация" или аналогичным, 
        содержащий данные команд в формате: номер команды, игрок 1, игрок 2, игрок 3, игрок 4.`;
      } else if (
        errorMessage.includes(
          "Не удалось загрузить данные турнира из Google таблицы"
        )
      ) {
        statusCode = 400;
        errorMessage = `Таблица повреждена или имеет неверный формат: ${errorMessage}. 
        Проверьте, что Google таблица содержит корректные данные и доступна для чтения.`;
      } else if (errorMessage.includes("пуст или не содержит данных")) {
        statusCode = 400;
        errorMessage = `Таблица не содержит данных для обработки: ${errorMessage}. 
        Убедитесь, что листы таблицы содержат данные команд и результатов турнира.`;
      } else if (errorMessage.includes("Ошибка при парсинге")) {
        statusCode = 400;
        errorMessage = `Ошибка структуры данных: ${errorMessage}. 
        Проверьте формат данных в Google таблице и убедитесь, что все обязательные поля заполнены корректно.`;
      } else if (
        errorMessage.includes("не совпадает") ||
        errorMessage.includes("только для завершённых турниров")
      ) {
        statusCode = 400;
      }

      res.status(statusCode).json({
        success: false,
        message: errorMessage,
      });
    }
  }

  // Получить все турниры (админ)
  static async getTournaments(req: Request, res: Response): Promise<void> {
    try {
      const tournaments = await TournamentModel.getAllTournaments();
      res.json({
        success: true,
        data: tournaments,
      });
    } catch (error) {
      console.error("Ошибка получения турниров:", error);
      res.status(500).json({
        success: false,
        message: "Ошибка получения турниров",
      });
    }
  }

  /**
   * Создать турнир без загрузки результатов (ручной турнир с регламентом).
   * Доступно для ADMIN и MANAGER.
   */
  static async createTournament(req: Request, res: Response): Promise<void> {
    try {
      const authReq = req as AuthRequest;
      const { name, date, type, category, regulations } = req.body;

      if (!name || typeof name !== "string" || !name.trim()) {
        res.status(400).json({
          success: false,
          message: "Название турнира обязательно",
        });
        return;
      }

      if (!date || typeof date !== "string") {
        res.status(400).json({
          success: false,
          message: "Дата проведения обязательна",
        });
        return;
      }

      if (!type || typeof type !== "string") {
        res.status(400).json({
          success: false,
          message: "Тип турнира обязателен",
        });
        return;
      }

      const allowedTypes = Object.values(TournamentType) as string[];
      if (!allowedTypes.includes(type)) {
        res.status(400).json({
          success: false,
          message: "Недопустимый тип турнира",
        });
        return;
      }

      const categoryEnum =
        category === "1" || category === 1
          ? TournamentCategoryEnum.FEDERAL
          : category === "2" || category === 2
            ? TournamentCategoryEnum.REGIONAL
            : null;

      if (categoryEnum === null) {
        res.status(400).json({
          success: false,
          message: "Укажите категорию турнира (1 или 2)",
        });
        return;
      }

      const regulationsText =
        regulations !== undefined && regulations !== null
          ? String(regulations).trim() || null
          : null;

      const tournamentId = await TournamentModel.createTournament(
        name.trim(),
        type as TournamentType,
        categoryEnum,
        date,
        true,
        undefined,
        regulationsText,
        TournamentStatus.DRAFT,
        authReq.userId ?? null,
      );

      res.status(201).json({
        success: true,
        message: "Турнир создан",
        data: { id: tournamentId },
      });
    } catch (error) {
      console.error("Ошибка создания турнира:", error);
      res.status(500).json({
        success: false,
        message: "Ошибка создания турнира",
      });
    }
  }

  // Получить турнир с результатами (админ)
  static async getTournamentDetails(
    req: Request,
    res: Response
  ): Promise<void> {
    try {
      const tournamentId = parseInt(req.params.tournamentId);

      if (isNaN(tournamentId)) {
        res.status(400).json({
          success: false,
          message: "Неверный ID турнира",
        });
        return;
      }

      const tournamentData = await TournamentModel.getTournamentWithResults(
        tournamentId
      );

      if (!tournamentData) {
        res.status(404).json({
          success: false,
          message: "Турнир не найден",
        });
        return;
      }

      res.json({
        success: true,
        data: tournamentData,
      });
    } catch (error) {
      console.error("Ошибка получения деталей турнира:", error);
      res.status(500).json({
        success: false,
        message: "Ошибка получения деталей турнира",
      });
    }
  }

  /** Признание результатов турнира для учёта в рейтинге (ADMIN и член президиума). */
  static async validateTournamentResults(
    req: Request,
    res: Response,
  ): Promise<void> {
    try {
      const tournamentId = parseInt(req.params.tournamentId, 10);
      if (Number.isNaN(tournamentId) || tournamentId <= 0) {
        res.status(400).json({
          success: false,
          message: "Неверный ID турнира",
        });
        return;
      }

      const tournament = await TournamentModel.getTournamentById(tournamentId);
      if (!tournament) {
        res.status(404).json({
          success: false,
          message: "Турнир не найден",
        });
        return;
      }

      if (tournament.status !== TournamentStatus.FINISHED) {
        res.status(400).json({
          success: false,
          message: "Признание доступно только для завершённых турниров",
        });
        return;
      }

      const teamsCount =
        await TournamentModel.getTournamentTeamsCount(tournamentId);
      if (teamsCount === 0) {
        res.status(400).json({
          success: false,
          message: "Нет загруженных результатов для признания",
        });
        return;
      }

      await TournamentModel.markResultsValidated(tournamentId);
      res.json({
        success: true,
        message: "Результаты турнира признаны и учитываются в рейтинге",
      });
    } catch (error) {
      console.error("Ошибка признания результатов турнира:", error);
      res.status(500).json({
        success: false,
        message: "Ошибка признания результатов турнира",
      });
    }
  }

  /**
   * Данные страницы регистрации / финальной регистрации + список записанных команд.
   */
  static async getTournamentRegistrationPage(
    req: Request,
    res: Response,
  ): Promise<void> {
    try {
      const tournamentId = parseInt(req.params.tournamentId);

      if (isNaN(tournamentId)) {
        res.status(400).json({
          success: false,
          message: "Неверный ID турнира",
        });
        return;
      }

      const tournament = await TournamentModel.getTournamentById(tournamentId);
      if (!tournament) {
        res.status(404).json({
          success: false,
          message: "Турнир не найден",
        });
        return;
      }

      if (!AdminController.isRegistrationEditableStatus(tournament.status)) {
        res.status(400).json({
          success: false,
          message:
            "Страница доступна только для турниров в статусе «Регистрация» или «Финальная регистрация»",
        });
        return;
      }

      const teams = TournamentRegistrationModel.annotatePlayersInOtherTeams(
        await TournamentRegistrationModel.listRegisteredTeamsWithPlayers(
          tournamentId,
          tournament.type as TournamentType,
        ),
      );

      res.json({
        success: true,
        data: {
          tournament,
          teams,
        },
      });
    } catch (error) {
      console.error("Ошибка страницы регистрации турнира:", error);
      res.status(500).json({
        success: false,
        message: "Ошибка загрузки данных регистрации",
      });
    }
  }

  /**
   * Черновик турнира: параметры и описание без списка заявок (статус DRAFT).
   */
  static async getTournamentDraftPage(
    req: Request,
    res: Response,
  ): Promise<void> {
    try {
      const tournamentId = parseInt(req.params.tournamentId);

      if (isNaN(tournamentId)) {
        res.status(400).json({
          success: false,
          message: "Неверный ID турнира",
        });
        return;
      }

      const tournament = await TournamentModel.getTournamentById(tournamentId);
      if (!tournament) {
        res.status(404).json({
          success: false,
          message: "Турнир не найден",
        });
        return;
      }

      if (tournament.status !== TournamentStatus.DRAFT) {
        res.status(400).json({
          success: false,
          message:
            "Страница черновика доступна только для турниров в статусе «Черновик»",
        });
        return;
      }

      res.json({
        success: true,
        data: {
          tournament,
          teams: [],
        },
      });
    } catch (error) {
      console.error("Ошибка страницы черновика турнира:", error);
      res.status(500).json({
        success: false,
        message: "Ошибка загрузки черновика",
      });
    }
  }

  /**
   * Снимок заявок на турнир в статусе IN_PROGRESS: те же данные, что на странице регистрации, без редактирования заявок.
   */
  static async getTournamentInProgressPage(
    req: Request,
    res: Response,
  ): Promise<void> {
    try {
      const tournamentId = parseInt(req.params.tournamentId);

      if (isNaN(tournamentId)) {
        res.status(400).json({
          success: false,
          message: "Неверный ID турнира",
        });
        return;
      }

      const tournament = await TournamentModel.getTournamentById(tournamentId);
      if (!tournament) {
        res.status(404).json({
          success: false,
          message: "Турнир не найден",
        });
        return;
      }

      if (tournament.status !== TournamentStatus.IN_PROGRESS) {
        res.status(400).json({
          success: false,
          message:
            "Эта страница доступна только для турниров в статусе «В процессе»",
        });
        return;
      }

      const teams =
        await TournamentRegistrationModel.listRegisteredTeamsWithPlayers(
          tournamentId,
          tournament.type as TournamentType,
        );

      let groups: ReturnType<typeof buildGroupStageViews> = [];
      if (
        tournament.play_format === TournamentPlayFormat.GROUPS &&
        tournament.group_draw &&
        tournament.group_draw.length > 0
      ) {
        let matchCount =
          await TournamentGroupMatchModel.countByTournament(tournamentId);
        if (matchCount === 0) {
          await TournamentGroupMatchModel.regenerateFromDraw(
            tournamentId,
            tournament.group_draw,
          );
        }
        const matches =
          await TournamentGroupMatchModel.listByTournament(tournamentId);
        groups = buildGroupStageViews(
          tournament.group_draw,
          teams,
          matches,
        );
      }

      let swiss: ReturnType<typeof buildSwissStageView> | null = null;
      if (tournament.play_format === TournamentPlayFormat.SWISS) {
        const swissCount =
          await TournamentSwissMatchModel.countByTournament(tournamentId);
        if (swissCount === 0) {
          const confirmed = teams.filter((t) => t.is_confirmed);
          if (confirmed.length > 0) {
            await AdminController.ensureSwissRound1(
              tournamentId,
              confirmed,
              tournament.type as TournamentType,
            );
            const refreshed =
              await TournamentModel.getTournamentById(tournamentId);
            if (refreshed?.swiss_seed) {
              tournament.swiss_seed = refreshed.swiss_seed;
            }
          }
        }
        swiss = await AdminController.buildSwissViewForTournament(
          tournamentId,
          tournament.swiss_seed ?? null,
          tournament.swiss_rounds ?? 0,
          teams,
          tournament.tiebreaker_order ?? [],
        );
      }

      let cups: ReturnType<typeof AdminController.buildCupStageViews> = [];
      const cupCount =
        await TournamentCupMatchModel.countByTournament(tournamentId);
      if (cupCount > 0) {
        let cupMatches =
          await TournamentCupMatchModel.listByTournament(tournamentId);
        const cupsToSync = [
          ...new Set(cupMatches.map((m) => m.cup)),
        ] as CupBracketCode[];
        for (const cup of cupsToSync) {
          await AdminController.syncThirdPlaceFromSemis(tournamentId, cup);
        }
        cupMatches =
          await TournamentCupMatchModel.listByTournament(tournamentId);
        cups = AdminController.buildCupStageViews(cupMatches, teams);
      }

      res.json({
        success: true,
        data: {
          tournament,
          teams,
          groups,
          swiss,
          cups,
        },
      });
    } catch (error) {
      console.error("Ошибка страницы «турнир в процессе»:", error);
      res.status(500).json({
        success: false,
        message: "Ошибка загрузки данных",
      });
    }
  }

  /**
   * Страница завершённого турнира: сведения, заявки, итоги кубков.
   */
  static async getTournamentFinishedPage(
    req: Request,
    res: Response,
  ): Promise<void> {
    try {
      const tournamentId = parseInt(req.params.tournamentId, 10);
      if (Number.isNaN(tournamentId) || tournamentId <= 0) {
        res.status(400).json({
          success: false,
          message: "Неверный ID турнира",
        });
        return;
      }

      const tournament = await TournamentModel.getTournamentById(tournamentId);
      if (!tournament) {
        res.status(404).json({
          success: false,
          message: "Турнир не найден",
        });
        return;
      }

      if (tournament.status !== TournamentStatus.FINISHED) {
        res.status(400).json({
          success: false,
          message: "Эта страница доступна только для завершённых турниров",
        });
        return;
      }

      const teams =
        await TournamentRegistrationModel.listRegisteredTeamsWithPlayers(
          tournamentId,
          tournament.type as TournamentType,
        );

      const results = await TournamentModel.getTournamentResults(tournamentId);
      const filteredResults = results.filter((result) => result.cup);
      const positionPriority: Record<string, number> = {
        WINNER: 1,
        "1": 1,
        RUNNER_UP: 2,
        "2": 2,
        THIRD_PLACE: 3,
        "3": 3,
        ROUND_OF_4: 4,
        "1/2": 4,
        ROUND_OF_8: 5,
        "1/4": 5,
        ROUND_OF_16: 6,
        "1/8": 6,
      };
      const sortedResults = filteredResults.sort((a, b) => {
        if (a.cup !== b.cup) {
          return (a.cup || "").localeCompare(b.cup || "");
        }
        const aPriority = a.cup_position
          ? positionPriority[a.cup_position] || 999
          : 999;
        const bPriority = b.cup_position
          ? positionPriority[b.cup_position] || 999
          : 999;
        return aPriority - bPriority;
      });

      const { groups, swiss, cups } = await loadPlayStageSnapshot(
        tournament,
        teams,
      );

      res.json({
        success: true,
        data: {
          tournament,
          teams,
          results: sortedResults,
          groups,
          swiss,
          cups,
        },
      });
    } catch (error) {
      console.error("Ошибка страницы завершённого турнира:", error);
      res.status(500).json({
        success: false,
        message: "Ошибка загрузки данных",
      });
    }
  }

  /**
   * Обновить счёт матча группового этапа.
   * Тело: { score_a, score_b } или { clear: true }; опционально court.
   */
  static async updateTournamentGroupMatch(
    req: Request,
    res: Response,
  ): Promise<void> {
    try {
      const tournamentId = parseInt(req.params.tournamentId, 10);
      const matchId = parseInt(req.params.matchId, 10);
      if (isNaN(tournamentId) || isNaN(matchId)) {
        res.status(400).json({
          success: false,
          message: "Неверный ID турнира или матча",
        });
        return;
      }

      const tournament = await TournamentModel.getTournamentById(tournamentId);
      if (!tournament) {
        res.status(404).json({
          success: false,
          message: "Турнир не найден",
        });
        return;
      }
      if (tournament.status !== TournamentStatus.IN_PROGRESS) {
        res.status(400).json({
          success: false,
          message: "Счёт можно менять только в статусе «В процессе»",
        });
        return;
      }
      if (tournament.play_format !== TournamentPlayFormat.GROUPS) {
        res.status(400).json({
          success: false,
          message: "Матчи групп доступны только для группового формата",
        });
        return;
      }

      const cupCount =
        await TournamentCupMatchModel.countByTournament(tournamentId);
      if (cupCount > 0) {
        res.status(400).json({
          success: false,
          message:
            "После начала финала групповой этап нельзя изменять. Сбросьте финал, чтобы править группы.",
        });
        return;
      }

      const match = await TournamentGroupMatchModel.getById(matchId);
      if (!match || match.tournament_id !== tournamentId) {
        res.status(404).json({
          success: false,
          message: "Матч не найден",
        });
        return;
      }

      const body = req.body as {
        score_a?: unknown;
        score_b?: unknown;
        clear?: unknown;
        court?: unknown;
      };

      let scoreA: number | null = match.score_a;
      let scoreB: number | null = match.score_b;

      if (body.clear === true) {
        scoreA = null;
        scoreB = null;
      } else if (body.score_a !== undefined || body.score_b !== undefined) {
        const validated = validateMatchScores(body.score_a, body.score_b);
        if (typeof validated === "string") {
          res.status(400).json({ success: false, message: validated });
          return;
        }
        scoreA = validated.score_a;
        scoreB = validated.score_b;
      } else if (body.court === undefined) {
        res.status(400).json({
          success: false,
          message: "Укажите score_a и score_b, clear или court",
        });
        return;
      }

      let court: number | null | undefined = undefined;
      if (body.court !== undefined) {
        if (body.court === null) {
          court = null;
        } else {
          const c =
            typeof body.court === "number"
              ? body.court
              : parseInt(String(body.court), 10);
          if (!Number.isInteger(c) || c < 1 || c > 99) {
            res.status(400).json({
              success: false,
              message: "Номер дорожки должен быть от 1 до 99",
            });
            return;
          }
          court = c;
        }
      }

      const saved = await TournamentGroupMatchModel.updateScores(
        matchId,
        scoreA,
        scoreB,
        court,
      );
      if (!saved) {
        res.status(400).json({
          success: false,
          message: "Не удалось обновить матч",
        });
        return;
      }

      const teams =
        await TournamentRegistrationModel.listRegisteredTeamsWithPlayers(
          tournamentId,
          tournament.type as TournamentType,
        );
      const matches =
        await TournamentGroupMatchModel.listByTournament(tournamentId);
      const groups = buildGroupStageViews(
        tournament.group_draw ?? [],
        teams,
        matches,
      );

      res.json({
        success: true,
        message: "Матч обновлён",
        data: { groups },
      });
    } catch (error) {
      console.error("Ошибка обновления матча группы:", error);
      res.status(500).json({
        success: false,
        message: "Внутренняя ошибка сервера",
      });
    }
  }

  /** Сиды + тур 1 швейцарки (пересоздаёт матчи). */
  private static async ensureSwissRound1(
    tournamentId: number,
    teams: Array<{ team_id: number; player_ids: number[] }>,
    tournamentType: TournamentType,
    options: {
      useRating?: boolean;
      seedOrder?: number[];
    } = {},
  ): Promise<SwissSeedEntry[]> {
    const useRating = options.useRating !== false;
    const ratings = await computeTeamRatingsForSwiss(
      teams.map((t) => ({
        team_id: t.team_id,
        player_ids: t.player_ids,
      })),
      tournamentType,
    );
    const teamsWithRating = teams.map((t) => ({
      team_id: t.team_id,
      rating: ratings.get(t.team_id) ?? 0,
    }));

    let baseSeeds: SwissSeedEntry[];
    if (useRating) {
      baseSeeds = seedTeamsByRating(teamsWithRating);
    } else {
      const order = options.seedOrder ?? [];
      const orderError = validateSwissSeedOrder(
        order,
        teams.map((t) => t.team_id),
      );
      if (orderError) {
        throw new Error(orderError);
      }
      baseSeeds = seedTeamsByExplicitOrder(teamsWithRating, order);
    }

    const seeds = appendSwissFreeSeedIfOdd(baseSeeds);
    await TournamentModel.saveSwissSeed(tournamentId, seeds);
    await TournamentSwissMatchModel.deleteByTournament(tournamentId);
    const fixtures = pairRound1HalfMethod(seeds);
    await TournamentSwissMatchModel.insertFixtures(tournamentId, fixtures);
    return seeds;
  }

  private static swissRowsToViews(
    rows: Awaited<ReturnType<typeof TournamentSwissMatchModel.listByTournament>>,
  ): SwissMatchView[] {
    return rows.map((m) => ({
      id: m.id,
      round_number: m.round_number,
      team_a_id: m.team_a_id,
      team_b_id: m.team_b_id,
      score_a: m.score_a,
      score_b: m.score_b,
      is_bye: m.is_bye,
      court: m.court,
    }));
  }

  private static swissRowsToScores(
    rows: Awaited<ReturnType<typeof TournamentSwissMatchModel.listByTournament>>,
  ): SwissMatchScores[] {
    return rows.map((m) => ({
      team_a_id: m.team_a_id,
      team_b_id: m.team_b_id,
      score_a: m.score_a,
      score_b: m.score_b,
      is_bye: m.is_bye,
      round_number: m.round_number,
    }));
  }

  private static async buildSwissViewForTournament(
    tournamentId: number,
    swissSeed: SwissSeedEntry[] | null,
    swissRounds: number,
    teams: RegisteredTeamRow[],
    tiebreakerOrder: TiebreakerCriterion[] | null | undefined = [],
  ) {
    if (!swissSeed?.length || swissRounds < 1) {
      return null;
    }
    const rows = await TournamentSwissMatchModel.listByTournament(tournamentId);
    return buildSwissStageView(
      swissSeed,
      teams,
      AdminController.swissRowsToViews(rows),
      swissRounds,
      tiebreakerOrder,
    );
  }

  /**
   * Обновить счёт матча швейцарки.
   * После последнего результата тура автоматически формирует пары следующего.
   */
  static async updateTournamentSwissMatch(
    req: Request,
    res: Response,
  ): Promise<void> {
    try {
      const tournamentId = parseInt(req.params.tournamentId, 10);
      const matchId = parseInt(req.params.matchId, 10);
      if (isNaN(tournamentId) || isNaN(matchId)) {
        res.status(400).json({
          success: false,
          message: "Неверный ID турнира или матча",
        });
        return;
      }

      const tournament = await TournamentModel.getTournamentById(tournamentId);
      if (!tournament) {
        res.status(404).json({
          success: false,
          message: "Турнир не найден",
        });
        return;
      }
      if (tournament.status !== TournamentStatus.IN_PROGRESS) {
        res.status(400).json({
          success: false,
          message: "Счёт можно менять только в статусе «В процессе»",
        });
        return;
      }
      if (tournament.play_format !== TournamentPlayFormat.SWISS) {
        res.status(400).json({
          success: false,
          message: "Матчи швейцарки доступны только для формата SWISS",
        });
        return;
      }
      if (!tournament.swiss_seed?.length || !tournament.swiss_rounds) {
        res.status(400).json({
          success: false,
          message: "Сиды швейцарки не сформированы",
        });
        return;
      }

      const cupCount =
        await TournamentCupMatchModel.countByTournament(tournamentId);
      if (cupCount > 0) {
        res.status(400).json({
          success: false,
          message:
            "После начала финала швейцарку нельзя изменять. Сбросьте финал.",
        });
        return;
      }

      const match = await TournamentSwissMatchModel.getById(matchId);
      if (!match || match.tournament_id !== tournamentId) {
        res.status(404).json({
          success: false,
          message: "Матч не найден",
        });
        return;
      }
      if (match.is_bye) {
        res.status(400).json({
          success: false,
          message: "Bye нельзя редактировать",
        });
        return;
      }

      const body = req.body as {
        score_a?: unknown;
        score_b?: unknown;
        clear?: unknown;
        court?: unknown;
      };

      let scoreA: number | null = match.score_a;
      let scoreB: number | null = match.score_b;
      const scoreChanging =
        body.clear === true ||
        body.score_a !== undefined ||
        body.score_b !== undefined;

      if (scoreChanging) {
        const allMatches =
          await TournamentSwissMatchModel.listByTournament(tournamentId);
        const laterExists = allMatches.some(
          (m) => m.round_number > match.round_number,
        );
        if (laterExists) {
          // Каскад: удалить последующие туры при правке счёта
          await TournamentSwissMatchModel.deleteRoundsFrom(
            tournamentId,
            match.round_number + 1,
          );
        }
      }

      if (body.clear === true) {
        scoreA = null;
        scoreB = null;
      } else if (body.score_a !== undefined || body.score_b !== undefined) {
        const validated = validateMatchScores(body.score_a, body.score_b);
        if (typeof validated === "string") {
          res.status(400).json({ success: false, message: validated });
          return;
        }
        scoreA = validated.score_a;
        scoreB = validated.score_b;
      } else if (body.court === undefined) {
        res.status(400).json({
          success: false,
          message: "Укажите score_a и score_b, clear или court",
        });
        return;
      }

      let court: number | null | undefined = undefined;
      if (body.court !== undefined) {
        if (body.court === null) {
          court = null;
        } else {
          const c =
            typeof body.court === "number"
              ? body.court
              : parseInt(String(body.court), 10);
          if (!Number.isInteger(c) || c < 1 || c > 99) {
            res.status(400).json({
              success: false,
              message: "Номер дорожки должен быть от 1 до 99",
            });
            return;
          }
          court = c;
        }
      }

      const saved = await TournamentSwissMatchModel.updateScores(
        matchId,
        scoreA,
        scoreB,
        court,
      );
      if (!saved) {
        res.status(400).json({
          success: false,
          message: "Не удалось обновить матч",
        });
        return;
      }

      let rows = await TournamentSwissMatchModel.listByTournament(tournamentId);
      const scoreRows = AdminController.swissRowsToScores(rows);
      const swissRounds = tournament.swiss_rounds;
      const currentRound = match.round_number;

      if (
        scoreChanging &&
        scoreA != null &&
        scoreB != null &&
        isRoundComplete(scoreRows, currentRound) &&
        currentRound < swissRounds
      ) {
        const nextRound = currentRound + 1;
        const nextExists = rows.some((m) => m.round_number === nextRound);
        if (!nextExists) {
          try {
            const fixtures = pairNextRoundByScoreGroups(
              tournament.swiss_seed,
              scoreRows,
              nextRound,
              nextCourtStart(rows),
            );
            await TournamentSwissMatchModel.insertFixtures(
              tournamentId,
              fixtures,
            );
            rows =
              await TournamentSwissMatchModel.listByTournament(tournamentId);
          } catch (pairError) {
            console.error("Ошибка паринга следующего тура швейцарки:", pairError);
            res.status(400).json({
              success: false,
              message:
                pairError instanceof Error
                  ? pairError.message
                  : "Не удалось сформировать пары следующего тура",
            });
            return;
          }
        }
      }

      const teams =
        await TournamentRegistrationModel.listRegisteredTeamsWithPlayers(
          tournamentId,
          tournament.type as TournamentType,
        );
      const swiss = buildSwissStageView(
        tournament.swiss_seed,
        teams,
        AdminController.swissRowsToViews(rows),
        swissRounds,
        tournament.tiebreaker_order,
      );

      res.json({
        success: true,
        message: "Матч обновлён",
        data: { swiss },
      });
    } catch (error) {
      console.error("Ошибка обновления матча швейцарки:", error);
      res.status(500).json({
        success: false,
        message: "Внутренняя ошибка сервера",
      });
    }
  }

  /**
   * Откат швейцарки к предыдущему туру: удаляет указанный тур и все последующие.
   * Счета более ранних туров сохраняются для корректировки.
   */
  static async rollbackSwissRound(
    req: Request,
    res: Response,
  ): Promise<void> {
    try {
      const tournamentId = parseInt(req.params.tournamentId, 10);
      const fromRound = parseInt(req.params.roundNumber, 10);
      if (
        isNaN(tournamentId) ||
        isNaN(fromRound) ||
        fromRound < 2
      ) {
        res.status(400).json({
          success: false,
          message: "Укажите турнир и номер тура начиная со 2-го",
        });
        return;
      }

      const tournament = await TournamentModel.getTournamentById(tournamentId);
      if (!tournament) {
        res.status(404).json({
          success: false,
          message: "Турнир не найден",
        });
        return;
      }
      if (tournament.status !== TournamentStatus.IN_PROGRESS) {
        res.status(400).json({
          success: false,
          message: "Откат доступен только в статусе «В процессе»",
        });
        return;
      }
      if (tournament.play_format !== TournamentPlayFormat.SWISS) {
        res.status(400).json({
          success: false,
          message: "Откат доступен только для швейцарки",
        });
        return;
      }
      if (!tournament.swiss_seed?.length || !tournament.swiss_rounds) {
        res.status(400).json({
          success: false,
          message: "Сиды швейцарки не сформированы",
        });
        return;
      }

      const cupCount =
        await TournamentCupMatchModel.countByTournament(tournamentId);
      if (cupCount > 0) {
        res.status(400).json({
          success: false,
          message:
            "После начала финала швейцарку нельзя изменять. Сбросьте финал.",
        });
        return;
      }

      const rowsBefore =
        await TournamentSwissMatchModel.listByTournament(tournamentId);
      const maxRound = rowsBefore.reduce(
        (max, m) => Math.max(max, m.round_number),
        0,
      );
      if (fromRound > maxRound) {
        res.status(400).json({
          success: false,
          message: `Тур ${fromRound} ещё не сформирован`,
        });
        return;
      }

      await TournamentSwissMatchModel.deleteRoundsFrom(
        tournamentId,
        fromRound,
      );

      const rows =
        await TournamentSwissMatchModel.listByTournament(tournamentId);
      const teams =
        await TournamentRegistrationModel.listRegisteredTeamsWithPlayers(
          tournamentId,
          tournament.type as TournamentType,
        );
      const swiss = buildSwissStageView(
        tournament.swiss_seed,
        teams,
        AdminController.swissRowsToViews(rows),
        tournament.swiss_rounds,
        tournament.tiebreaker_order,
      );

      res.json({
        success: true,
        message: `Удалён тур ${fromRound}${maxRound > fromRound ? ` и последующие` : ""}. Можно править тур ${fromRound - 1}.`,
        data: { swiss },
      });
    } catch (error) {
      console.error("Ошибка отката тура швейцарки:", error);
      res.status(500).json({
        success: false,
        message: "Внутренняя ошибка сервера",
      });
    }
  }

  /**
   * Сформировать следующий тур швейцарки по итогам указанного завершённого тура
   * (если следующего ещё нет).
   */
  static async advanceSwissRound(
    req: Request,
    res: Response,
  ): Promise<void> {
    try {
      const tournamentId = parseInt(req.params.tournamentId, 10);
      const fromRound = parseInt(req.params.roundNumber, 10);
      if (isNaN(tournamentId) || isNaN(fromRound) || fromRound < 1) {
        res.status(400).json({
          success: false,
          message: "Укажите турнир и номер завершённого тура",
        });
        return;
      }

      const tournament = await TournamentModel.getTournamentById(tournamentId);
      if (!tournament) {
        res.status(404).json({
          success: false,
          message: "Турнир не найден",
        });
        return;
      }
      if (tournament.status !== TournamentStatus.IN_PROGRESS) {
        res.status(400).json({
          success: false,
          message: "Доступно только в статусе «В процессе»",
        });
        return;
      }
      if (tournament.play_format !== TournamentPlayFormat.SWISS) {
        res.status(400).json({
          success: false,
          message: "Доступно только для швейцарки",
        });
        return;
      }
      if (!tournament.swiss_seed?.length || !tournament.swiss_rounds) {
        res.status(400).json({
          success: false,
          message: "Сиды швейцарки не сформированы",
        });
        return;
      }
      if (fromRound >= tournament.swiss_rounds) {
        res.status(400).json({
          success: false,
          message: "Это последний запланированный тур",
        });
        return;
      }

      const cupCount =
        await TournamentCupMatchModel.countByTournament(tournamentId);
      if (cupCount > 0) {
        res.status(400).json({
          success: false,
          message:
            "После начала финала швейцарку нельзя изменять. Сбросьте финал.",
        });
        return;
      }

      let rows =
        await TournamentSwissMatchModel.listByTournament(tournamentId);
      const scoreRows = AdminController.swissRowsToScores(rows);
      if (!rows.some((m) => m.round_number === fromRound)) {
        res.status(400).json({
          success: false,
          message: `Тур ${fromRound} не найден`,
        });
        return;
      }
      if (!isRoundComplete(scoreRows, fromRound)) {
        res.status(400).json({
          success: false,
          message: `Сначала завершите все партии тура ${fromRound}`,
        });
        return;
      }

      const nextRound = fromRound + 1;
      if (rows.some((m) => m.round_number === nextRound)) {
        res.status(400).json({
          success: false,
          message: `Тур ${nextRound} уже сформирован`,
        });
        return;
      }

      try {
        const fixtures = pairNextRoundByScoreGroups(
          tournament.swiss_seed,
          scoreRows,
          nextRound,
          nextCourtStart(rows),
        );
        await TournamentSwissMatchModel.insertFixtures(
          tournamentId,
          fixtures,
        );
        rows = await TournamentSwissMatchModel.listByTournament(tournamentId);
      } catch (pairError) {
        console.error("Ошибка паринга следующего тура швейцарки:", pairError);
        res.status(400).json({
          success: false,
          message:
            pairError instanceof Error
              ? pairError.message
              : "Не удалось сформировать пары следующего тура",
        });
        return;
      }

      const teams =
        await TournamentRegistrationModel.listRegisteredTeamsWithPlayers(
          tournamentId,
          tournament.type as TournamentType,
        );
      const swiss = buildSwissStageView(
        tournament.swiss_seed,
        teams,
        AdminController.swissRowsToViews(rows),
        tournament.swiss_rounds,
        tournament.tiebreaker_order,
      );

      res.json({
        success: true,
        message: `Сформирован тур ${nextRound}`,
        data: { swiss },
      });
    } catch (error) {
      console.error("Ошибка перехода к следующему туру швейцарки:", error);
      res.status(500).json({
        success: false,
        message: "Внутренняя ошибка сервера",
      });
    }
  }

  private static buildCupStageViews(
    matches: TournamentCupMatchRow[],
    teams: RegisteredTeamRow[],
  ) {
    const teamById = new Map(teams.map((t) => [t.team_id, t]));
    const byCup = new Map<CupBracketCode, TournamentCupMatchRow[]>();
    for (const m of matches) {
      if (!byCup.has(m.cup)) {
        byCup.set(m.cup, []);
      }
      byCup.get(m.cup)!.push(m);
    }
    const order: CupBracketCode[] = ["AB", "A", "B", "C", "D"];
    return order
      .filter((cup) => byCup.has(cup))
      .map((cup) => ({
        cup,
        matches: (byCup.get(cup) ?? []).map((m) => ({
          id: m.id,
          round_number: m.round_number,
          match_index: m.match_index,
          team_a_id: m.team_a_id,
          team_b_id: m.team_b_id,
          team_a_players: m.team_a_id
            ? teamById.get(m.team_a_id)?.players ?? []
            : [],
          team_b_players: m.team_b_id
            ? teamById.get(m.team_b_id)?.players ?? []
            : [],
          score_a: m.score_a,
          score_b: m.score_b,
          court: m.court,
          is_third_place: m.is_third_place,
        })),
      }));
  }

  private static collectQualifiedFromGroups(
    groups: ReturnType<typeof buildGroupStageViews>,
  ): QualifiedTeam[] {
    const qualified: QualifiedTeam[] = [];
    for (const g of groups) {
      for (const t of g.teams) {
        if (t.place <= 0) {
          continue;
        }
        qualified.push({
          team_id: t.team_id,
          group_number: g.group_number,
          place: t.place,
          wins: t.wins,
          point_diff: t.point_diff,
          points_for: t.points_for,
        });
      }
    }
    return qualified;
  }

  private static async advanceCupWinner(
    match: TournamentCupMatchRow,
    winnerId: number | null,
    loserId: number | null,
  ): Promise<void> {
    if (
      winnerId != null &&
      match.next_match_round != null &&
      match.next_match_index != null &&
      match.next_slot
    ) {
      const next = await TournamentCupMatchModel.findSlot(
        match.tournament_id,
        match.cup,
        match.next_match_round,
        match.next_match_index,
        false,
      );
      if (next) {
        await TournamentCupMatchModel.setTeamSlot(
          next.id,
          match.next_slot,
          winnerId,
        );
      }
    }

    if (loserId == null || match.is_third_place) {
      return;
    }

    let loserRound = match.loser_next_match_round;
    let loserIndex = match.loser_next_match_index;
    let loserSlot = match.loser_next_slot;

    // Fallback: полуфинал без loser_next_* (старые сетки на 4 команды)
    if (
      loserRound == null &&
      match.next_match_round != null &&
      match.next_match_index != null
    ) {
      const next = await TournamentCupMatchModel.findSlot(
        match.tournament_id,
        match.cup,
        match.next_match_round,
        match.next_match_index,
        false,
      );
      if (next && next.next_match_round == null) {
        const third = await TournamentCupMatchModel.findSlot(
          match.tournament_id,
          match.cup,
          match.next_match_round,
          0,
          true,
        );
        if (third) {
          loserRound = match.next_match_round;
          loserIndex = 0;
          loserSlot = match.match_index % 2 === 0 ? "a" : "b";
        }
      }
    }

    if (loserRound != null && loserIndex != null && loserSlot) {
      const third = await TournamentCupMatchModel.findSlot(
        match.tournament_id,
        match.cup,
        loserRound,
        loserIndex,
        true,
      );
      if (third) {
        await TournamentCupMatchModel.setTeamSlot(
          third.id,
          loserSlot,
          loserId,
        );
      }
    }
  }

  /** Заполнить слоты матча за 3-е из уже сыгранных полуфиналов. */
  private static async syncThirdPlaceFromSemis(
    tournamentId: number,
    cup: CupBracketCode,
  ): Promise<void> {
    const all = await TournamentCupMatchModel.listByTournament(tournamentId);
    const cupMatches = all.filter((m) => m.cup === cup);
    const third = cupMatches.find((m) => m.is_third_place);
    if (!third || third.score_a != null || third.score_b != null) {
      return;
    }

    const final = cupMatches.find(
      (m) =>
        !m.is_third_place &&
        m.round_number === third.round_number &&
        m.match_index === 0,
    );
    if (!final) {
      return;
    }

    const semis = cupMatches.filter(
      (m) =>
        !m.is_third_place &&
        m.next_match_round === final.round_number &&
        m.next_match_index === final.match_index,
    );

    let teamA: number | null = null;
    let teamB: number | null = null;
    for (const semi of semis) {
      if (
        semi.score_a == null ||
        semi.score_b == null ||
        semi.team_a_id == null ||
        semi.team_b_id == null
      ) {
        continue;
      }
      const loserId =
        semi.score_a > semi.score_b ? semi.team_b_id : semi.team_a_id;
      const slot: "a" | "b" =
        semi.loser_next_slot ?? (semi.match_index % 2 === 0 ? "a" : "b");
      if (slot === "a") {
        teamA = loserId;
      } else {
        teamB = loserId;
      }
    }

    await TournamentCupMatchModel.setTeamSlot(third.id, "a", teamA);
    await TournamentCupMatchModel.setTeamSlot(third.id, "b", teamB);
  }

  private static async maybeGenerateAbCups(
    tournamentId: number,
    config: CupStageConfig,
  ): Promise<void> {
    if (!config.ab_playoff || !config.pools?.AB) {
      return;
    }
    const all = await TournamentCupMatchModel.listByTournament(tournamentId);
    const abMatches = all.filter((m) => m.cup === "AB");
    if (abMatches.length === 0) {
      return;
    }
    if (
      abMatches.some(
        (m) =>
          m.score_a == null ||
          m.score_b == null ||
          m.team_a_id == null ||
          m.team_b_id == null,
      )
    ) {
      return;
    }
    if (all.some((m) => m.cup === "A" || m.cup === "B")) {
      return;
    }

    const { winners, losers } = buildAbResultQualified(
      abMatches.map((m) => ({
        match_index: m.match_index,
        team_a_id: m.team_a_id!,
        team_b_id: m.team_b_id!,
        score_a: m.score_a!,
        score_b: m.score_b!,
      })),
      config.pools.AB,
    );

    let court = Math.max(0, ...all.map((m) => m.court ?? 0)) + 1;
    const aFixtures = generateBracketFixtures("A", winners, court, {
      thirdPlace: resolveCupThirdPlace(config, "A"),
    });
    court += aFixtures.length;
    const bFixtures = generateBracketFixtures("B", losers, court, {
      thirdPlace: resolveCupThirdPlace(config, "B"),
    });
    await TournamentCupMatchModel.insertFixtures(tournamentId, [
      ...aFixtures,
      ...bFixtures,
    ]);

    await TournamentModel.saveCupStageConfig(tournamentId, {
      ...config,
      pools: {
        ...config.pools,
        A: winners,
        B: losers,
      },
    });
  }

  /** Старт финальной части: кубки A–D и опциональный стык AB. */
  static async startCupStage(req: Request, res: Response): Promise<void> {
    try {
      const tournamentId = parseInt(req.params.tournamentId, 10);
      if (isNaN(tournamentId)) {
        res.status(400).json({ success: false, message: "Неверный ID турнира" });
        return;
      }
      const tournament = await TournamentModel.getTournamentById(tournamentId);
      if (!tournament) {
        res.status(404).json({ success: false, message: "Турнир не найден" });
        return;
      }
      if (tournament.status !== TournamentStatus.IN_PROGRESS) {
        res.status(400).json({
          success: false,
          message: "Финал доступен только в статусе «В процессе»",
        });
        return;
      }

      const existing =
        await TournamentCupMatchModel.countByTournament(tournamentId);
      if (existing > 0) {
        res.status(400).json({
          success: false,
          message: "Финал уже начат. Сначала сбросьте кубковую сетку.",
        });
        return;
      }

      const raw = req.body as Record<string, unknown>;
      const config = parseCupStageConfig({
        a: raw.a ?? 8,
        b: raw.b ?? 0,
        c: raw.c ?? 0,
        d: raw.d ?? 0,
        ab_playoff: raw.ab_playoff ?? false,
        third_place: raw.third_place ?? true,
      });
      if (!config) {
        res.status(400).json({
          success: false,
          message: "Некорректный конфиг кубков",
        });
        return;
      }

      const teams =
        await TournamentRegistrationModel.listRegisteredTeamsWithPlayers(
          tournamentId,
          tournament.type as TournamentType,
        );

      let ranked: QualifiedTeam[];

      if (tournament.play_format === TournamentPlayFormat.GROUPS) {
        if (!tournament.group_draw?.length) {
          res.status(400).json({
            success: false,
            message: "Нет жеребьёвки групп",
          });
          return;
        }
        const groupMatches =
          await TournamentGroupMatchModel.listByTournament(tournamentId);
        const groups = buildGroupStageViews(
          tournament.group_draw,
          teams,
          groupMatches,
        );

        const allPlayed = groups.every(
          (g) =>
            g.matches.length > 0 &&
            g.matches.every((m) => m.score_a != null && m.score_b != null),
        );
        if (!allPlayed) {
          res.status(400).json({
            success: false,
            message: "Сначала введите результаты всех матчей группового этапа",
          });
          return;
        }

        ranked = rankTeamsFromGroups(
          AdminController.collectQualifiedFromGroups(groups),
        );
      } else if (tournament.play_format === TournamentPlayFormat.SWISS) {
        if (!tournament.swiss_seed?.length || !tournament.swiss_rounds) {
          res.status(400).json({
            success: false,
            message: "Швейцарка не сформирована",
          });
          return;
        }
        const swissMatches =
          await TournamentSwissMatchModel.listByTournament(tournamentId);
        const swiss = buildSwissStageView(
          tournament.swiss_seed,
          teams,
          AdminController.swissRowsToViews(swissMatches),
          tournament.swiss_rounds,
          tournament.tiebreaker_order,
        );
        if (swiss.completed_rounds < tournament.swiss_rounds) {
          res.status(400).json({
            success: false,
            message: `Сначала завершите все туры швейцарки (${swiss.completed_rounds} из ${tournament.swiss_rounds})`,
          });
          return;
        }
        ranked = rankTeamsFromSwiss(swiss.standings);
      } else {
        res.status(400).json({
          success: false,
          message: "Финал доступен после групп или швейцарки",
        });
        return;
      }

      const err = validateCupStageConfig(config, ranked.length);
      if (err) {
        res.status(400).json({ success: false, message: err });
        return;
      }

      let allocation: ReturnType<typeof allocateCups>;
      const rawManual = raw.manual_pools;
      if (rawManual != null) {
        if (typeof rawManual !== "object" || Array.isArray(rawManual)) {
          res.status(400).json({
            success: false,
            message: "Некорректное ручное распределение (manual_pools)",
          });
          return;
        }
        const manualObj = rawManual as Record<string, unknown>;
        const toIds = (key: string): number[] | undefined => {
          const value = manualObj[key];
          if (value === undefined || value === null) {
            return undefined;
          }
          if (!Array.isArray(value)) {
            return undefined;
          }
          return value.map((id) => Number(id));
        };
        const manual: ManualCupPoolsInput = {
          AB: toIds("AB"),
          A: toIds("A"),
          B: toIds("B"),
          C: toIds("C"),
          D: toIds("D"),
        };
        const resolved = resolveManualCupAllocation(ranked, config, manual);
        if (!resolved.ok) {
          res.status(400).json({ success: false, message: resolved.error });
          return;
        }
        allocation = resolved.allocation;
      } else {
        allocation = allocateCups(ranked, config);
      }

      const fixtures = buildAllCupFixtures(allocation, config);
      await TournamentCupMatchModel.insertFixtures(tournamentId, fixtures);

      const pools: NonNullable<CupStageConfig["pools"]> = {};
      if (allocation.ab.length) pools.AB = allocation.ab;
      if (allocation.A.length) pools.A = allocation.A;
      if (allocation.B.length) pools.B = allocation.B;
      if (allocation.C.length) pools.C = allocation.C;
      if (allocation.D.length) pools.D = allocation.D;
      const savedConfig: CupStageConfig = { ...config, pools };
      await TournamentModel.saveCupStageConfig(tournamentId, savedConfig);

      const cupMatches =
        await TournamentCupMatchModel.listByTournament(tournamentId);
      const cups = AdminController.buildCupStageViews(cupMatches, teams);

      res.json({
        success: true,
        message: "Финал начат",
        data: {
          tournament: { ...tournament, cup_stage_config: savedConfig },
          cups,
        },
      });
    } catch (error) {
      console.error("Ошибка старта финала:", error);
      res.status(500).json({
        success: false,
        message: error instanceof Error ? error.message : "Внутренняя ошибка",
      });
    }
  }

  /** Сброс финальной части. */
  static async resetCupStage(req: Request, res: Response): Promise<void> {
    try {
      const tournamentId = parseInt(req.params.tournamentId, 10);
      if (isNaN(tournamentId)) {
        res.status(400).json({ success: false, message: "Неверный ID турнира" });
        return;
      }
      const tournament = await TournamentModel.getTournamentById(tournamentId);
      if (!tournament) {
        res.status(404).json({ success: false, message: "Турнир не найден" });
        return;
      }
      if (tournament.status !== TournamentStatus.IN_PROGRESS) {
        res.status(400).json({
          success: false,
          message: "Сброс доступен только в статусе «В процессе»",
        });
        return;
      }
      await TournamentCupMatchModel.deleteByTournament(tournamentId);
      await TournamentModel.saveCupStageConfig(tournamentId, null);
      res.json({ success: true, message: "Финал сброшен", data: { cups: [] } });
    } catch (error) {
      console.error("Ошибка сброса финала:", error);
      res.status(500).json({
        success: false,
        message: "Внутренняя ошибка сервера",
      });
    }
  }

  /**
   * Завершить турнир по итогам кубков: места → очки (как при загрузке Excel),
   * статус FINISHED, признание очков — отдельно в админке.
   */
  static async finishTournamentFromCupStage(
    req: Request,
    res: Response,
  ): Promise<void> {
    const connection = await pool.getConnection();
    try {
      const tournamentId = parseInt(req.params.tournamentId, 10);
      if (isNaN(tournamentId)) {
        res.status(400).json({ success: false, message: "Неверный ID турнира" });
        return;
      }

      const tournament = await TournamentModel.getTournamentById(tournamentId);
      if (!tournament) {
        res.status(404).json({ success: false, message: "Турнир не найден" });
        return;
      }
      if (tournament.status !== TournamentStatus.IN_PROGRESS) {
        res.status(400).json({
          success: false,
          message: "Завершение доступно только в статусе «В процессе»",
        });
        return;
      }

      const cupMatches =
        await TournamentCupMatchModel.listByTournament(tournamentId);
      if (!areCupMatchesComplete(cupMatches)) {
        res.status(400).json({
          success: false,
          message: "Сначала введите результаты всех матчей финальной части",
        });
        return;
      }

      const teams =
        await TournamentRegistrationModel.listRegisteredTeamsWithPlayers(
          tournamentId,
          tournament.type as TournamentType,
        );

      type QualRow = {
        team_id: number;
        wins: number;
        loses: number;
        player_count: number;
      };
      const qualifying = new Map<number, QualRow>();

      if (tournament.play_format === TournamentPlayFormat.GROUPS) {
        if (!tournament.group_draw?.length) {
          res.status(400).json({
            success: false,
            message: "Нет жеребьёвки групп",
          });
          return;
        }
        const groupMatches =
          await TournamentGroupMatchModel.listByTournament(tournamentId);
        const groups = buildGroupStageViews(
          tournament.group_draw,
          teams,
          groupMatches,
        );
        for (const g of groups) {
          for (const t of g.teams) {
            if (t.place <= 0) {
              continue;
            }
            const loses = Math.max(0, t.played - t.wins);
            qualifying.set(t.team_id, {
              team_id: t.team_id,
              wins: t.wins,
              loses,
              player_count:
                teams.find((r) => r.team_id === t.team_id)?.player_ids
                  ?.length ?? 0,
            });
          }
        }
      } else if (tournament.play_format === TournamentPlayFormat.SWISS) {
        if (!tournament.swiss_seed?.length || !tournament.swiss_rounds) {
          res.status(400).json({
            success: false,
            message: "Швейцарка не сформирована",
          });
          return;
        }
        const swissMatches =
          await TournamentSwissMatchModel.listByTournament(tournamentId);
        const swiss = buildSwissStageView(
          tournament.swiss_seed,
          teams,
          AdminController.swissRowsToViews(swissMatches),
          tournament.swiss_rounds,
          tournament.tiebreaker_order,
        );
        for (const s of swiss.standings) {
          if (isSwissFreeTeamId(s.team_id) || s.place <= 0) {
            continue;
          }
          qualifying.set(s.team_id, {
            team_id: s.team_id,
            wins: s.wins,
            loses: Math.max(0, s.played - s.wins),
            player_count:
              teams.find((r) => r.team_id === s.team_id)?.player_ids?.length ??
              0,
          });
        }
      } else {
        res.status(400).json({
          success: false,
          message: "Неизвестный формат квалификации",
        });
        return;
      }

      if (qualifying.size === 0) {
        res.status(400).json({
          success: false,
          message: "Нет команд квалификации для записи результатов",
        });
        return;
      }

      const placements = deriveCupPlacements(cupMatches);
      const categoryEnum =
        String(tournament.category).toUpperCase() === "REGIONAL" ||
        String(tournament.category) === "2"
          ? TournamentCategoryEnum.REGIONAL
          : TournamentCategoryEnum.FEDERAL;
      const tournamentType = tournament.type as TournamentType;

      const rawDate = tournament.date as unknown;
      const dateStr =
        rawDate instanceof Date
          ? `${rawDate.getFullYear()}-${String(rawDate.getMonth() + 1).padStart(2, "0")}-${String(rawDate.getDate()).padStart(2, "0")}`
          : String(rawDate).slice(0, 10);

      await connection.beginTransaction();

      await connection.execute(
        "DELETE FROM tournament_results WHERE tournament_id = ?",
        [tournamentId],
      );
      await TournamentModel.clearResultsValidation(tournamentId, connection);

      const effectiveTeams =
        await TournamentModel.getEffectiveTeamsCount(
          tournamentId,
          dateStr,
          tournamentType,
        );

      for (const q of qualifying.values()) {
        const placement = placements.get(q.team_id);
        let cup: Cup | undefined;
        let cupPosition: CupPosition | undefined;
        let wins = q.wins;
        let loses = q.loses;

        if (placement) {
          cup = placement.cup;
          cupPosition = placement.position;
          const size = cupSizeForTeam(cupMatches, cup);
          const { winsModifier, losesModifier } = cupWinsLosesModifiers(
            size,
            cupPosition,
          );
          wins = q.wins + winsModifier;
          loses = q.loses + losesModifier;
        }

        const playerCount =
          q.player_count ||
          teams.find((t) => t.team_id === q.team_id)?.player_ids?.length ||
          0;

        const points = getPoints(
          tournamentType,
          categoryEnum,
          cup,
          cupPosition,
          Math.max(effectiveTeams, qualifying.size),
          q.wins,
          playerCount,
        );

        await TournamentModel.addTournamentResult(
          tournamentId,
          q.team_id,
          wins,
          loses,
          cupPosition,
          cup,
          q.wins,
          points,
          connection,
        );
      }

      await connection.execute(
        "UPDATE tournaments SET status = ?, manual = 0 WHERE id = ?",
        [TournamentStatus.FINISHED, tournamentId],
      );

      await connection.commit();

      // Парный турнир в тот же день — пересчёт очков
      const isDoublette =
        tournamentType === TournamentType.DOUBLETTE_MALE ||
        tournamentType === TournamentType.DOUBLETTE_FEMALE;
      const isTetATet =
        tournamentType === TournamentType.TET_A_TET_MALE ||
        tournamentType === TournamentType.TET_A_TET_FEMALE;
      if (isDoublette || isTetATet) {
        const pairType = isDoublette
          ? tournamentType === TournamentType.DOUBLETTE_MALE
            ? TournamentType.DOUBLETTE_FEMALE
            : TournamentType.DOUBLETTE_MALE
          : tournamentType === TournamentType.TET_A_TET_MALE
            ? TournamentType.TET_A_TET_FEMALE
            : TournamentType.TET_A_TET_MALE;
        const [pairRows] = await pool.execute<RowDataPacket[]>(
          `SELECT id FROM tournaments WHERE date = ? AND type = ? AND id != ?`,
          [dateStr, pairType, tournamentId],
        );
        if (pairRows.length > 0) {
          await TournamentModel.recalculateTournamentPoints(
            Number(pairRows[0].id),
          );
        }
      }

      res.json({
        success: true,
        message:
          "Турнир завершён. Очки рассчитаны; для рейтинга нужно признание результатов в админке.",
        data: {
          tournament_id: tournamentId,
          results_count: qualifying.size,
        },
      });
    } catch (error) {
      await connection.rollback();
      console.error("Ошибка завершения турнира по кубкам:", error);
      res.status(500).json({
        success: false,
        message:
          error instanceof Error ? error.message : "Внутренняя ошибка сервера",
      });
    } finally {
      connection.release();
    }
  }

  /** Обновить счёт / дорожку матча кубка. */
  static async updateTournamentCupMatch(
    req: Request,
    res: Response,
  ): Promise<void> {
    try {
      const tournamentId = parseInt(req.params.tournamentId, 10);
      const matchId = parseInt(req.params.matchId, 10);
      if (isNaN(tournamentId) || isNaN(matchId)) {
        res.status(400).json({
          success: false,
          message: "Неверный ID турнира или матча",
        });
        return;
      }
      const tournament = await TournamentModel.getTournamentById(tournamentId);
      if (!tournament || tournament.status !== TournamentStatus.IN_PROGRESS) {
        res.status(400).json({
          success: false,
          message: "Счёт можно менять только в статусе «В процессе»",
        });
        return;
      }
      const match = await TournamentCupMatchModel.getById(matchId);
      if (!match || match.tournament_id !== tournamentId) {
        res.status(404).json({ success: false, message: "Матч не найден" });
        return;
      }

      const body = req.body as {
        score_a?: unknown;
        score_b?: unknown;
        clear?: unknown;
        court?: unknown;
      };

      let scoreA: number | null = match.score_a;
      let scoreB: number | null = match.score_b;
      const hadScore = match.score_a != null && match.score_b != null;

      if (body.clear === true) {
        scoreA = null;
        scoreB = null;
      } else if (body.score_a !== undefined || body.score_b !== undefined) {
        const validated = validateMatchScores(body.score_a, body.score_b);
        if (typeof validated === "string") {
          res.status(400).json({ success: false, message: validated });
          return;
        }
        scoreA = validated.score_a;
        scoreB = validated.score_b;
      } else if (body.court === undefined) {
        res.status(400).json({
          success: false,
          message: "Укажите score_a и score_b, clear или court",
        });
        return;
      }

      let court: number | null | undefined = undefined;
      if (body.court !== undefined) {
        if (body.court === null) {
          court = null;
        } else {
          const c =
            typeof body.court === "number"
              ? body.court
              : parseInt(String(body.court), 10);
          if (!Number.isInteger(c) || c < 1 || c > 99) {
            res.status(400).json({
              success: false,
              message: "Номер дорожки должен быть от 1 до 99",
            });
            return;
          }
          court = c;
        }
      }

      await TournamentCupMatchModel.updateScores(
        matchId,
        scoreA,
        scoreB,
        court,
      );

      if (body.clear === true && hadScore) {
        if (
          match.next_match_round != null &&
          match.next_match_index != null &&
          match.next_slot
        ) {
          const next = await TournamentCupMatchModel.findSlot(
            tournamentId,
            match.cup,
            match.next_match_round,
            match.next_match_index,
            false,
          );
          if (next) {
            await TournamentCupMatchModel.setTeamSlot(
              next.id,
              match.next_slot,
              null,
            );
          }
        }
        await AdminController.syncThirdPlaceFromSemis(tournamentId, match.cup);
      } else if (
        scoreA != null &&
        scoreB != null &&
        match.team_a_id != null &&
        match.team_b_id != null
      ) {
        const winnerId = scoreA > scoreB ? match.team_a_id : match.team_b_id;
        const loserId = scoreA > scoreB ? match.team_b_id : match.team_a_id;
        await AdminController.advanceCupWinner(match, winnerId, loserId);
        await AdminController.syncThirdPlaceFromSemis(tournamentId, match.cup);
      }

      const freshConfig =
        (await TournamentModel.getTournamentById(tournamentId))
          ?.cup_stage_config ?? tournament.cup_stage_config;
      if (match.cup === "AB" && freshConfig) {
        await AdminController.maybeGenerateAbCups(tournamentId, freshConfig);
      }

      const teams =
        await TournamentRegistrationModel.listRegisteredTeamsWithPlayers(
          tournamentId,
          tournament.type as TournamentType,
        );
      const cupMatches =
        await TournamentCupMatchModel.listByTournament(tournamentId);
      const cups = AdminController.buildCupStageViews(cupMatches, teams);
      const updated = await TournamentModel.getTournamentById(tournamentId);

      res.json({
        success: true,
        message: "Матч обновлён",
        data: { cups, tournament: updated },
      });
    } catch (error) {
      console.error("Ошибка обновления матча кубка:", error);
      res.status(500).json({
        success: false,
        message: "Внутренняя ошибка сервера",
      });
    }
  }

  /**
   * Зарегистрировать команду на турнир (админка).
   */
  static async registerTournamentTeam(
    req: Request,
    res: Response,
  ): Promise<void> {
    req.params.id = req.params.tournamentId;
    return TournamentController.registerPublicTeam(req, res);
  }

  /**
   * Импорт списка команд из CSV (формат как при скачивании: №,состав команды,рейтинг).
   */
  static async importTournamentRegistrationsFromCsv(
    req: Request,
    res: Response,
  ): Promise<void> {
    try {
      const tournamentId = parseInt(req.params.tournamentId, 10);
      if (Number.isNaN(tournamentId) || tournamentId <= 0) {
        res.status(400).json({
          success: false,
          message: "Неверный ID турнира",
        });
        return;
      }

      const file = req.file;
      if (!file?.buffer) {
        res.status(400).json({
          success: false,
          message: "Загрузите CSV-файл",
        });
        return;
      }

      const tournament = await TournamentModel.getTournamentById(tournamentId);
      if (!tournament) {
        res.status(404).json({
          success: false,
          message: "Турнир не найден",
        });
        return;
      }

      if (
        !AdminController.isRegistrationEditableStatus(tournament.status)
      ) {
        res.status(400).json({
          success: false,
          message:
            "Импорт доступен только в статусах «Регистрация» и «Финальная регистрация»",
        });
        return;
      }

      const content = file.buffer.toString("utf8");
      const parsed = parseRegistrationCsv(content);
      if (parsed.error) {
        res.status(400).json({
          success: false,
          message: parsed.error,
        });
        return;
      }

      const ttype = tournament.type as TournamentType;
      const expected = getExpectedSlotCount(ttype);
      const minPlayers =
        ttype === TournamentType.TRIPLETTE ? 3 : expected;
      const maxPlayers = expected;

      let imported = 0;
      let skippedDuplicates = 0;
      const errors: string[] = [];

      for (const row of parsed.teams) {
        const label =
          row.rowNumber != null
            ? `Строка ${row.lineNumber} (№${row.rowNumber})`
            : `Строка ${row.lineNumber}`;
        const names = row.playerNames;

        if (names.length < minPlayers || names.length > maxPlayers) {
          errors.push(
            `${label}: для этого типа турнира нужно ${
              minPlayers === maxPlayers
                ? `${minPlayers}`
                : `${minPlayers}–${maxPlayers}`
            } игрок(ов), в файле — ${names.length} (${names.join(", ")})`,
          );
          continue;
        }

        const playerIds: number[] = [];
        let resolveFailed = false;
        for (const name of names) {
          try {
            const player = await TournamentParser.detectPlayer(name);
            playerIds.push(player.id);
          } catch (e) {
            const msg = e instanceof Error ? e.message : String(e);
            errors.push(`${label}: ${msg}`);
            resolveFailed = true;
            break;
          }
        }
        if (resolveFailed) {
          continue;
        }

        if (new Set(playerIds).size !== playerIds.length) {
          errors.push(`${label}: один игрок указан в составе дважды`);
          continue;
        }

        const slots = legacyPlayerIdsToRequestSlots(ttype, playerIds);
        if (!slots) {
          errors.push(`${label}: не удалось сформировать состав`);
          continue;
        }

        const result = await TournamentController.registerTeamWithSlots(
          tournamentId,
          ttype,
          slots,
        );
        if (!result.success) {
          if (result.status === 409) {
            skippedDuplicates += 1;
          } else {
            errors.push(`${label}: ${result.message}`);
          }
          continue;
        }
        imported += 1;
      }

      const parts = [`Добавлено команд: ${imported}`];
      if (skippedDuplicates > 0) {
        parts.push(`уже были зарегистрированы: ${skippedDuplicates}`);
      }
      if (errors.length > 0) {
        parts.push(`ошибок: ${errors.length}`);
      }

      res.json({
        success: true,
        message: parts.join(". "),
        data: {
          imported,
          skipped_duplicates: skippedDuplicates,
          errors,
        },
      });
    } catch (error) {
      console.error("Ошибка импорта CSV регистрации:", error);
      res.status(500).json({
        success: false,
        message: "Ошибка импорта CSV",
      });
    }
  }

  /**
   * Подтвердить заявку команды на турнир.
   */
  static async confirmTournamentRegistration(
    req: Request,
    res: Response,
  ): Promise<void> {
    try {
      const tournamentId = parseInt(req.params.tournamentId, 10);
      const teamId = parseInt(req.params.teamId, 10);

      if (isNaN(tournamentId) || isNaN(teamId)) {
        res.status(400).json({
          success: false,
          message: "Неверный ID турнира или команды",
        });
        return;
      }

      const tournament = await TournamentModel.getTournamentById(tournamentId);
      if (!tournament) {
        res.status(404).json({
          success: false,
          message: "Турнир не найден",
        });
        return;
      }

      if (!AdminController.isRegistrationEditableStatus(tournament.status)) {
        res.status(400).json({
          success: false,
          message:
            "Подтверждение заявок доступно только в статусах «Регистрация» и «Финальная регистрация»",
        });
        return;
      }

      const confirmState = await TournamentRegistrationModel.confirmRegistration(
        tournamentId,
        teamId,
      );

      if (confirmState === "not_found") {
        res.status(404).json({
          success: false,
          message: "Заявка команды на этот турнир не найдена",
        });
        return;
      }

      if (confirmState === "pending_new_players") {
        res.status(400).json({
          success: false,
          message:
            "Подтверждение недоступно: в заявке есть игроки, ещё не заведённые в базе. Добавьте игрока вручную и укажите его в составе через «Изменить состав».",
        });
        return;
      }

      res.json({
        success: true,
        message:
          confirmState === "already_confirmed"
            ? "Заявка уже была подтверждена"
            : "Заявка команды подтверждена",
      });
    } catch (error) {
      console.error("Ошибка подтверждения заявки на турнир:", error);
      res.status(500).json({
        success: false,
        message: "Ошибка подтверждения заявки",
      });
    }
  }

  /**
   * Изменить состав зарегистрированной команды на турнире.
   * Тело: { player_ids: number[] }.
   */
  static async updateTournamentRegistrationTeam(
    req: Request,
    res: Response
  ): Promise<void> {
    const tournamentId = parseInt(req.params.tournamentId, 10);
    const currentTeamId = parseInt(req.params.teamId, 10);

    if (isNaN(tournamentId) || isNaN(currentTeamId)) {
      res.status(400).json({
        success: false,
        message: "Неверный ID турнира или команды",
      });
      return;
    }

    const body = req.body as { player_ids?: unknown };
    if (!Array.isArray(body.player_ids)) {
      res.status(400).json({
        success: false,
        message: "Ожидается массив player_ids",
      });
      return;
    }

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

    if (playerIds.length === 0) {
      res.status(400).json({
        success: false,
        message: "Укажите хотя бы одного игрока",
      });
      return;
    }

    const tournament = await TournamentModel.getTournamentById(tournamentId);
    if (!tournament) {
      res.status(404).json({ success: false, message: "Турнир не найден" });
      return;
    }
    if (!AdminController.isRegistrationEditableStatus(tournament.status)) {
      res.status(400).json({
        success: false,
        message:
          "Изменение состава доступно только в статусах «Регистрация» и «Финальная регистрация»",
      });
      return;
    }

    let lockKey = "";
    let lockAcquired = false;
    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();
      lockKey = `tr_upd:${playerIds
        .slice()
        .sort((a, b) => a - b)
        .join(":")}`.substring(0, 60);
      const [lockRows] = await connection.query<RowDataPacket[]>(
        "SELECT GET_LOCK(?, 20) AS got",
        [lockKey]
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

      const currentlyRegistered = await TournamentRegistrationModel.isTeamRegistered(
        tournamentId,
        currentTeamId,
        connection
      );
      if (!currentlyRegistered) {
        await connection.rollback();
        res.status(404).json({
          success: false,
          message: "Заявка команды на этот турнир не найдена",
        });
        return;
      }

      const [playerRows] = await connection.execute<RowDataPacket[]>(
        `SELECT id, gender FROM players WHERE id IN (${playerIds
          .map(() => "?")
          .join(",")})`,
        playerIds
      );
      if (playerRows.length !== playerIds.length) {
        await connection.rollback();
        res.status(400).json({
          success: false,
          message: "Один или несколько игроков не найдены",
        });
        return;
      }

      const players = playerIds.map((id) => {
        const row = playerRows.find((r: RowDataPacket) => (r as any).id === id) as
          | { gender?: string | null }
          | undefined;
        const g = row?.gender;
        return {
          id,
          gender: g === "male" || g === "female" ? g : null,
        };
      });

      const rosterError = AdminController.validateRegistrationRoster(
        tournament.type as TournamentType,
        players
      );
      if (rosterError) {
        await connection.rollback();
        res.status(400).json({ success: false, message: rosterError });
        return;
      }

      let team = await TeamModel.findExistingTeamWithOrder(
        playerIds,
        connection
      );
      let nextTeamId: number;
      if (team) {
        nextTeamId = team.id;
      } else {
        nextTeamId = await TeamModel.createTeam(playerIds, connection);
      }

      if (nextTeamId === currentTeamId) {
        await connection.rollback();
        res.json({
          success: true,
          message: "Состав команды не изменился",
        });
        return;
      }

      const alreadyRegistered = await TournamentRegistrationModel.isTeamRegistered(
        tournamentId,
        nextTeamId,
        connection
      );
      if (alreadyRegistered) {
        await connection.rollback();
        res.status(409).json({
          success: false,
          message: "Команда с таким составом уже зарегистрирована на турнир",
        });
        return;
      }

      const replaced = await TournamentRegistrationModel.replaceRegisteredTeam(
        tournamentId,
        currentTeamId,
        nextTeamId,
        connection
      );
      if (!replaced) {
        await connection.rollback();
        res.status(404).json({
          success: false,
          message: "Заявка команды на этот турнир не найдена",
        });
        return;
      }

      await connection.commit();
      res.json({
        success: true,
        message: "Состав команды обновлён",
      });
    } catch (error) {
      await connection.rollback();
      console.error("Ошибка изменения состава зарегистрированной команды:", error);
      res.status(500).json({
        success: false,
        message: "Ошибка изменения состава команды",
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

  /**
   * Удалить заявку команды на турнир.
   */
  static async deleteTournamentRegistration(
    req: Request,
    res: Response
  ): Promise<void> {
    try {
      const tournamentId = parseInt(req.params.tournamentId, 10);
      const teamId = parseInt(req.params.teamId, 10);

      if (isNaN(tournamentId) || isNaN(teamId)) {
        res.status(400).json({
          success: false,
          message: "Неверный ID турнира или команды",
        });
        return;
      }

      const tournament = await TournamentModel.getTournamentById(tournamentId);
      if (!tournament) {
        res.status(404).json({
          success: false,
          message: "Турнир не найден",
        });
        return;
      }

      if (!AdminController.isRegistrationEditableStatus(tournament.status)) {
        res.status(400).json({
          success: false,
          message:
            "Удаление заявок доступно только в статусах «Регистрация» и «Финальная регистрация»",
        });
        return;
      }

      const deleted = await TournamentRegistrationModel.deleteRegistration(
        tournamentId,
        teamId
      );
      if (!deleted) {
        res.status(404).json({
          success: false,
          message: "Заявка команды на этот турнир не найдена",
        });
        return;
      }

      res.json({
        success: true,
        message: "Заявка команды удалена",
      });
    } catch (error) {
      console.error("Ошибка удаления заявки команды:", error);
      res.status(500).json({
        success: false,
        message: "Ошибка удаления заявки",
      });
    }
  }

  /**
   * Сохранить настройки проведения турнира (шаги 1–2 мастера старта).
   */
  static async updateTournamentPlaySettings(
    req: Request,
    res: Response,
  ): Promise<void> {
    try {
      const tournamentId = parseInt(req.params.tournamentId, 10);
      if (isNaN(tournamentId)) {
        res.status(400).json({
          success: false,
          message: "Неверный ID турнира",
        });
        return;
      }

      const tournament = await TournamentModel.getTournamentById(tournamentId);
      if (!tournament) {
        res.status(404).json({
          success: false,
          message: "Турнир не найден",
        });
        return;
      }

      if (tournament.status !== TournamentStatus.FINAL_REGISTRATION) {
        res.status(400).json({
          success: false,
          message:
            "Настройки проведения можно сохранить только в статусе «Финальная регистрация»",
        });
        return;
      }

      const { play_format, group_size, swiss_rounds, tiebreaker_order } =
        req.body;

      const allowedFormats = Object.values(TournamentPlayFormat);
      if (
        typeof play_format !== "string" ||
        !allowedFormats.includes(play_format as TournamentPlayFormat)
      ) {
        res.status(400).json({
          success: false,
          message: "Укажите формат: GROUPS или SWISS",
        });
        return;
      }

      const settingsInput: TournamentPlaySettingsInput = {
        play_format: play_format as TournamentPlayFormat,
        group_size:
          group_size === undefined || group_size === null
            ? null
            : Number(group_size),
        swiss_rounds:
          swiss_rounds === undefined || swiss_rounds === null
            ? null
            : Number(swiss_rounds),
        tiebreaker_order: Array.isArray(tiebreaker_order)
          ? (tiebreaker_order as TiebreakerCriterion[])
          : null,
      };

      const validationError = validatePlaySettings(settingsInput);
      if (validationError) {
        res.status(400).json({
          success: false,
          message: validationError,
        });
        return;
      }

      const success = await TournamentModel.updateTournamentPlaySettings(
        tournamentId,
        settingsInput.play_format,
        settingsInput.play_format === TournamentPlayFormat.GROUPS
          ? settingsInput.group_size!
          : null,
        settingsInput.play_format === TournamentPlayFormat.SWISS
          ? settingsInput.swiss_rounds!
          : null,
        settingsInput.play_format === TournamentPlayFormat.SWISS
          ? settingsInput.tiebreaker_order!
          : null,
      );

      if (!success) {
        res.status(400).json({
          success: false,
          message: "Не удалось сохранить настройки",
        });
        return;
      }

      // При смене формата убираем чужие фикстуры (на случай неполного сброса статуса)
      if (settingsInput.play_format === TournamentPlayFormat.GROUPS) {
        await TournamentSwissMatchModel.deleteByTournament(tournamentId);
        await TournamentModel.saveSwissSeed(tournamentId, null);
      } else {
        await TournamentGroupMatchModel.deleteByTournament(tournamentId);
      }
      await TournamentCupMatchModel.deleteByTournament(tournamentId);
      await TournamentModel.saveCupStageConfig(tournamentId, null);

      const updated = await TournamentModel.getTournamentById(tournamentId);
      res.json({
        success: true,
        message: "Настройки проведения сохранены",
        data: updated,
      });
    } catch (error) {
      console.error("Ошибка сохранения настроек проведения:", error);
      res.status(500).json({
        success: false,
        message: "Внутренняя ошибка сервера",
      });
    }
  }

  /**
   * Жеребьёвка команд по группам (шаг 3 мастера старта).
   */
  static async performTournamentGroupDraw(
    req: Request,
    res: Response,
  ): Promise<void> {
    try {
      const tournamentId = parseInt(req.params.tournamentId, 10);
      if (isNaN(tournamentId)) {
        res.status(400).json({
          success: false,
          message: "Неверный ID турнира",
        });
        return;
      }

      const tournament = await TournamentModel.getTournamentById(tournamentId);
      if (!tournament) {
        res.status(404).json({
          success: false,
          message: "Турнир не найден",
        });
        return;
      }

      if (tournament.status !== TournamentStatus.FINAL_REGISTRATION) {
        res.status(400).json({
          success: false,
          message:
            "Жеребьёвка доступна только в статусе «Финальная регистрация»",
        });
        return;
      }

      if (tournament.play_format !== TournamentPlayFormat.GROUPS) {
        res.status(400).json({
          success: false,
          message: "Жеребьёвка доступна только для группового формата",
        });
        return;
      }

      if (
        tournament.group_size == null ||
        tournament.group_size < 4 ||
        tournament.group_size > 6
      ) {
        res.status(400).json({
          success: false,
          message: "Сначала сохраните размер группы (4–6)",
        });
        return;
      }

      const teams =
        await TournamentRegistrationModel.listRegisteredTeamsWithPlayers(
          tournamentId,
          tournament.type as TournamentType,
        );
      const confirmedTeamIds = teams
        .filter((team) => team.is_confirmed)
        .map((team) => team.team_id);

      if (confirmedTeamIds.length === 0) {
        res.status(400).json({
          success: false,
          message: "Нет подтверждённых заявок для жеребьёвки",
        });
        return;
      }

      const groupDraw = performGroupDraw(
        confirmedTeamIds,
        tournament.group_size,
      );
      const saved = await TournamentModel.saveTournamentGroupDraw(
        tournamentId,
        groupDraw,
      );

      if (!saved) {
        res.status(400).json({
          success: false,
          message: "Не удалось сохранить результат жеребьёвки",
        });
        return;
      }

      res.json({
        success: true,
        message: "Жеребьёвка выполнена",
        data: {
          group_draw: groupDraw,
          teams,
        },
      });
    } catch (error) {
      console.error("Ошибка жеребьёвки:", error);
      res.status(500).json({
        success: false,
        message: "Внутренняя ошибка сервера",
      });
    }
  }

  /**
   * Сохранить ручную жеребьёвку по группам.
   * Тело: { group_draw: TournamentGroupDrawGroup[] }
   */
  static async saveManualTournamentGroupDraw(
    req: Request,
    res: Response,
  ): Promise<void> {
    try {
      const tournamentId = parseInt(req.params.tournamentId, 10);
      if (isNaN(tournamentId)) {
        res.status(400).json({
          success: false,
          message: "Неверный ID турнира",
        });
        return;
      }

      const tournament = await TournamentModel.getTournamentById(tournamentId);
      if (!tournament) {
        res.status(404).json({
          success: false,
          message: "Турнир не найден",
        });
        return;
      }

      if (tournament.status !== TournamentStatus.FINAL_REGISTRATION) {
        res.status(400).json({
          success: false,
          message:
            "Жеребьёвка доступна только в статусе «Финальная регистрация»",
        });
        return;
      }

      if (tournament.play_format !== TournamentPlayFormat.GROUPS) {
        res.status(400).json({
          success: false,
          message: "Жеребьёвка доступна только для группового формата",
        });
        return;
      }

      if (
        tournament.group_size == null ||
        tournament.group_size < 4 ||
        tournament.group_size > 6
      ) {
        res.status(400).json({
          success: false,
          message: "Сначала сохраните размер группы (4–6)",
        });
        return;
      }

      const rawDraw = (req.body as { group_draw?: unknown }).group_draw;
      if (!Array.isArray(rawDraw)) {
        res.status(400).json({
          success: false,
          message: "Ожидается массив group_draw",
        });
        return;
      }

      const groupDraw: TournamentGroupDrawGroup[] = [];
      for (const item of rawDraw) {
        if (
          !item ||
          typeof item !== "object" ||
          typeof (item as TournamentGroupDrawGroup).group_number !== "number" ||
          !Array.isArray((item as TournamentGroupDrawGroup).team_ids)
        ) {
          res.status(400).json({
            success: false,
            message: "Некорректная структура group_draw",
          });
          return;
        }
        const teamIds = (item as TournamentGroupDrawGroup).team_ids.map((id) =>
          typeof id === "number" ? id : parseInt(String(id), 10),
        );
        if (teamIds.some((id) => !Number.isInteger(id) || id <= 0)) {
          res.status(400).json({
            success: false,
            message: "Некорректный идентификатор команды в жеребьёвке",
          });
          return;
        }
        groupDraw.push({
          group_number: (item as TournamentGroupDrawGroup).group_number,
          team_ids: teamIds,
        });
      }

      const teams =
        await TournamentRegistrationModel.listRegisteredTeamsWithPlayers(
          tournamentId,
          tournament.type as TournamentType,
        );
      const confirmedTeamIds = teams
        .filter((team) => team.is_confirmed)
        .map((team) => team.team_id);

      const validationError = validateManualGroupDraw(
        groupDraw,
        confirmedTeamIds,
        tournament.group_size,
      );
      if (validationError) {
        res.status(400).json({
          success: false,
          message: validationError,
        });
        return;
      }

      const saved = await TournamentModel.saveTournamentGroupDraw(
        tournamentId,
        groupDraw,
      );
      if (!saved) {
        res.status(400).json({
          success: false,
          message: "Не удалось сохранить результат жеребьёвки",
        });
        return;
      }

      res.json({
        success: true,
        message: "Ручная жеребьёвка сохранена",
        data: {
          group_draw: groupDraw,
          teams,
        },
      });
    } catch (error) {
      console.error("Ошибка сохранения ручной жеребьёвки:", error);
      res.status(500).json({
        success: false,
        message: "Внутренняя ошибка сервера",
      });
    }
  }

  /**
   * Начать турнир: из «Регистрация» в «Финальная регистрация»
   * (подтверждение явки до выбора формата). Подтверждения заявок сбрасываются.
   */
  static async startTournament(req: Request, res: Response): Promise<void> {
    try {
      const tournamentId = parseInt(req.params.tournamentId, 10);
      if (isNaN(tournamentId)) {
        res.status(400).json({
          success: false,
          message: "Неверный ID турнира",
        });
        return;
      }

      const tournament = await TournamentModel.getTournamentById(tournamentId);
      if (!tournament) {
        res.status(404).json({
          success: false,
          message: "Турнир не найден",
        });
        return;
      }

      if (tournament.status !== TournamentStatus.REGISTRATION) {
        res.status(400).json({
          success: false,
          message: "Турнир можно начать только из статуса «Регистрация»",
        });
        return;
      }

      const success = await TournamentModel.updateTournament(
        tournamentId,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        TournamentStatus.FINAL_REGISTRATION,
      );

      if (!success) {
        res.status(400).json({
          success: false,
          message: "Не удалось начать турнир",
        });
        return;
      }

      await TournamentRegistrationModel.unconfirmAllRegistrations(tournamentId);

      res.json({
        success: true,
        message: "Турнир переведён в статус «Финальная регистрация»",
      });
    } catch (error) {
      console.error("Ошибка запуска турнира:", error);
      res.status(500).json({
        success: false,
        message: "Внутренняя ошибка сервера",
      });
    }
  }

  /**
   * Перейти от финальной регистрации к проведению (IN_PROGRESS)
   * после выбора формата и (для групп) жеребьёвки.
   */
  static async beginTournamentPlay(req: Request, res: Response): Promise<void> {
    try {
      const tournamentId = parseInt(req.params.tournamentId, 10);
      if (isNaN(tournamentId)) {
        res.status(400).json({
          success: false,
          message: "Неверный ID турнира",
        });
        return;
      }

      const tournament = await TournamentModel.getTournamentById(tournamentId);
      if (!tournament) {
        res.status(404).json({
          success: false,
          message: "Турнир не найден",
        });
        return;
      }

      if (tournament.status !== TournamentStatus.FINAL_REGISTRATION) {
        res.status(400).json({
          success: false,
          message:
            "Переход к проведению доступен только из статуса «Финальная регистрация»",
        });
        return;
      }

      const confirmedTeams =
        await TournamentRegistrationModel.listRegisteredTeamsWithPlayers(
          tournamentId,
          tournament.type as TournamentType,
          { confirmedOnly: true },
        );

      if (confirmedTeams.length === 0) {
        res.status(400).json({
          success: false,
          message: "Подтвердите хотя бы одну команду перед началом проведения",
        });
        return;
      }

      if (!tournament.play_format) {
        res.status(400).json({
          success: false,
          message: "Сначала укажите формат и параметры проведения турнира",
        });
        return;
      }

      const settingsInput: TournamentPlaySettingsInput = {
        play_format: tournament.play_format,
        group_size: tournament.group_size,
        swiss_rounds: tournament.swiss_rounds,
        tiebreaker_order: tournament.tiebreaker_order,
      };
      const validationError = validatePlaySettings(settingsInput);
      if (validationError) {
        res.status(400).json({
          success: false,
          message: validationError,
        });
        return;
      }

      if (tournament.play_format === TournamentPlayFormat.GROUPS) {
        if (!tournament.group_draw || tournament.group_draw.length === 0) {
          res.status(400).json({
            success: false,
            message: "Сначала проведите жеребьёвку по группам",
          });
          return;
        }
        const confirmedIds = new Set(confirmedTeams.map((t) => t.team_id));
        const drawnIds = tournament.group_draw.flatMap((g) => g.team_ids);
        const missing = drawnIds.filter((id) => !confirmedIds.has(id));
        if (missing.length > 0) {
          res.status(400).json({
            success: false,
            message:
              "Жеребьёвка устарела: есть команды без подтверждения или удалённые заявки. Проведите жеребьёвку заново.",
          });
          return;
        }
      }

      // Сначала фикстуры — статус меняем только после успешной подготовки
      if (
        tournament.play_format === TournamentPlayFormat.GROUPS &&
        tournament.group_draw
      ) {
        await TournamentGroupMatchModel.regenerateFromDraw(
          tournamentId,
          tournament.group_draw,
        );
      }

      if (tournament.play_format === TournamentPlayFormat.SWISS) {
        const body = req.body ?? {};
        const useRating =
          body.swiss_use_rating === undefined ||
          body.swiss_use_rating === null ||
          body.swiss_use_rating === true ||
          body.swiss_use_rating === "true" ||
          body.swiss_use_rating === 1;

        if (!useRating) {
          const seedOrder = Array.isArray(body.swiss_seed_order)
            ? body.swiss_seed_order.map((id: unknown) => Number(id))
            : [];
          const orderError = validateSwissSeedOrder(
            seedOrder,
            confirmedTeams.map((t) => t.team_id),
          );
          if (orderError) {
            res.status(400).json({
              success: false,
              message: orderError,
            });
            return;
          }
          try {
            await AdminController.ensureSwissRound1(
              tournamentId,
              confirmedTeams,
              tournament.type as TournamentType,
              { useRating: false, seedOrder },
            );
          } catch (seedError) {
            res.status(400).json({
              success: false,
              message:
                seedError instanceof Error
                  ? seedError.message
                  : "Не удалось задать сиды швейцарки",
            });
            return;
          }
        } else {
          await AdminController.ensureSwissRound1(
            tournamentId,
            confirmedTeams,
            tournament.type as TournamentType,
            { useRating: true },
          );
        }
      }

      const success = await TournamentModel.updateTournament(
        tournamentId,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        TournamentStatus.IN_PROGRESS,
      );

      if (!success) {
        res.status(400).json({
          success: false,
          message: "Не удалось перейти к проведению турнира",
        });
        return;
      }

      res.json({
        success: true,
        message: "Турнир переведён в статус «В процессе»",
      });
    } catch (error) {
      console.error("Ошибка перехода к проведению турнира:", error);
      res.status(500).json({
        success: false,
        message: "Внутренняя ошибка сервера",
      });
    }
  }

  // Обновить турнир (админ и менеджер)
  static async updateTournament(req: Request, res: Response): Promise<void> {
    try {
      const tournamentId = parseInt(req.params.tournamentId);

      if (isNaN(tournamentId)) {
        res.status(400).json({
          success: false,
          message: "Неверный ID турнира",
        });
        return;
      }

      const { name, type, category, date, manual, status, regulations } =
        req.body;

      // Проверяем, что передан хотя бы один параметр для обновления
      if (
        !name &&
        !type &&
        !category &&
        !date &&
        manual === undefined &&
        status === undefined &&
        regulations === undefined
      ) {
        res.status(400).json({
          success: false,
          message: "Необходимо указать хотя бы один параметр для обновления",
        });
        return;
      }

      if (status !== undefined) {
        const allowed = Object.values(TournamentStatus) as string[];
        if (typeof status !== "string" || !allowed.includes(status)) {
          res.status(400).json({
            success: false,
            message: "Неверный статус турнира",
          });
          return;
        }
      }

      // Проверяем, существует ли турнир
      const existingTournament = await TournamentModel.getTournamentById(
        tournamentId
      );
      if (!existingTournament) {
        res.status(404).json({
          success: false,
          message: "Турнир не найден",
        });
        return;
      }

      let regulationsValue: string | null | undefined = undefined;
      if (regulations !== undefined) {
        if (regulations === null) {
          regulationsValue = null;
        } else if (typeof regulations === "string") {
          const trimmed = regulations.trim();
          regulationsValue = trimmed.length > 0 ? trimmed : null;
        } else {
          res.status(400).json({
            success: false,
            message: "Поле regulations должно быть строкой или null",
          });
          return;
        }
      }

      const success = await TournamentModel.updateTournament(
        tournamentId,
        name,
        type,
        category,
        date,
        manual,
        status as TournamentStatus | undefined,
        regulationsValue,
      );

      if (success) {
        if (
          status !== undefined &&
          existingTournament.status === TournamentStatus.IN_PROGRESS &&
          status !== TournamentStatus.IN_PROGRESS
        ) {
          await TournamentGroupMatchModel.deleteByTournament(tournamentId);
          await TournamentCupMatchModel.deleteByTournament(tournamentId);
          await TournamentSwissMatchModel.deleteByTournament(tournamentId);
          await TournamentModel.saveCupStageConfig(tournamentId, null);
          await TournamentModel.saveSwissSeed(tournamentId, null);
        }
        res.json({
          success: true,
          message: "Турнир успешно обновлен",
        });
      } else {
        res.status(400).json({
          success: false,
          message: "Не удалось обновить турнир",
        });
      }
    } catch (error) {
      console.error("Ошибка при обновлении турнира:", error);
      res.status(500).json({
        success: false,
        message: "Внутренняя ошибка сервера",
      });
    }
  }

  /** Сменить организатора турнира (только ADMIN). */
  static async setTournamentOrganizer(
    req: Request,
    res: Response,
  ): Promise<void> {
    try {
      const tournamentId = parseInt(req.params.tournamentId, 10);
      const organizerUserId = parseInt(
        String((req.body as { organizer_user_id?: unknown }).organizer_user_id),
        10,
      );

      if (isNaN(tournamentId) || isNaN(organizerUserId)) {
        res.status(400).json({
          success: false,
          message: "Укажите турнир и organizer_user_id",
        });
        return;
      }

      const tournament = await TournamentModel.getTournamentById(tournamentId);
      if (!tournament) {
        res.status(404).json({
          success: false,
          message: "Турнир не найден",
        });
        return;
      }

      const user = await UserModel.getUserById(organizerUserId);
      if (!user) {
        res.status(404).json({
          success: false,
          message: "Пользователь не найден",
        });
        return;
      }

      const roles =
        user.roles && user.roles.length > 0 ? user.roles : [user.role];
      const canBeOrganizer =
        roles.includes(UserRole.ADMIN) || roles.includes(UserRole.MANAGER);
      if (!canBeOrganizer) {
        res.status(400).json({
          success: false,
          message:
            "Организатором может быть только пользователь с ролью ADMIN или MANAGER",
        });
        return;
      }

      const ok = await TournamentModel.setOrganizerUserId(
        tournamentId,
        organizerUserId,
      );
      if (!ok) {
        res.status(400).json({
          success: false,
          message: "Не удалось назначить организатора",
        });
        return;
      }

      const updated = await TournamentModel.getTournamentById(tournamentId);
      res.json({
        success: true,
        message: "Организатор турнира обновлён",
        data: updated,
      });
    } catch (error) {
      console.error("Ошибка смены организатора турнира:", error);
      res.status(500).json({
        success: false,
        message: "Внутренняя ошибка сервера",
      });
    }
  }

  // Удалить турнир (админ)
  static async deleteTournament(req: Request, res: Response): Promise<void> {
    try {
      const tournamentId = parseInt(req.params.tournamentId);

      if (isNaN(tournamentId)) {
        res.status(400).json({
          success: false,
          message: "Неверный ID турнира",
        });
        return;
      }

      // Получаем информацию о турнире перед удалением
      const [tournaments] = await pool.execute<RowDataPacket[]>(
        "SELECT date, type FROM tournaments WHERE id = ?",
        [tournamentId]
      );

      if (tournaments.length === 0) {
        res.status(404).json({
          success: false,
          message: "Турнир не найден",
        });
        return;
      }

      const tournamentDate = tournaments[0].date;
      const tournamentType = tournaments[0].type as TournamentType;

      const success = await TournamentModel.deleteTournament(tournamentId);

      if (success) {
        // Проверяем, нужно ли пересчитать парный турнир
        const isDoublette =
          tournamentType === TournamentType.DOUBLETTE_MALE ||
          tournamentType === TournamentType.DOUBLETTE_FEMALE;

        const isTetATet =
          tournamentType === TournamentType.TET_A_TET_MALE ||
          tournamentType === TournamentType.TET_A_TET_FEMALE;

        if (isDoublette || isTetATet) {
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

          // Ищем парный турнир в тот же день
          const [pairTournaments] = await pool.execute<RowDataPacket[]>(
            `SELECT id FROM tournaments WHERE date = ? AND type = ?`,
            [tournamentDate, pairType]
          );

          if (pairTournaments.length > 0) {
            console.log(
              `🔄 Пересчитываем очки для парного турнира (${pairType}) после удаления турнира...`
            );
            const pairTournamentId = pairTournaments[0].id;
            await TournamentModel.recalculateTournamentPoints(pairTournamentId);
          }
        }

        res.json({
          success: true,
          message: "Турнир успешно удален",
        });
      } else {
        res.status(404).json({
          success: false,
          message: "Турнир не найден",
        });
      }
    } catch (error) {
      console.error("Ошибка удаления турнира:", error);
      res.status(500).json({
        success: false,
        message: "Ошибка при удалении турнира",
      });
    }
  }

  // Получить всех игроков (админ)
  static async getPlayers(req: Request, res: Response): Promise<void> {
    try {
      const players = await PlayerModel.getAllPlayers();
      res.json({
        success: true,
        data: players,
      });
    } catch (error) {
      console.error("Ошибка получения игроков:", error);
      res.status(500).json({
        success: false,
        message: "Ошибка получения игроков",
      });
    }
  }

  // Создать игрока (админ)
  static async createPlayer(req: Request, res: Response): Promise<void> {
    try {
      const { name, gender, city, license_number } = req.body;

      if (!name || !gender) {
        res.status(400).json({
          success: false,
          message: "Имя и пол игрока обязательны",
        });
        return;
      }

      // Очищаем имя от лишних пробелов
      const cleanedName = name.trim();

      // Проверяем, что имя состоит минимум из двух слов (Фамилия Имя)
      const nameParts = cleanedName.split(/\s+/);
      if (nameParts.length < 2) {
        res.status(400).json({
          success: false,
          message:
            "Имя должно содержать минимум Фамилию и Имя (например: Иванов Иван)",
        });
        return;
      }

      // Проверяем, что вторая часть не является инициалами
      const secondPart = nameParts[1];
      const isInitial = /^[А-ЯA-Z]\.?$/.test(secondPart);
      if (isInitial) {
        res.status(400).json({
          success: false,
          message:
            "Нельзя создать игрока с инициалами. Укажите полное имя (например: Иванов Иван, а не Иванов И.)",
        });
        return;
      }

      // Проверяем, существует ли игрок с таким именем
      const existingPlayer = await PlayerModel.getPlayerByName(cleanedName);
      if (existingPlayer) {
        res.status(400).json({
          success: false,
          message: "Игрок с таким именем уже существует",
        });
        return;
      }

      // Создаем игрока
      const playerId = await PlayerModel.createPlayer(cleanedName, city, license_number);

      // Обновляем пол и город
      await PlayerModel.updatePlayer(playerId, cleanedName, gender, city, license_number);

      res.json({
        success: true,
        message: "Игрок успешно создан",
        player_id: playerId,
      });
    } catch (error) {
      console.error("Ошибка создания игрока:", error);
      res.status(500).json({
        success: false,
        message: "Ошибка при создании игрока",
      });
    }
  }

  // Обновить игрока (админ)
  static async updatePlayer(req: Request, res: Response): Promise<void> {
    try {
      const playerId = parseInt(req.params.playerId);
      const { name, gender, city, license_number } = req.body;

      if (isNaN(playerId) || !name || !gender) {
        res.status(400).json({
          success: false,
          message: "ID игрока, имя и пол обязательны",
        });
        return;
      }

      const success = await PlayerModel.updatePlayer(
        playerId,
        name,
        gender,
        city,
        license_number
      );

      if (success) {
        res.json({
          success: true,
          message: "Игрок успешно обновлен",
        });
      } else {
        res.status(404).json({
          success: false,
          message: "Игрок не найден",
        });
      }
    } catch (error) {
      console.error("Ошибка обновления игрока:", error);
      res.status(500).json({
        success: false,
        message: "Ошибка при обновлении игрока",
      });
    }
  }

  // Удалить игрока (админ и менеджер, если игрок не участвовал в турнирах)
  static async deletePlayer(req: Request, res: Response): Promise<void> {
    try {
      const playerId = parseInt(req.params.playerId);

      if (isNaN(playerId)) {
        res.status(400).json({
          success: false,
          message: "Неверный ID игрока",
        });
        return;
      }

      // Проверяем, участвовал ли игрок в турнирах
      const [participationRows] = await pool.execute<RowDataPacket[]>(
        `SELECT COUNT(*) as count 
         FROM team_players tp
         JOIN tournament_results tr ON tp.team_id = tr.team_id
         WHERE tp.player_id = ?`,
        [playerId]
      );

      const participationCount = (participationRows[0] as any).count;

      if (participationCount > 0) {
        res.status(400).json({
          success: false,
          message: `Невозможно удалить игрока. Игрок участвовал в ${participationCount} турнирах. Удаление игроков, участвовавших в турнирах, запрещено для сохранения истории соревнований.`,
        });
        return;
      }

      const success = await PlayerModel.deletePlayer(playerId);

      if (success) {
        res.json({
          success: true,
          message: "Игрок успешно удален",
        });
      } else {
        res.status(404).json({
          success: false,
          message: "Игрок не найден",
        });
      }
    } catch (error) {
      console.error("Ошибка удаления игрока:", error);
      res.status(500).json({
        success: false,
        message: "Ошибка при удалении игрока",
      });
    }
  }

  // ==== МЕТОДЫ ДЛЯ РАБОТЫ С ЛИЦЕНЗИОННЫМИ ИГРОКАМИ ====

  // Получить всех лицензионных игроков
  static async getLicensedPlayers(req: Request, res: Response): Promise<void> {
    try {
      const year = req.query.year
        ? parseInt(req.query.year as string)
        : undefined;
      const players = await LicensedPlayerModel.getAllLicensedPlayers(year);
      res.json({
        success: true,
        data: players,
      });
    } catch (error) {
      console.error("Ошибка получения лицензионных игроков:", error);
      res.status(500).json({
        success: false,
        message: "Ошибка получения лицензионных игроков",
      });
    }
  }

  // Получить активных лицензионных игроков текущего года
  static async getActiveLicensedPlayers(
    req: Request,
    res: Response
  ): Promise<void> {
    try {
      const year = req.query.year
        ? parseInt(req.query.year as string)
        : new Date().getFullYear();
      const players = await LicensedPlayerModel.getActiveLicensedPlayers(year);
      res.json({
        success: true,
        data: players,
      });
    } catch (error) {
      console.error("Ошибка получения активных лицензионных игроков:", error);
      res.status(500).json({
        success: false,
        message: "Ошибка получения активных лицензионных игроков",
      });
    }
  }

  // Получить доступные годы
  static async getLicensedPlayersYears(
    req: Request,
    res: Response
  ): Promise<void> {
    try {
      const years = await LicensedPlayerModel.getAvailableYears();
      res.json({
        success: true,
        data: years,
      });
    } catch (error) {
      console.error("Ошибка получения годов лицензированных игроков:", error);
      res.status(500).json({
        success: false,
        message: "Ошибка получения годов лицензированных игроков",
      });
    }
  }

  // Получить статистику по лицензионным игрокам
  static async getLicensedPlayersStatistics(
    req: Request,
    res: Response
  ): Promise<void> {
    try {
      const year = req.query.year
        ? parseInt(req.query.year as string)
        : new Date().getFullYear();
      const statistics = await LicensedPlayerModel.getStatistics(year);
      res.json({
        success: true,
        data: statistics,
      });
    } catch (error) {
      console.error("Ошибка получения статистики лицензионных игроков:", error);
      res.status(500).json({
        success: false,
        message: "Ошибка получения статистики лицензионных игроков",
      });
    }
  }

  // Создать лицензионного игрока
  static async createLicensedPlayer(
    req: Request,
    res: Response
  ): Promise<void> {
    try {
      const { player_name, license_date } = req.body;

      if (!player_name || !license_date) {
        res.status(400).json({
          success: false,
          message: "Все поля обязательны для заполнения",
        });
        return;
      }

      // Автоматически вычисляем год из даты лицензии
      const licenseYear = new Date(license_date).getFullYear();
      const currentYear = new Date().getFullYear();

      // Проверяем, что лицензия создается только на текущий год
      if (licenseYear !== currentYear) {
        res.status(400).json({
          success: false,
          message: `Можно добавить лицензию только на текущий ${currentYear} год. Указана дата для ${licenseYear} года.`,
        });
        return;
      }

      // Проверяем существует ли игрок с таким именем
      const existingPlayers = await PlayerModel.getPlayerByName(player_name.trim());
      if (!existingPlayers || existingPlayers.length === 0) {
        res.status(400).json({
          success: false,
          message: `Игрок с именем "${player_name}" не найден. Сначала создайте игрока в разделе "Игроки"`,
        });
        return;
      }

      // Если найдено несколько игроков с похожим именем
      if (existingPlayers.length > 1) {
        res.status(400).json({
          success: false,
          message: `Найдено несколько игроков с похожим именем. Уточните ФИО.`,
        });
        return;
      }

      const player = existingPlayers[0];

      // Проверяем, есть ли уже лицензия для этого игрока в этом году
      const [existingLicense] = await pool.execute<RowDataPacket[]>(
        "SELECT id FROM licensed_players WHERE player_id = ? AND year = ?",
        [player.id, licenseYear]
      );

      if (existingLicense.length > 0) {
        res.status(400).json({
          success: false,
          message: `У игрока "${player.name}" уже есть лицензия на ${licenseYear} год`,
        });
        return;
      }

      // Добавляем лицензию игроку (год вычисляется автоматически)
      const [result] = await pool.execute<ResultSetHeader>(
        `INSERT INTO licensed_players (player_id, license_date, year) 
         VALUES (?, ?, ?)`,
        [player.id, license_date, licenseYear]
      );

      res.json({
        success: true,
        message: "Лицензия успешно добавлена",
        player_id: result.insertId,
      });
    } catch (error) {
      console.error("Ошибка создания лицензии:", error);
      res.status(500).json({
        success: false,
        message: "Ошибка при создании лицензии",
      });
    }
  }

  // Обновить лицензионного игрока
  static async updateLicensedPlayer(
    req: Request,
    res: Response
  ): Promise<void> {
    try {
      const playerId = parseInt(req.params.playerId);
      const updateData = req.body;

      if (isNaN(playerId)) {
        res.status(400).json({
          success: false,
          message: "Неверный ID игрока",
        });
        return;
      }

      // Проверяем существует ли игрок
      const existing = await LicensedPlayerModel.getLicensedPlayerById(
        playerId
      );
      if (!existing) {
        res.status(404).json({
          success: false,
          message: "Лицензионный игрок не найден",
        });
        return;
      }

      // Если обновляется дата лицензии, проверяем и пересчитываем год
      if (updateData.license_date) {
        const newLicenseYear = new Date(updateData.license_date).getFullYear();
        const currentYear = new Date().getFullYear();

        // Проверяем, что новая дата тоже для текущего года
        if (newLicenseYear !== currentYear) {
          res.status(400).json({
            success: false,
            message: `Можно указать дату лицензии только для текущего ${currentYear} года. Указана дата для ${newLicenseYear} года.`,
          });
          return;
        }

        updateData.year = newLicenseYear;
      }

      const success = await LicensedPlayerModel.updateLicensedPlayer(
        playerId,
        updateData
      );

      if (success) {
        res.json({
          success: true,
          message: "Лицензия успешно обновлена",
        });
      } else {
        res.status(400).json({
          success: false,
          message: "Не удалось обновить данные лицензии",
        });
      }
    } catch (error) {
      console.error("Ошибка обновления лицензии:", error);
      res.status(500).json({
        success: false,
        message: "Ошибка при обновлении лицензии",
      });
    }
  }

  // Удалить лицензионного игрока
  static async deleteLicensedPlayer(
    req: Request,
    res: Response
  ): Promise<void> {
    try {
      const playerId = parseInt(req.params.playerId);

      if (isNaN(playerId)) {
        res.status(400).json({
          success: false,
          message: "Неверный ID игрока",
        });
        return;
      }

      const success = await LicensedPlayerModel.deleteLicensedPlayer(playerId);

      if (success) {
        res.json({
          success: true,
          message: "Лицензионный игрок успешно удален",
        });
      } else {
        res.status(404).json({
          success: false,
          message: "Лицензионный игрок не найден",
        });
      }
    } catch (error) {
      console.error("Ошибка удаления лицензионного игрока:", error);
      res.status(500).json({
        success: false,
        message: "Ошибка при удалении лицензионного игрока",
      });
    }
  }

  // Загрузка списка лицензионных игроков из Excel файла
  static async uploadLicensedPlayers(
    req: Request,
    res: Response
  ): Promise<void> {
    try {
      if (!req.file) {
        res.status(400).json({
          success: false,
          message: "Файл не был загружен",
        });
        return;
      }

      const { year, replace_existing } = req.body;

      if (!year) {
        res.status(400).json({
          success: false,
          message: "Год обязателен для загрузки",
        });
        return;
      }

      const parsedYear = parseInt(year);
      if (isNaN(parsedYear) || parsedYear < 2000 || parsedYear > 2100) {
        res.status(400).json({
          success: false,
          message: "Неверный формат года",
        });
        return;
      }

      // Парсим Excel файл
      const workbook = XLSX.read(req.file.buffer);
      const sheetName = workbook.SheetNames[0];
      const sheet = workbook.Sheets[sheetName];

      // Конвертируем в JSON
      const jsonData = XLSX.utils.sheet_to_json(sheet, { header: 1 });

      if (jsonData.length < 2) {
        res.status(400).json({
          success: false,
          message: "Файл не содержит данных или содержит только заголовки",
        });
        return;
      }

      // Парсим данные игроков
      const players: LicensedPlayerUploadData[] = [];

      for (let i = 1; i < jsonData.length; i++) {
        const row = jsonData[i] as any[];
        if (row.length >= 5 && row[1] && row[2] && row[3] && row[4]) {
          // Ожидаем структуру: № п/п, ФИО, Дата, № лицензии, Город
          const fullName = String(row[1]).trim();
          const licenseDate = String(row[2]).trim();
          const licenseNumber = String(row[3]).trim();
          const city = String(row[4]).trim();

          if (fullName && licenseDate && licenseNumber && city) {
            // Парсим дату в формат YYYY-MM-DD
            let parsedDate = licenseDate;
            try {
              // Если дата в формате M.D.YYYY, конвертируем
              const dateMatch = licenseDate.match(
                /^(\d{1,2})\.(\d{1,2})\.(\d{4})$/
              );
              if (dateMatch) {
                const [, month, day, year] = dateMatch;
                parsedDate = `${year}-${month.padStart(2, "0")}-${day.padStart(
                  2,
                  "0"
                )}`;
              }
            } catch (dateError) {
              console.warn(
                `Ошибка парсинга даты для игрока ${fullName}: ${licenseDate}`
              );
            }

            players.push({
              player_name: fullName,
              license_date: parsedDate,
              license_number: licenseNumber,
              city: city,
              year: parsedYear,
            });
          }
        }
      }

      if (players.length === 0) {
        res.status(400).json({
          success: false,
          message:
            "Не удалось найти корректные данные в файле. Убедитесь, что структура файла соответствует ожидаемой: № п/п, ФИО, Дата, № лицензии, Город",
        });
        return;
      }

      // Загружаем в базу данных
      const results = await LicensedPlayerModel.uploadLicensedPlayers(
        players,
        replace_existing === "true"
      );

      res.json({
        success: true,
        message: `Загрузка завершена. Создано: ${results.created}, Обновлено: ${results.updated}`,
        results,
      });
    } catch (error) {
      console.error("Ошибка загрузки лицензионных игроков:", error);
      res.status(500).json({
        success: false,
        message: "Ошибка при загрузке списка лицензионных игроков",
      });
    }
  }

  // Массовая загрузка игроков из текстового файла
  static async uploadPlayersFromText(
    req: Request,
    res: Response
  ): Promise<void> {
    try {
      if (!req.file) {
        res.status(400).json({
          success: false,
          message: "Файл не был загружен",
        });
        return;
      }

      // Читаем текстовый файл
      const fileContent = req.file.buffer.toString("utf-8");
      const lines = fileContent.split(/\r?\n/).filter((line) => line.trim());

      if (lines.length === 0) {
        res.status(400).json({
          success: false,
          message: "Файл пустой или не содержит данных",
        });
        return;
      }

      console.log(`📄 Обработка текстового файла: ${lines.length} строк`);

      const results = {
        created: 0,
        updated: 0,
        skipped: 0,
        errors: [] as string[],
      };

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;

        // Парсим строку формата: "имя, город" или "имя, пол, город"
        const parts = line.split(",").map((part) => part.trim());

        if (parts.length < 2) {
          results.errors.push(
            `Строка ${
              i + 1
            }: неверный формат "${line}" (ожидается: имя, город или имя, пол, город)`
          );
          results.skipped++;
          continue;
        }

        const playerName = parts[0];
        let playerGender = "male"; // По умолчанию мужской пол
        let city = "";

        // Определяем формат: 2 поля (имя, город) или 3 поля (имя, пол, город)
        if (parts.length === 2) {
          // Формат: имя, город
          city = parts[1];
        } else if (parts.length >= 3) {
          // Формат: имя, пол, город
          const genderField = parts[1].toLowerCase();
          if (
            genderField === "male" ||
            genderField === "female" ||
            genderField === "m" ||
            genderField === "f" ||
            genderField === "м" ||
            genderField === "ж"
          ) {
            // Второе поле это пол
            playerGender =
              genderField === "male" ||
              genderField === "m" ||
              genderField === "м"
                ? "male"
                : "female";
            city = parts.slice(2).join(", "); // Остальное - город (может содержать запятые)
          } else {
            // Второе поле не похоже на пол, считаем что это формат: имя, город (с запятыми в городе)
            city = parts.slice(1).join(", ");
          }
        }

        if (!playerName) {
          results.errors.push(`Строка ${i + 1}: имя игрока не указано`);
          results.skipped++;
          continue;
        }

        if (!city) {
          results.errors.push(`Строка ${i + 1}: город не указан`);
          results.skipped++;
          continue;
        }

        // Проверяем, что имя содержит минимум 2 слова (Фамилия Имя)
        const nameParts = playerName.split(/\s+/);
        if (nameParts.length < 2) {
          results.errors.push(
            `Строка ${
              i + 1
            }: имя "${playerName}" должно содержать минимум Фамилию и Имя`
          );
          results.skipped++;
          continue;
        }

        // Проверяем, что вторая часть не является инициалами
        const secondPart = nameParts[1];
        const isInitial = /^[А-ЯA-Z]\.?$/.test(secondPart);
        if (isInitial) {
          results.errors.push(
            `Строка ${
              i + 1
            }: нельзя использовать инициалы в имени "${playerName}". Укажите полное имя`
          );
          results.skipped++;
          continue;
        }

        try {
          // Проверяем, существует ли игрок с таким именем
          const existingPlayer = await PlayerModel.getPlayerByName(playerName);

          if (existingPlayer && existingPlayer.length > 0) {
            // Игрок уже существует, обновляем данные если нужно
            const player = existingPlayer[0];
            const needsUpdate =
              player.city !== city || player.gender !== playerGender;

            if (needsUpdate) {
              await PlayerModel.updatePlayer(
                player.id,
                player.name,
                playerGender,
                city
              );
              results.updated++;
              console.log(
                `✏️ Обновлен игрок: ${playerName} (${playerGender}, ${city})`
              );
            } else {
              results.skipped++;
              console.log(`⏭️ Пропущен существующий игрок: ${playerName}`);
            }
          } else {
            // Создаем нового игрока
            const playerId = await PlayerModel.createPlayer(playerName, city);

            // Устанавливаем пол
            await PlayerModel.updatePlayer(
              playerId,
              playerName,
              playerGender,
              city
            );

            results.created++;
            console.log(
              `✅ Создан игрок: ${playerName} (${playerGender}, ${city})`
            );
          }
        } catch (error) {
          console.error(`Ошибка обработки игрока ${playerName}:`, error);
          results.errors.push(
            `Строка ${i + 1}: ошибка создания/обновления игрока "${playerName}"`
          );
          results.skipped++;
        }
      }

      // Формируем сообщение результата
      let message = `Загрузка завершена. Создано: ${results.created}, Обновлено: ${results.updated}, Пропущено: ${results.skipped}`;

      if (results.errors.length > 0) {
        message += `\n\nОшибки:\n${results.errors.join("\n")}`;
      }

      res.json({
        success: true,
        message,
        results: {
          created: results.created,
          updated: results.updated,
          skipped: results.skipped,
          errors: results.errors,
        },
      });
    } catch (error) {
      console.error("Ошибка массовой загрузки игроков:", error);
      res.status(500).json({
        success: false,
        message: "Ошибка при массовой загрузке игроков",
      });
    }
  }

  // ==== ПЕРЕСЧЁТ РЕЙТИНГА ====

  // Пересчитать очки всех турниров текущего календарного года
  static async recalculateTournamentPoints(
    req: Request,
    res: Response
  ): Promise<void> {
    try {
      console.log("🔄 Начинается пересчёт очков для всех турниров...");

      await TournamentModel.recalculatePoints();

      res.json({
        success: true,
        message: "Очки для всех турниров успешно пересчитаны",
      });
    } catch (error) {
      console.error("Ошибка при пересчёте очков турниров:", error);
      res.status(500).json({
        success: false,
        message: "Ошибка при пересчёте очков турниров",
      });
    }
  }
}
