import { Request, Response } from "express";
import { PlayerTournamentPointsModel } from "../models/PlayerTournamentPointsModel";
import { RatingTableRow } from "../types";

export class RatingController {
  // Получить таблицу рейтинга (публичный доступ)
  static async getRatingTable(req: Request, res: Response): Promise<void> {
    try {
      const playerRatings =
        await PlayerTournamentPointsModel.getPlayerRatings();

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

      const playerRating = await PlayerTournamentPointsModel.getPlayerRating(
        playerId
      );

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
      const playerRatings =
        await PlayerTournamentPointsModel.getPlayerRatings();

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

  // Получить мужской рейтинг (публичный доступ)
  static async getMaleRatingTable(req: Request, res: Response): Promise<void> {
    try {
      const playerRatings =
        await PlayerTournamentPointsModel.getMalePlayerRatings();

      // Формируем таблицу рейтинга с позициями
      const ratingTable = playerRatings.map((player, index) => ({
        rank: index + 1,
        player_id: player.player_id,
        player_name: player.player_name,
        gender: player.gender,
        total_points: player.total_points,
      }));

      res.json({
        success: true,
        data: ratingTable,
        gender: "male",
        count: ratingTable.length,
      });
    } catch (error) {
      console.error("Ошибка получения мужского рейтинга:", error);
      res.status(500).json({
        success: false,
        message: "Ошибка получения мужского рейтинга",
      });
    }
  }

  // Получить женский рейтинг (публичный доступ)
  static async getFemaleRatingTable(
    req: Request,
    res: Response
  ): Promise<void> {
    try {
      const playerRatings =
        await PlayerTournamentPointsModel.getFemalePlayerRatings();

      // Формируем таблицу рейтинга с позициями
      const ratingTable = playerRatings.map((player, index) => ({
        rank: index + 1,
        player_id: player.player_id,
        player_name: player.player_name,
        gender: player.gender,
        total_points: player.total_points,
      }));

      res.json({
        success: true,
        data: ratingTable,
        gender: "female",
        count: ratingTable.length,
      });
    } catch (error) {
      console.error("Ошибка получения женского рейтинга:", error);
      res.status(500).json({
        success: false,
        message: "Ошибка получения женского рейтинга",
      });
    }
  }

  // Получить рейтинги разделенные по полу (публичный доступ)
  static async getRatingsByGender(req: Request, res: Response): Promise<void> {
    try {
      const gender = req.query.gender as string;

      // Валидация параметра пола
      const validGenders = ["male", "female"];
      if (gender && !validGenders.includes(gender)) {
        res.status(400).json({
          success: false,
          message: `Неверный параметр пола. Допустимые значения: ${validGenders}`,
        });
        return;
      }

      // Если параметр пола не указан, возвращаем все рейтинги
      if (!gender) {
        const ratingsByGender =
          await PlayerTournamentPointsModel.getPlayerRatingsByGender();

        // Добавляем позиции для каждого рейтинга
        const maleWithRanks = ratingsByGender.map((player, index) => ({
          ...player,
          rank: index + 1,
        }));

        res.json({
          success: true,
          data: maleWithRanks,
          gender: "male",
          count: maleWithRanks.length,
        });
        return;
      }

      // Получаем рейтинги для конкретного пола
      const ratingsForGender =
        await PlayerTournamentPointsModel.getPlayerRatingsByGender(gender);

      // Добавляем позиции в рейтинге
      const ratingsWithRanks = ratingsForGender.map((player, index) => ({
        ...player,
        rank: index + 1,
      }));

      res.json({
        success: true,
        data: ratingsWithRanks,
        gender: gender,
        count: ratingsWithRanks.length,
      });
    } catch (error) {
      console.error("Ошибка получения рейтингов по полу:", error);
      res.status(500).json({
        success: false,
        message: "Ошибка получения рейтингов по полу",
      });
    }
  }
}
