import { pool } from "../config/database";
import { Player, PlayerRating, TournamentResultWithTournament } from "../types";
import { ResultSetHeader, RowDataPacket } from "mysql2";

export class PlayerModel {
  static async getAllPlayers(): Promise<Player[]> {
    const [rows] = await pool.execute<Player[] & RowDataPacket[]>(
      "SELECT * FROM players ORDER BY name"
    );
    return rows;
  }

  static async getPlayerById(id: number): Promise<Player | null> {
    const [rows] = await pool.execute<Player[] & RowDataPacket[]>(
      "SELECT * FROM players WHERE id = ?",
      [id]
    );
    return rows[0] || null;
  }

  static async getPlayerByName(name: string): Promise<Player | null> {
    const [rows] = await pool.execute<Player[] & RowDataPacket[]>(
      "SELECT * FROM players WHERE name = ?",
      [name]
    );
    return rows[0] || null;
  }

  static async createPlayer(name: string): Promise<number> {
    const [result] = await pool.execute<ResultSetHeader>(
      "INSERT INTO players (name) VALUES (?)",
      [name]
    );
    return result.insertId;
  }

  static async updatePlayer(id: number, name: string): Promise<boolean> {
    const [result] = await pool.execute<ResultSetHeader>(
      "UPDATE players SET name = ? WHERE id = ?",
      [name, id]
    );
    return result.affectedRows > 0;
  }

  static async deletePlayer(id: number): Promise<boolean> {
    const [result] = await pool.execute<ResultSetHeader>(
      "DELETE FROM players WHERE id = ?",
      [id]
    );
    return result.affectedRows > 0;
  }

  static async getPlayerRatings(): Promise<PlayerRating[]> {
    // Получаем количество лучших результатов из настроек
    const [settingsRows] = await pool.execute<RowDataPacket[]>(
      'SELECT setting_value FROM rating_settings WHERE setting_name = "best_results_count"'
    );
    const bestResultsCount = parseInt(settingsRows[0]?.setting_value || "8");

    // Получаем всех игроков с их результатами
    const [playersRows] = await pool.execute<RowDataPacket[]>(`
      SELECT 
        p.id as player_id,
        p.name as player_name
      FROM players p
      ORDER BY p.name
    `);

    const ratings: PlayerRating[] = [];

    for (const player of playersRows) {
      // Получаем все результаты игрока с информацией о турнирах
      const [resultsRows] = await pool.execute<RowDataPacket[]>(
        `
        SELECT 
          tr.id,
          tr.tournament_id,
          tr.player_id,
          tr.position,
          tr.points,
          tr.created_at,
          tr.updated_at,
          t.name as tournament_name,
          t.date as tournament_date
        FROM tournament_results tr
        JOIN tournaments t ON tr.tournament_id = t.id
        WHERE tr.player_id = ?
        ORDER BY tr.points DESC, t.date DESC
      `,
        [player.player_id]
      );

      const allResults: TournamentResultWithTournament[] = resultsRows.map(
        (row: any, index) =>
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
        player_id: player.player_id,
        player_name: player.player_name,
        total_points: totalPoints,
        best_results: bestResults,
        all_results: allResults,
      });
    }

    // Сортируем по общему рейтингу
    return ratings.sort((a, b) => b.total_points - a.total_points);
  }

  static async getPlayerRating(playerId: number): Promise<PlayerRating | null> {
    const player = await this.getPlayerById(playerId);
    if (!player) return null;

    // Получаем количество лучших результатов из настроек
    const [settingsRows] = await pool.execute<RowDataPacket[]>(
      'SELECT setting_value FROM rating_settings WHERE setting_name = "best_results_count"'
    );
    const bestResultsCount = parseInt(settingsRows[0]?.setting_value || "8");

    // Получаем все результаты игрока
    const [resultsRows] = await pool.execute<RowDataPacket[]>(
      `
      SELECT 
        tr.id,
        tr.tournament_id,
        tr.player_id,
        tr.position,
        tr.points,
        tr.created_at,
        tr.updated_at,
        t.name as tournament_name,
        t.date as tournament_date
      FROM tournament_results tr
      JOIN tournaments t ON tr.tournament_id = t.id
      WHERE tr.player_id = ?
      ORDER BY tr.points DESC, t.date DESC
    `,
      [playerId]
    );

    const allResults: TournamentResultWithTournament[] = resultsRows.map(
      (row: any, index) =>
        ({
          ...row,
          is_counted: index < bestResultsCount,
        } as TournamentResultWithTournament)
    );

    const bestResults = allResults.slice(0, bestResultsCount);
    const totalPoints = bestResults.reduce(
      (sum, result) => sum + result.points,
      0
    );

    return {
      player_id: playerId,
      player_name: player.name,
      total_points: totalPoints,
      best_results: bestResults,
      all_results: allResults,
    };
  }
}
