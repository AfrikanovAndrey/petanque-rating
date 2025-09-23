import { Request, Response } from "express";
import { SettingsModel } from "../models/SettingsModel";

export class SettingsController {
  // Получить все настройки очков за позицию (админ)
  static async getPositionPoints(req: Request, res: Response): Promise<void> {
    try {
      const positionPoints = await SettingsModel.getAllPositionPoints();
      res.json({
        success: true,
        data: positionPoints,
      });
    } catch (error) {
      console.error("Ошибка получения настроек очков:", error);
      res.status(500).json({
        success: false,
        message: "Ошибка получения настроек очков",
      });
    }
  }

  // Обновить настройки очков за позицию (админ)
  static async updatePositionPoints(
    req: Request,
    res: Response
  ): Promise<void> {
    try {
      const { positionPoints } = req.body;

      if (!Array.isArray(positionPoints)) {
        res.status(400).json({
          success: false,
          message: "Неверный формат данных",
        });
        return;
      }

      // Валидация данных
      for (const item of positionPoints) {
        if (
          typeof item.position !== "number" ||
          typeof item.points !== "number" ||
          item.position < 1 ||
          item.points < 0
        ) {
          res.status(400).json({
            success: false,
            message: "Неверные данные для позиции или очков",
          });
          return;
        }
      }

      const success = await SettingsModel.updateMultiplePositionPoints(
        positionPoints
      );

      if (success) {
        res.json({
          success: true,
          message: "Настройки очков успешно обновлены",
        });
      } else {
        res.status(500).json({
          success: false,
          message: "Ошибка при обновлении настроек",
        });
      }
    } catch (error) {
      console.error("Ошибка обновления настроек очков:", error);
      res.status(500).json({
        success: false,
        message: "Ошибка при обновлении настроек очков",
      });
    }
  }

  // Добавить/обновить очки для конкретной позиции (админ)
  static async setPositionPoints(req: Request, res: Response): Promise<void> {
    try {
      const { position, points } = req.body;

      if (
        typeof position !== "number" ||
        typeof points !== "number" ||
        position < 1 ||
        points < 0
      ) {
        res.status(400).json({
          success: false,
          message: "Неверные данные для позиции или очков",
        });
        return;
      }

      const success = await SettingsModel.setPointsForPosition(
        position,
        points
      );

      if (success) {
        res.json({
          success: true,
          message: `Очки для ${position} места успешно установлены: ${points}`,
        });
      } else {
        res.status(500).json({
          success: false,
          message: "Ошибка при установке очков",
        });
      }
    } catch (error) {
      console.error("Ошибка установки очков для позиции:", error);
      res.status(500).json({
        success: false,
        message: "Ошибка при установке очков для позиции",
      });
    }
  }

  // Получить количество лучших результатов для рейтинга (админ)
  static async getBestResultsCount(req: Request, res: Response): Promise<void> {
    try {
      const count = await SettingsModel.getBestResultsCount();
      res.json({
        success: true,
        data: { best_results_count: count },
      });
    } catch (error) {
      console.error("Ошибка получения количества лучших результатов:", error);
      res.status(500).json({
        success: false,
        message: "Ошибка получения настройки",
      });
    }
  }

  // Обновить количество лучших результатов для рейтинга (админ)
  static async setBestResultsCount(req: Request, res: Response): Promise<void> {
    try {
      const { count } = req.body;

      if (typeof count !== "number" || count < 1 || count > 50) {
        res.status(400).json({
          success: false,
          message: "Количество должно быть числом от 1 до 50",
        });
        return;
      }

      const success = await SettingsModel.setBestResultsCount(count);

      if (success) {
        res.json({
          success: true,
          message: `Количество лучших результатов установлено: ${count}`,
        });
      } else {
        res.status(500).json({
          success: false,
          message: "Ошибка при обновлении настройки",
        });
      }
    } catch (error) {
      console.error("Ошибка обновления количества лучших результатов:", error);
      res.status(500).json({
        success: false,
        message: "Ошибка при обновлении настройки",
      });
    }
  }

  // Получить все настройки (админ)
  static async getAllSettings(req: Request, res: Response): Promise<void> {
    try {
      const settings = await SettingsModel.getAllSettings();
      res.json({
        success: true,
        data: settings,
      });
    } catch (error) {
      console.error("Ошибка получения настроек:", error);
      res.status(500).json({
        success: false,
        message: "Ошибка получения настроек",
      });
    }
  }

  // Удалить настройку очков для позиции (админ)
  static async deletePositionPoints(
    req: Request,
    res: Response
  ): Promise<void> {
    try {
      const position = parseInt(req.params.position);

      if (isNaN(position) || position < 1) {
        res.status(400).json({
          success: false,
          message: "Неверная позиция",
        });
        return;
      }

      const success = await SettingsModel.deletePositionPoints(position);

      if (success) {
        res.json({
          success: true,
          message: `Настройка очков для ${position} места удалена`,
        });
      } else {
        res.status(404).json({
          success: false,
          message: "Настройка не найдена",
        });
      }
    } catch (error) {
      console.error("Ошибка удаления настройки очков:", error);
      res.status(500).json({
        success: false,
        message: "Ошибка при удалении настройки",
      });
    }
  }
}
