import { Request, Response } from "express";
import { PlayerModel } from "../models/PlayerModel";
import { RatingTableRow } from "../types";

export class RatingController {
  // Получить таблицу рейтинга (публичный доступ)
  static async getRatingTable(req: Request, res: Response): Promise<void> {
    try {
      const playerRatings = await PlayerModel.getPlayerRatings();

      // Формируем таблицу рейтинга с позициями
      const ratingTable: RatingTableRow[] = playerRatings.map(
        (player, index) => ({
          rank: index + 1,
          player_id: player.player_id,
          player_name: player.player_name,
          total_points: player.total_points,
        })
      );

      res.json({
        success: true,
        data: ratingTable,
      });
    } catch (error) {
      console.error("Ошибка получения рейтинга:", error);
      res.status(500).json({
        success: false,
        message: "Ошибка получения рейтинга",
      });
    }
  }

  // Получить детальную информацию о рейтинге игрока (публичный доступ)
  static async getPlayerDetails(req: Request, res: Response): Promise<void> {
    try {
      const playerId = parseInt(req.params.playerId);

      if (isNaN(playerId)) {
        res.status(400).json({
          success: false,
          message: "Неверный ID игрока",
        });
        return;
      }

      const playerRating = await PlayerModel.getPlayerRating(playerId);

      if (!playerRating) {
        res.status(404).json({
          success: false,
          message: "Игрок не найден",
        });
        return;
      }

      res.json({
        success: true,
        data: playerRating,
      });
    } catch (error) {
      console.error("Ошибка получения данных игрока:", error);
      res.status(500).json({
        success: false,
        message: "Ошибка получения данных игрока",
      });
    }
  }

  // Получить полную таблицу рейтинга с детальными данными (публичный доступ)
  static async getFullRatingTable(req: Request, res: Response): Promise<void> {
    try {
      const playerRatings = await PlayerModel.getPlayerRatings();

      // Добавляем позиции в рейтинге
      const fullRatingTable = playerRatings.map((player, index) => ({
        ...player,
        rank: index + 1,
      }));

      res.json({
        success: true,
        data: fullRatingTable,
      });
    } catch (error) {
      console.error("Ошибка получения полного рейтинга:", error);
      res.status(500).json({
        success: false,
        message: "Ошибка получения полного рейтинга",
      });
    }
  }
}
