import { Request, Response } from "express";
import { TeamModel, TeamWithMembers } from "../models/TeamModel";
import { PlayerModel } from "../models/PlayerModel";
import { TournamentModel } from "../models/TournamentModel";
import {
  TeamRating,
  TournamentResultWithTournament,
  TournamentTeamUploadData,
} from "../types";

export class TeamController {
  /**
   * Получить все команды
   */
  static async getAllTeams(req: Request, res: Response) {
    try {
      const teams = await TeamModel.getAllTeams();
      res.json({ success: true, teams });
    } catch (error) {
      console.error("Ошибка получения команд:", error);
      res.status(500).json({
        success: false,
        message: "Ошибка получения команд",
      });
    }
  }

  /**
   * Получить команду по ID с участниками
   */
  static async getTeamById(req: Request, res: Response) {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({
          success: false,
          message: "Некорректный ID команды",
        });
      }

      const team = await TeamModel.getTeamById(id);
      if (!team) {
        return res.status(404).json({
          success: false,
          message: "Команда не найдена",
        });
      }

      // Получаем участников команды
      const members = await TeamModel.getTeamMembers(team);

      res.json({ success: true, team: { ...team, members } });
    } catch (error) {
      console.error("Ошибка получения команды:", error);
      res.status(500).json({
        success: false,
        message: "Ошибка получения команды",
      });
    }
  }

  /**
   * Получить команды турнира
   */
  static async getTeamsByTournament(req: Request, res: Response) {
    try {
      const tournamentId = parseInt(req.params.tournamentId);
      if (isNaN(tournamentId)) {
        return res.status(400).json({
          success: false,
          message: "Некорректный ID турнира",
        });
      }

      const teams = await TeamModel.getTeamsByTournament(tournamentId);
      res.json({ success: true, teams });
    } catch (error) {
      console.error("Ошибка получения команд турнира:", error);
      res.status(500).json({
        success: false,
        message: "Ошибка получения команд турнира",
      });
    }
  }

  /**
   * Создать команду
   */
  static async createTeam(req: Request, res: Response) {
    try {
      const { name, tournament_id, player_ids } = req.body;

      if (
        !name ||
        !tournament_id ||
        !player_ids ||
        !Array.isArray(player_ids)
      ) {
        return res.status(400).json({
          success: false,
          message:
            "Отсутствуют обязательные поля: name, tournament_id, player_ids",
        });
      }

      if (player_ids.length < 1 || player_ids.length > 4) {
        return res.status(400).json({
          success: false,
          message: "В команде должно быть от 1 до 4 игроков",
        });
      }

      const teamId = await TeamModel.createTeam(player_ids);
      const team = await TeamModel.getTeamById(teamId);
      const members = team ? await TeamModel.getTeamMembers(team) : [];

      res.status(201).json({ success: true, team: { ...team, members } });
    } catch (error) {
      console.error("Ошибка создания команды:", error);
      res.status(500).json({
        success: false,
        message:
          error instanceof Error ? error.message : "Ошибка создания команды",
      });
    }
  }

  /**
   * Обновить команду
   */
  static async updateTeam(req: Request, res: Response) {
    try {
      const id = parseInt(req.params.id);
      const { name, player_ids } = req.body;

      if (isNaN(id)) {
        return res.status(400).json({
          success: false,
          message: "Некорректный ID команды",
        });
      }

      if (!name || !player_ids || !Array.isArray(player_ids)) {
        return res.status(400).json({
          success: false,
          message: "Отсутствуют обязательные поля: name, player_ids",
        });
      }

      if (player_ids.length < 1 || player_ids.length > 4) {
        return res.status(400).json({
          success: false,
          message: "В команде должно быть от 1 до 4 игроков",
        });
      }

      // В новой архитектуре команды глобальные и не изменяются
      // Вместо обновления создаем новую команду или находим существующую
      let existingTeam = await TeamModel.findExistingTeam(player_ids);

      let team;
      let members;

      if (existingTeam) {
        team = existingTeam;
        members = await TeamModel.getTeamMembers(team);
      } else {
        const teamId = await TeamModel.createTeam(player_ids);
        team = await TeamModel.getTeamById(teamId);
        members = team ? await TeamModel.getTeamMembers(team) : [];
      }

      res.json({ success: true, team: { ...team, members } });
    } catch (error) {
      console.error("Ошибка обновления команды:", error);
      res.status(500).json({
        success: false,
        message:
          error instanceof Error ? error.message : "Ошибка обновления команды",
      });
    }
  }

  /**
   * Удалить команду
   */
  static async deleteTeam(req: Request, res: Response) {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({
          success: false,
          message: "Некорректный ID команды",
        });
      }

      const success = await TeamModel.deleteTeam(id);
      if (!success) {
        return res.status(404).json({
          success: false,
          message: "Команда не найдена",
        });
      }

      res.json({ success: true, message: "Команда удалена" });
    } catch (error) {
      console.error("Ошибка удаления команды:", error);
      res.status(500).json({
        success: false,
        message: "Ошибка удаления команды",
      });
    }
  }

  /**
   * Удалить все команды
   */
  static async deleteAllTeams(req: Request, res: Response) {
    try {
      const deletedCount = await TeamModel.deleteAllTeams();

      res.json({
        success: true,
        message: `Удалено команд: ${deletedCount}`,
        deleted_count: deletedCount,
      });
    } catch (error) {
      console.error("Ошибка удаления всех команд:", error);
      res.status(500).json({
        success: false,
        message: "Ошибка удаления всех команд",
      });
    }
  }

  /**
   * Получить рейтинг команд
   */
  static async getTeamRatings(req: Request, res: Response) {
    try {
      // Получаем количество лучших результатов из настроек
      const [settingsRows] = await (
        await import("../config/database")
      ).pool.execute<any>(
        'SELECT setting_value FROM rating_settings WHERE setting_name = "best_results_count"'
      );
      const bestResultsCount = parseInt(settingsRows[0]?.setting_value || "8");

      // Получаем все команды с лицензированными игроками
      const [teamRows] = await (
        await import("../config/database")
      ).pool.execute<any>(
        `
        SELECT DISTINCT
          t.id as team_id,
          GROUP_CONCAT(p.name ORDER BY p.name SEPARATOR ' ') as team_name,
          0 as tournament_id
        FROM teams t
        JOIN team_players tp ON t.id = tp.team_id
        JOIN players p ON tp.player_id = p.id
        WHERE EXISTS (
          SELECT 1 FROM licensed_players lp 
          WHERE lp.year = YEAR(CURDATE()) AND lp.is_active = TRUE AND lp.player_id = p.id
        )
        GROUP BY t.id
        ORDER BY team_name
        `
      );

      const ratings: TeamRating[] = [];

      for (const team of teamRows) {
        // Получаем участников команды
        const members = await TeamModel.getTeamMembers(team.team_id);
        const players = members.map((m) => m.player_name);

        // Получаем все результаты команды из tournament_results
        const [resultsRows] = await (
          await import("../config/database")
        ).pool.execute<any>(
          `
          SELECT 
            tr.id,
            tr.tournament_id,
            tr.team_id,
            tr.cup_position,
            tr.points,
            tr.cup,
            tr.created_at,
            tr.updated_at,
            t.name as tournament_name,
            t.date as tournament_date
          FROM tournament_results tr
          JOIN tournaments t ON tr.tournament_id = t.id
          WHERE tr.team_id = ?
          ORDER BY tr.points DESC, t.date DESC
        `,
          [team.team_id]
        );

        const allResults: TournamentResultWithTournament[] = resultsRows.map(
          (row: any, index: number) =>
            ({
              ...row,
              is_counted: index < bestResultsCount,
            } as TournamentResultWithTournament)
        );

        // Берем только лучшие результаты для подсчета рейтинга
        const bestResults = allResults.slice(0, bestResultsCount);
        const totalPoints = bestResults.reduce(
          (sum, result) => sum + result.points,
          0
        );

        ratings.push({
          team_id: team.team_id,
          team_name: team.team_name,
          players: players,
          total_points: totalPoints,
          best_results: bestResults,
          all_results: allResults,
        });
      }

      // Сортируем по общему рейтингу
      ratings.sort((a, b) => b.total_points - a.total_points);

      res.json({ success: true, ratings });
    } catch (error) {
      console.error("Ошибка получения рейтинга команд:", error);
      res.status(500).json({
        success: false,
        message: "Ошибка получения рейтинга команд",
      });
    }
  }
}
