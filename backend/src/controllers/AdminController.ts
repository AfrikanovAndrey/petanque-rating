import { Request, Response } from "express";
import multer from "multer";
import * as XLSX from "xlsx";
import { TournamentModel } from "../models/TournamentModel";
import { PlayerModel } from "../models/PlayerModel";
import { SettingsModel } from "../models/SettingsModel";
import { TournamentUploadData } from "../types";

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

export class AdminController {
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

      const { tournament_name, tournament_date } = req.body;

      if (!tournament_name || !tournament_date) {
        res.status(400).json({
          success: false,
          message: "Название и дата турнира обязательны",
        });
        return;
      }

      // Парсим Excel файл
      const workbook = XLSX.read(req.file.buffer);
      const sheetName = workbook.SheetNames[0];
      const sheet = workbook.Sheets[sheetName];

      // Конвертируем в JSON
      const jsonData = XLSX.utils.sheet_to_json(sheet, { header: 1 });

      // Проверяем структуру данных и парсим результаты
      const results: Array<{ player_name: string; position: number }> = [];

      for (let i = 1; i < jsonData.length; i++) {
        // Пропускаем первую строку (заголовки)
        const row = jsonData[i] as any[];
        if (row.length >= 2 && row[0] && row[1]) {
          const playerName = String(row[0]).trim();
          const position = parseInt(String(row[1]));

          if (playerName && !isNaN(position) && position > 0) {
            results.push({
              player_name: playerName,
              position: position,
            });
          }
        }
      }

      if (results.length === 0) {
        res.status(400).json({
          success: false,
          message:
            "Не удалось найти корректные данные в файле. Убедитесь, что первый столбец содержит имена игроков, а второй - их позиции.",
        });
        return;
      }

      // Создаем данные турнира
      const tournamentData: TournamentUploadData = {
        tournament_name,
        tournament_date,
        results,
      };

      // Сохраняем в базу данных
      const tournamentId = await TournamentModel.uploadTournamentData(
        tournamentData
      );

      res.json({
        success: true,
        message: `Турнир "${tournament_name}" успешно загружен`,
        tournament_id: tournamentId,
        results_count: results.length,
      });
    } catch (error) {
      console.error("Ошибка загрузки турнира:", error);
      res.status(500).json({
        success: false,
        message: "Ошибка при загрузке турнира",
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

  // Обновить игрока (админ)
  static async updatePlayer(req: Request, res: Response): Promise<void> {
    try {
      const playerId = parseInt(req.params.playerId);
      const { name } = req.body;

      if (isNaN(playerId) || !name) {
        res.status(400).json({
          success: false,
          message: "ID игрока и имя обязательны",
        });
        return;
      }

      const success = await PlayerModel.updatePlayer(playerId, name);

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
}
