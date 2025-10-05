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

  static async getPlayerByName(name: string): Promise<Player[] | null> {
    let rows: Player[] & RowDataPacket[];

    // Если игрок указан с фамилией и именем (абривеатурой). Например: "Елсвков С"
    if (name.includes(" ")) {
      [rows] = await pool.execute<Player[] & RowDataPacket[]>(
        "SELECT * FROM players WHERE name LIKE ?",
        [`%${name}%`]
      );
    } else {
      // Если указано только одна часть (имя или фамилия). Например: "Федотов" или "Хафидо"
      [rows] = await pool.execute<Player[] & RowDataPacket[]>(
        "SELECT * FROM players WHERE name LIKE ? OR name LIKE ?",
        [`%${name} %`, `% ${name}%`]
      );
    }

    return rows.length ? rows : null;
  }

  static async createPlayer(name: string): Promise<number> {
    const [result] = await pool.execute<ResultSetHeader>(
      "INSERT INTO players (name) VALUES (?)",
      [name]
    );
    return result.insertId;
  }

  static async updatePlayer(
    id: number,
    name: string,
    gender: string
  ): Promise<boolean> {
    const [result] = await pool.execute<ResultSetHeader>(
      "UPDATE players SET name = ?, gender = ? WHERE id = ?",
      [name, gender, id]
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

    // Получаем текущий год для проверки лицензий
    const currentYear = new Date().getFullYear();

    // Получаем только лицензированных игроков - только они могут получать очки рейтинга
    const [playersRows] = await pool.execute<RowDataPacket[]>(
      `
      SELECT 
        p.id as player_id,
        p.name as player_name,
        p.name as licensed_name
      FROM players p
      INNER JOIN licensed_players lp ON (
        lp.year = ? AND lp.is_active = TRUE AND 
        lp.player_id = p.id
      )
      ORDER BY p.name
    `,
      [currentYear]
    );

    const ratings: PlayerRating[] = [];

    for (const player of playersRows) {
      // Получаем все результаты игрока по tournament_results через его команды
      const [resultsRows] = await pool.execute<RowDataPacket[]>(
        `
        SELECT 
          tr.id,
          tr.tournament_id,
          tr.team_id,
          tr.cup_position,
          tr.points,
          tr.cup,
          tr.qualifying_wins,
          tr.created_at,
          tr.updated_at,
          t.name as tournament_name,
          t.date as tournament_date,
          GROUP_CONCAT(p2.name ORDER BY p2.name SEPARATOR ', ') as team_name,
          GROUP_CONCAT(p2.name ORDER BY p2.name SEPARATOR ', ') as team_players
        FROM tournament_results tr
        JOIN tournaments t ON tr.tournament_id = t.id
        JOIN teams tm ON tr.team_id = tm.id
        JOIN team_players tp ON tm.id = tp.team_id
        JOIN players p2 ON tp.player_id = p2.id
        WHERE EXISTS (
          SELECT 1 FROM team_players tp2 
          WHERE tp2.team_id = tr.team_id AND tp2.player_id = ?
        )
        GROUP BY tr.id, t.name, t.date
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
        licensed_name: (player as any).licensed_name, // Полное имя из лицензионной базы
      });
    }

    // Сортируем по общему рейтингу
    return ratings.sort((a, b) => b.total_points - a.total_points);
  }

  static async getPlayerRating(playerId: number): Promise<PlayerRating | null> {
    const player = await this.getPlayerById(playerId);
    if (!player) return null;

    // Получаем текущий год для проверки лицензий
    const currentYear = new Date().getFullYear();

    // Проверяем является ли игрок лицензированным в текущем году
    // Улучшенная логика сопоставления по имени и фамилии
    const playerNameParts = player.name.trim().split(/\s+/);
    const playerFirstName = playerNameParts[0]?.toLowerCase() || "";
    const playerLastName = playerNameParts[1]?.toLowerCase() || "";

    const [licenseCheck] = await pool.execute<RowDataPacket[]>(
      `SELECT COUNT(*) as count FROM licensed_players 
       WHERE year = ? AND is_active = TRUE AND player_id = ?`,
      [currentYear, player.id]
    );

    if ((licenseCheck[0] as any).count === 0) {
      // Если игрок не лицензирован, возвращаем пустой рейтинг
      return {
        player_id: playerId,
        player_name: player.name,
        total_points: 0,
        best_results: [],
        all_results: [],
      };
    }

    // Получаем количество лучших результатов из настроек
    const [settingsRows] = await pool.execute<RowDataPacket[]>(
      'SELECT setting_value FROM rating_settings WHERE setting_name = "best_results_count"'
    );
    const bestResultsCount = parseInt(settingsRows[0]?.setting_value || "8");

    // Получаем все результаты игрока из player_tournament_points
    const [resultsRows] = await pool.execute<RowDataPacket[]>(
      `
      SELECT 
        ptp.id,
        ptp.tournament_id,
        ptp.team_id,
        ptp.cup_position,
        ptp.points,
        ptp.cup,
        ptp.qualifying_wins,
        ptp.created_at,
        ptp.updated_at,
        t.name as tournament_name,
        t.date as tournament_date,
        GROUP_CONCAT(p2.name ORDER BY p2.name SEPARATOR ', ') as team_name,
        GROUP_CONCAT(p2.name ORDER BY p2.name SEPARATOR ', ') as team_players
      FROM player_tournament_points ptp
      JOIN tournaments t ON ptp.tournament_id = t.id
      JOIN teams tm ON ptp.team_id = tm.id
      JOIN team_players tp ON tm.id = tp.team_id
      JOIN players p2 ON tp.player_id = p2.id
      WHERE ptp.player_id = ?
      GROUP BY ptp.id, t.name, t.date
      ORDER BY ptp.points DESC, t.date DESC
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
