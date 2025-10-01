import { Request, Response } from "express";
import { PlayerTournamentPointsModel } from "../models/PlayerTournamentPointsModel";

export class PlayerTournamentPointsController {
  // Получить все очки игрока
  static async getPlayerPoints(req: Request, res: Response): Promise<void> {
    try {
      const playerId = parseInt(req.params.playerId);

      if (isNaN(playerId)) {
        res.status(400).json({
          success: false,
          message: "Неверный ID игрока",
        });
        return;
      }

      const points =
        await PlayerTournamentPointsModel.getPlayerTournamentPoints(playerId);

      res.json({
        success: true,
        data: points,
      });
    } catch (error) {
      console.error("Ошибка получения очков игрока:", error);
      res.status(500).json({
        success: false,
        message: "Ошибка получения очков игрока",
      });
    }
  }

  // Получить очки всех игроков за турнир
  static async getTournamentPoints(req: Request, res: Response): Promise<void> {
    try {
      const tournamentId = parseInt(req.params.tournamentId);

      if (isNaN(tournamentId)) {
        res.status(400).json({
          success: false,
          message: "Неверный ID турнира",
        });
        return;
      }

      const points =
        await PlayerTournamentPointsModel.getTournamentPlayerPoints(
          tournamentId
        );

      res.json({
        success: true,
        data: points,
      });
    } catch (error) {
      console.error("Ошибка получения очков за турнир:", error);
      res.status(500).json({
        success: false,
        message: "Ошибка получения очков за турнир",
      });
    }
  }

  // Создать очки игрока за турнир
  static async createPlayerPoints(req: Request, res: Response): Promise<void> {
    try {
      const { player_id, tournament_id, points } = req.body;

      if (!player_id || !tournament_id || points === undefined) {
        res.status(400).json({
          success: false,
          message: "Необходимо указать player_id, tournament_id и points",
        });
        return;
      }

      const id = await PlayerTournamentPointsModel.createPlayerTournamentPoints(
        player_id,
        tournament_id,
        points
      );

      res.status(201).json({
        success: true,
        data: { id },
        message: "Очки игрока созданы успешно",
      });
    } catch (error) {
      console.error("Ошибка создания очков игрока:", error);

      // Проверяем на ошибку дублирования
      if ((error as any).code === "ER_DUP_ENTRY") {
        res.status(400).json({
          success: false,
          message: "Очки для этого игрока в данном турнире уже существуют",
        });
        return;
      }

      res.status(500).json({
        success: false,
        message: "Ошибка создания очков игрока",
      });
    }
  }

  // Обновить очки игрока за турнир
  static async updatePlayerPoints(req: Request, res: Response): Promise<void> {
    try {
      const id = parseInt(req.params.id);
      const { points } = req.body;

      if (isNaN(id)) {
        res.status(400).json({
          success: false,
          message: "Неверный ID записи",
        });
        return;
      }

      if (points === undefined) {
        res.status(400).json({
          success: false,
          message: "Необходимо указать points",
        });
        return;
      }

      const success =
        await PlayerTournamentPointsModel.updatePlayerTournamentPoints(
          id,
          points
        );

      if (!success) {
        res.status(404).json({
          success: false,
          message: "Запись не найдена",
        });
        return;
      }

      res.json({
        success: true,
        message: "Очки обновлены успешно",
      });
    } catch (error) {
      console.error("Ошибка обновления очков игрока:", error);
      res.status(500).json({
        success: false,
        message: "Ошибка обновления очков игрока",
      });
    }
  }

  // Удалить очки игрока за турнир
  static async deletePlayerPoints(req: Request, res: Response): Promise<void> {
    try {
      const id = parseInt(req.params.id);

      if (isNaN(id)) {
        res.status(400).json({
          success: false,
          message: "Неверный ID записи",
        });
        return;
      }

      const success =
        await PlayerTournamentPointsModel.deletePlayerTournamentPoints(id);

      if (!success) {
        res.status(404).json({
          success: false,
          message: "Запись не найдена",
        });
        return;
      }

      res.json({
        success: true,
        message: "Очки удалены успешно",
      });
    } catch (error) {
      console.error("Ошибка удаления очков игрока:", error);
      res.status(500).json({
        success: false,
        message: "Ошибка удаления очков игрока",
      });
    }
  }

  // Удалить все очки игроков за турнир
  static async deleteTournamentPoints(
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

      const success =
        await PlayerTournamentPointsModel.deleteTournamentPlayerPoints(
          tournamentId
        );

      res.json({
        success: true,
        message: `Очки за турнир ${success ? "удалены" : "не найдены"}`,
      });
    } catch (error) {
      console.error("Ошибка удаления очков за турнир:", error);
      res.status(500).json({
        success: false,
        message: "Ошибка удаления очков за турнир",
      });
    }
  }

  // Синхронизировать очки из tournament_results
  static async syncFromTournamentResults(
    req: Request,
    res: Response
  ): Promise<void> {
    try {
      await PlayerTournamentPointsModel.syncFromTournamentResults();

      res.json({
        success: true,
        message: "Синхронизация очков выполнена успешно",
      });
    } catch (error) {
      console.error("Ошибка синхронизации очков:", error);
      res.status(500).json({
        success: false,
        message: "Ошибка синхронизации очков",
      });
    }
  }
}
