import { Request, Response } from "express";
import multer from "multer";
import * as XLSX from "xlsx";
import { TournamentModel } from "../models/TournamentModel";
import { PlayerModel } from "../models/PlayerModel";
import { SettingsModel } from "../models/SettingsModel";
import { LicensedPlayerModel } from "../models/LicensedPlayerModel";
import { TournamentController } from "./TournamentController";
import { TournamentUploadData, LicensedPlayerUploadData } from "../types";

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

export const uploadMiddleware = upload.single("tournament_file");
export const licensedPlayersUploadMiddleware = upload.single(
  "licensed_players_file"
);

export class AdminController {
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

      const result = await TournamentController.parseTournamentFromGoogleSheets(
        google_sheets_url,
        tournament_name,
        tournament_date,
        tournament_type,
        tournament_category
      );

      res.json({
        success: true,
        message: `Турнир "${tournament_name}" успешно загружен из Google таблицы. Обработано команд: ${result.teamsCount}, результатов кубков: ${result.resultsCount}.`,
        tournament_id: result.tournamentId,
        teams_count: result.teamsCount,
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
        requestedCategory
      );

      res.json({
        success: true,
        message: `Турнир "${tournament_name}" успешно загружен. Обработано команд: ${result.teamsCount}, результатов кубков: ${result.resultsCount}.`,
        tournament_id: result.tournamentId,
        teams_count: result.teamsCount,
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

      const { name, type, category, teams_count, date } = req.body;

      // Проверяем, что передан хотя бы один параметр для обновления
      if (!name && !type && !category && !teams_count && !date) {
        res.status(400).json({
          success: false,
          message: "Необходимо указать хотя бы один параметр для обновления",
        });
        return;
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

      const success = await TournamentModel.updateTournament(
        tournamentId,
        name,
        type,
        category,
        teams_count,
        date
      );

      if (success) {
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

      const success = await TournamentModel.deleteTournament(tournamentId);

      if (success) {
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
      const { name, gender } = req.body;

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
      const playerId = await PlayerModel.createPlayer(cleanedName);

      // Обновляем пол
      await PlayerModel.updatePlayer(playerId, cleanedName, gender);

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
      const { name, gender } = req.body;

      if (isNaN(playerId) || !name || !gender) {
        res.status(400).json({
          success: false,
          message: "ID игрока, имя и пол обязательны",
        });
        return;
      }

      const success = await PlayerModel.updatePlayer(playerId, name, gender);

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

  // Удалить игрока (админ)
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
      const { license_number, player_name, city, license_date, year } =
        req.body;

      if (!license_number || !player_name || !city || !license_date || !year) {
        res.status(400).json({
          success: false,
          message: "Все поля обязательны для заполнения",
        });
        return;
      }

      // Проверяем существует ли игрок с таким номером лицензии
      const existing =
        await LicensedPlayerModel.getLicensedPlayerByLicenseNumber(
          license_number
        );
      if (existing) {
        res.status(400).json({
          success: false,
          message: "Игрок с таким номером лицензии уже существует",
        });
        return;
      }

      const playerId = await LicensedPlayerModel.addLicensedPlayer({
        license_number,
        player_name,
        city,
        license_date,
        year: parseInt(year),
      });

      res.json({
        success: true,
        message: "Лицензионный игрок успешно создан",
        player_id: playerId,
      });
    } catch (error) {
      console.error("Ошибка создания лицензионного игрока:", error);
      res.status(500).json({
        success: false,
        message: "Ошибка при создании лицензионного игрока",
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

      // Если обновляется номер лицензии, проверяем уникальность
      if (
        updateData.license_number &&
        updateData.license_number !== existing.license_number
      ) {
        const duplicate =
          await LicensedPlayerModel.getLicensedPlayerByLicenseNumber(
            updateData.license_number
          );
        if (duplicate && duplicate.id !== playerId) {
          res.status(400).json({
            success: false,
            message: "Игрок с таким номером лицензии уже существует",
          });
          return;
        }
      }

      const success = await LicensedPlayerModel.updateLicensedPlayer(
        playerId,
        updateData
      );

      if (success) {
        res.json({
          success: true,
          message: "Лицензионный игрок успешно обновлен",
        });
      } else {
        res.status(400).json({
          success: false,
          message: "Не удалось обновить данные игрока",
        });
      }
    } catch (error) {
      console.error("Ошибка обновления лицензионного игрока:", error);
      res.status(500).json({
        success: false,
        message: "Ошибка при обновлении лицензионного игрока",
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
}
