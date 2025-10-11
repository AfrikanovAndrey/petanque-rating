import { Request, Response } from "express";
import { SettingsModel } from "../models/SettingsModel";

export class SettingsController {
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
}
