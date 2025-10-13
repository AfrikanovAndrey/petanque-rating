import { Request, Response } from "express";
import { pool } from "../config/database";
import { RowDataPacket } from "mysql2";
import { RatingTableRow } from "../types";

export class RatingController {
  // Получить таблицу рейтинга (публичный доступ) по tournament_results, агрегируя по игрокам через их команды
  static async getRatingTable(req: Request, res: Response): Promise<void> {
    try {
      const [settingsRows] = await pool.execute<RowDataPacket[]>(
        'SELECT setting_value FROM rating_settings WHERE setting_name = "best_results_count"'
      );
      const bestResultsCount = parseInt(settingsRows[0]?.setting_value || "8");

      // Берем только активных лицензированных игроков текущего года
      const currentYear = new Date().getFullYear();
      const [playersRows] = await pool.execute<RowDataPacket[]>(
        `SELECT p.id as player_id, p.name as player_name, p.gender
         FROM players p
         JOIN licensed_players lp ON lp.player_id = p.id AND lp.year = ? AND lp.is_active = TRUE
         ORDER BY p.name`,
        [currentYear]
      );

      // Для каждого игрока собираем его командные результаты и считаем сумму лучших N
      const ratingTable: RatingTableRow[] = [];
      for (const row of playersRows as any[]) {
        const playerId = row.player_id;
        const playerName = row.player_name;

        const [results] = await pool.execute<RowDataPacket[]>(
          `SELECT 
              tr.id,
              tr.points,
              t.date as tournament_date
           FROM tournament_results tr
           JOIN teams tm ON tr.team_id = tm.id
           JOIN team_players tp ON tm.id = tp.team_id
           JOIN tournaments t ON tr.tournament_id = t.id
           WHERE tp.player_id = ? AND tr.points > 0
           ORDER BY tr.points DESC, t.date DESC`,
          [playerId]
        );

        const best = (results as any[]).slice(0, bestResultsCount);
        const totalPoints = best.reduce((s, r) => s + (r.points || 0), 0);

        ratingTable.push({
          rank: 0,
          player_id: playerId,
          player_name: playerName,
          total_points: totalPoints,
        });
      }

      ratingTable.sort((a, b) => b.total_points - a.total_points);
      ratingTable.forEach((r, i) => (r.rank = i + 1));

      res.json({ success: true, data: ratingTable });
    } catch (error) {
      console.error("Ошибка получения рейтинга:", error);
      res
        .status(500)
        .json({ success: false, message: "Ошибка получения рейтинга" });
    }
  }

  // Получить полную таблицу рейтинга с детальными данными (публичный доступ)
  static async getFullRatingTable(req: Request, res: Response): Promise<void> {
    try {
      const [settingsRows] = await pool.execute<RowDataPacket[]>(
        'SELECT setting_value FROM rating_settings WHERE setting_name = "best_results_count"'
      );
      const bestResultsCount = parseInt(settingsRows[0]?.setting_value || "8");

      const currentYear = new Date().getFullYear();
      const [playersRows] = await pool.execute<RowDataPacket[]>(
        `SELECT p.id as player_id, p.name as player_name
         FROM players p
         JOIN licensed_players lp ON lp.player_id = p.id AND lp.year = ? AND lp.is_active = TRUE
         ORDER BY p.name`,
        [currentYear]
      );

      const result: any[] = [];
      for (const row of playersRows as any[]) {
        const playerId = row.player_id;
        const playerName = row.player_name;

        const [results] = await pool.execute<RowDataPacket[]>(
          `SELECT 
              tr.id, tr.tournament_id, tr.team_id, tr.cup_position, tr.points, tr.cup, tr.qualifying_wins,
              t.name as tournament_name, t.date as tournament_date,
              GROUP_CONCAT(p2.name ORDER BY p2.name SEPARATOR ', ') as team_players
           FROM tournament_results tr
           JOIN teams tm ON tr.team_id = tm.id
           JOIN team_players tp ON tm.id = tp.team_id
           JOIN players p2 ON tp.player_id = p2.id
           JOIN tournaments t ON tr.tournament_id = t.id
           WHERE EXISTS (
             SELECT 1 FROM team_players tp2 WHERE tp2.team_id = tr.team_id AND tp2.player_id = ?
           ) AND tr.points > 0
           GROUP BY tr.id
           ORDER BY tr.points DESC, t.date DESC`,
          [playerId]
        );

        const allResults = (results as any[]).map((r, idx) => ({
          ...r,
          is_counted: idx < bestResultsCount,
        }));
        const best = allResults.slice(0, bestResultsCount);
        const totalPoints = best.reduce((s, r) => s + (r.points || 0), 0);

        result.push({
          rank: 0,
          player_id: playerId,
          player_name: playerName,
          total_points: totalPoints,
          best_results: best,
          all_results: allResults,
        });
      }

      result.sort((a, b) => b.total_points - a.total_points);
      result.forEach((r, i) => (r.rank = i + 1));

      res.json({ success: true, data: result });
    } catch (error) {
      console.error("Ошибка получения полного рейтинга:", error);
      res
        .status(500)
        .json({ success: false, message: "Ошибка получения полного рейтинга" });
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

      // Деталка игрока по tournament_results
      const [settingsRows] = await pool.execute<RowDataPacket[]>(
        'SELECT setting_value FROM rating_settings WHERE setting_name = "best_results_count"'
      );
      const bestResultsCount = parseInt(settingsRows[0]?.setting_value || "8");

      const [playerRows] = await pool.execute<RowDataPacket[]>(
        "SELECT * FROM players WHERE id = ?",
        [playerId]
      );
      if (playerRows.length === 0) {
        res.status(404).json({ success: false, message: "Игрок не найден" });
        return;
      }

      const [results] = await pool.execute<RowDataPacket[]>(
        `SELECT 
            tr.id, tr.tournament_id, tr.team_id, tr.cup_position, tr.points, tr.cup, tr.qualifying_wins,
            t.name as tournament_name, t.date as tournament_date,
            GROUP_CONCAT(p2.name ORDER BY p2.name SEPARATOR ', ') as team_players
         FROM tournament_results tr
         JOIN teams tm ON tr.team_id = tm.id
         JOIN team_players tp ON tm.id = tp.team_id
         JOIN players p2 ON tp.player_id = p2.id
         JOIN tournaments t ON tr.tournament_id = t.id
         WHERE EXISTS (
           SELECT 1 FROM team_players tp2 WHERE tp2.team_id = tr.team_id AND tp2.player_id = ?
         ) AND tr.points > 0
         GROUP BY tr.id
         ORDER BY tr.points DESC, t.date DESC`,
        [playerId]
      );

      const allResults = (results as any[]).map((r, idx) => ({
        ...r,
        is_counted: idx < bestResultsCount,
      }));
      const best = allResults.slice(0, bestResultsCount);
      const totalPoints = best.reduce((s, r) => s + (r.points || 0), 0);

      const playerRating = {
        player_id: playerId,
        player_name: (playerRows[0] as any).name,
        total_points: totalPoints,
        best_results: best,
        all_results: allResults,
      } as any;

      res.json({ success: true, data: playerRating });
    } catch (error) {
      console.error("Ошибка получения данных игрока:", error);
      res
        .status(500)
        .json({ success: false, message: "Ошибка получения данных игрока" });
    }
  }

  // Получить мужской рейтинг (публичный доступ)
  static async getMaleRatingTable(req: Request, res: Response): Promise<void> {
    try {
      const [settingsRows] = await pool.execute<RowDataPacket[]>(
        'SELECT setting_value FROM rating_settings WHERE setting_name = "best_results_count"'
      );
      const bestResultsCount = parseInt(settingsRows[0]?.setting_value || "8");

      const currentYear = new Date().getFullYear();
      const [playersRows] = await pool.execute<RowDataPacket[]>(
        `SELECT p.id as player_id, p.name as player_name
         FROM players p
         JOIN licensed_players lp ON lp.player_id = p.id AND lp.year = ? AND lp.is_active = TRUE
         WHERE p.gender = 'male'
         ORDER BY p.name`,
        [currentYear]
      );

      const playerRatings: any[] = [];
      for (const row of playersRows as any[]) {
        const playerId = row.player_id;
        const playerName = row.player_name;
        const [results] = await pool.execute<RowDataPacket[]>(
          `SELECT 
             tr.id, tr.tournament_id, tr.team_id, tr.cup_position, tr.points, tr.cup, tr.qualifying_wins,
             t.name as tournament_name, t.date as tournament_date, t.type as tournament_type,
             GROUP_CONCAT(p2.name ORDER BY p2.name SEPARATOR ', ') as team_players
           FROM tournament_results tr
           JOIN teams tm ON tr.team_id = tm.id
           JOIN team_players tp ON tm.id = tp.team_id
           JOIN players p2 ON tp.player_id = p2.id
           JOIN tournaments t ON tr.tournament_id = t.id
           WHERE EXISTS (
             SELECT 1 FROM team_players tp2 WHERE tp2.team_id = tr.team_id AND tp2.player_id = ?
           ) AND tr.points > 0
           GROUP BY tr.id
           ORDER BY tr.points DESC, t.date DESC`,
          [playerId]
        );
        const allResults = (results as any[]).map((r, idx) => ({
          ...r,
          is_counted: idx < bestResultsCount,
        }));
        const best = allResults.slice(0, bestResultsCount);
        const totalPoints = best.reduce((s, r) => s + (r.points || 0), 0);
        playerRatings.push({
          rank: 0,
          player_id: playerId,
          player_name: playerName,
          total_points: totalPoints,
          best_results: best,
          all_results: allResults,
        });
      }

      playerRatings.sort((a, b) => b.total_points - a.total_points);
      playerRatings.forEach((r, i) => (r.rank = i + 1));
      res.json({
        success: true,
        data: playerRatings,
        gender: "male",
        count: playerRatings.length,
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
      const [settingsRows] = await pool.execute<RowDataPacket[]>(
        'SELECT setting_value FROM rating_settings WHERE setting_name = "best_results_count"'
      );
      const bestResultsCount = parseInt(settingsRows[0]?.setting_value || "8");

      const currentYear = new Date().getFullYear();
      const [playersRows] = await pool.execute<RowDataPacket[]>(
        `SELECT p.id as player_id, p.name as player_name
         FROM players p
         JOIN licensed_players lp ON lp.player_id = p.id AND lp.year = ? AND lp.is_active = TRUE
         WHERE p.gender = 'female'
         ORDER BY p.name`,
        [currentYear]
      );

      const playerRatings: any[] = [];
      for (const row of playersRows as any[]) {
        const playerId = row.player_id;
        const playerName = row.player_name;
        const [results] = await pool.execute<RowDataPacket[]>(
          `SELECT 
             tr.id, tr.tournament_id, tr.team_id, tr.cup_position, tr.points, tr.cup, tr.qualifying_wins,
             t.name as tournament_name, t.date as tournament_date, t.type as tournament_type,
             GROUP_CONCAT(p2.name ORDER BY p2.name SEPARATOR ', ') as team_players
           FROM tournament_results tr
           JOIN teams tm ON tr.team_id = tm.id
           JOIN team_players tp ON tm.id = tp.team_id
           JOIN players p2 ON tp.player_id = p2.id
           JOIN tournaments t ON tr.tournament_id = t.id
           WHERE EXISTS (
             SELECT 1 FROM team_players tp2 WHERE tp2.team_id = tr.team_id AND tp2.player_id = ?
           ) AND tr.points > 0
           GROUP BY tr.id
           ORDER BY tr.points DESC, t.date DESC`,
          [playerId]
        );
        const allResults = (results as any[]).map((r, idx) => ({
          ...r,
          is_counted: idx < bestResultsCount,
        }));
        const best = allResults.slice(0, bestResultsCount);
        const totalPoints = best.reduce((s, r) => s + (r.points || 0), 0);
        playerRatings.push({
          rank: 0,
          player_id: playerId,
          player_name: playerName,
          total_points: totalPoints,
          best_results: best,
          all_results: allResults,
        });
      }

      playerRatings.sort((a, b) => b.total_points - a.total_points);
      playerRatings.forEach((r, i) => (r.rank = i + 1));
      res.json({
        success: true,
        data: playerRatings,
        gender: "female",
        count: playerRatings.length,
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

      const validGenders = ["male", "female"];
      if (gender && !validGenders.includes(gender)) {
        res.status(400).json({
          success: false,
          message: `Неверный параметр пола. Допустимые значения: ${validGenders}`,
        });
        return;
      }

      // По умолчанию отдаем мужской рейтинг (обратная совместимость)
      if (!gender || gender === "male") {
        return await RatingController.getMaleRatingTable(req, res);
      }

      return await RatingController.getFemaleRatingTable(req, res);
    } catch (error) {
      console.error("Ошибка получения рейтингов по полу:", error);
      res.status(500).json({
        success: false,
        message: "Ошибка получения рейтингов по полу",
      });
    }
  }
}
