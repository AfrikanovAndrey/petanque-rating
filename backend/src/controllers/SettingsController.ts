import { Request, Response } from "express";
import { SettingsModel } from "../models/SettingsModel";

export class SettingsController {
  // Получить количество лучших результатов для рейтинга (админ)
  // Можно передать ?year=2024 для получения настройки за конкретный год
  static async getBestResultsCount(req: Request, res: Response): Promise<void> {
    try {
      const year = req.query.year
        ? parseInt(req.query.year as string)
        : undefined;
      const count = await SettingsModel.getBestResultsCount(year);
      res.json({
        success: true,
        data: {
          best_results_count: count,
          year: year || new Date().getFullYear(),
        },
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
  // Можно передать year в теле запроса для установки за конкретный год
  static async setBestResultsCount(req: Request, res: Response): Promise<void> {
    try {
      const { count, year } = req.body;

      if (typeof count !== "number" || count < 1 || count > 50) {
        res.status(400).json({
          success: false,
          message: "Количество должно быть числом от 1 до 50",
        });
        return;
      }

      const targetYear = year ? parseInt(year) : new Date().getFullYear();
      const success = await SettingsModel.setBestResultsCount(
        count,
        targetYear
      );

      if (success) {
        res.json({
          success: true,
          message: `Количество лучших результатов для ${targetYear} года установлено: ${count}`,
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

  // Получить best_results_count для всех годов
  static async getBestResultsCountByYears(
    req: Request,
    res: Response
  ): Promise<void> {
    try {
      const settings = await SettingsModel.getBestResultsCountByYears();
      res.json({
        success: true,
        data: settings,
      });
    } catch (error) {
      console.error("Ошибка получения настроек по годам:", error);
      res.status(500).json({
        success: false,
        message: "Ошибка получения настроек по годам",
      });
    }
  }
}
