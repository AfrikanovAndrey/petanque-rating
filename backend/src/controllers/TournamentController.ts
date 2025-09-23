import { Request, Response } from "express";
import { TournamentModel } from "../models/TournamentModel";

export class TournamentController {
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

      res.json({
        success: true,
        data: {
          ...tournament,
          results: results.sort((a, b) => a.position - b.position),
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
}
