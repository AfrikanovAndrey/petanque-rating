import { pool } from "../config/database";
import {
  PlayerTournamentPoints,
  PlayerRating,
  TournamentResultWithTournament,
} from "../types";
import { ResultSetHeader, RowDataPacket } from "mysql2";
import { detectGender } from "../utils/genderDetector";

export class PlayerTournamentPointsModel {
  // Получить все очки игрока
  static async getPlayerTournamentPoints(
    playerId: number
  ): Promise<PlayerTournamentPoints[]> {
    const [rows] = await pool.execute<
      PlayerTournamentPoints[] & RowDataPacket[]
    >(
      `
      SELECT 
        ptp.*,
        p.name as player_name,
        t.name as tournament_name,
        t.date as tournament_date
      FROM player_tournament_points ptp
      JOIN players p ON ptp.player_id = p.id
      JOIN tournaments t ON ptp.tournament_id = t.id
      WHERE ptp.player_id = ?
      ORDER BY ptp.points DESC, t.date DESC
      `,
      [playerId]
    );
    return rows;
  }

  // Получить все очки игроков за конкретный турнир
  static async getTournamentPlayerPoints(
    tournamentId: number
  ): Promise<PlayerTournamentPoints[]> {
    const [rows] = await pool.execute<
      PlayerTournamentPoints[] & RowDataPacket[]
    >(
      `
      SELECT 
        ptp.*,
        p.name as player_name,
        t.name as tournament_name,
        t.date as tournament_date
      FROM player_tournament_points ptp
      JOIN players p ON ptp.player_id = p.id
      JOIN tournaments t ON ptp.tournament_id = t.id
      WHERE ptp.tournament_id = ?
      ORDER BY ptp.points DESC, p.name
      `,
      [tournamentId]
    );
    return rows;
  }

  // Создать новую запись рейтинговых очков
  static async createPlayerTournamentPoints(
    playerId: number,
    tournamentId: number,
    points: number
  ): Promise<number> {
    const [result] = await pool.execute<ResultSetHeader>(
      `INSERT INTO player_tournament_points
       (player_id, tournament_id, points)
       VALUES (?, ?, ?)`,
      [playerId, tournamentId, points]
    );
    return result.insertId;
  }

  // Создать несколько записей очков игроков (batch insert для оптимизации)
  static async createPlayerTournamentPointsBatch(
    playerPointsData: Array<{
      playerId: number;
      tournamentId: number;
      points: number;
    }>
  ): Promise<number> {
    if (playerPointsData.length === 0) return 0;

    // Создаем VALUES строки для batch insert
    const values = playerPointsData.map(() => "(?, ?, ?)").join(", ");
    const params: number[] = [];

    playerPointsData.forEach((data) => {
      params.push(data.playerId, data.tournamentId, data.points);
    });

    const [result] = await pool.execute<ResultSetHeader>(
      `INSERT INTO player_tournament_points
       (player_id, tournament_id, points)
       VALUES ${values}`,
      params
    );

    return result.affectedRows;
  }

  // Обновить очки игрока за турнир
  static async updatePlayerTournamentPoints(
    id: number,
    points: number
  ): Promise<boolean> {
    const [result] = await pool.execute<ResultSetHeader>(
      "UPDATE player_tournament_points SET points = ? WHERE id = ?",
      [points, id]
    );
    return result.affectedRows > 0;
  }

  // Удалить запись очков игрока за турнир
  static async deletePlayerTournamentPoints(id: number): Promise<boolean> {
    const [result] = await pool.execute<ResultSetHeader>(
      "DELETE FROM player_tournament_points WHERE id = ?",
      [id]
    );
    return result.affectedRows > 0;
  }

  // Удалить все очки игроков за турнир
  static async deleteTournamentPlayerPoints(
    tournamentId: number
  ): Promise<boolean> {
    const [result] = await pool.execute<ResultSetHeader>(
      "DELETE FROM player_tournament_points WHERE tournament_id = ?",
      [tournamentId]
    );
    return result.affectedRows > 0;
  }

  // Получить рейтинг всех игроков на основе новой таблицы
  static async getPlayerRatings(): Promise<PlayerRating[]> {
    // Получаем количество лучших результатов из настроек
    const [settingsRows] = await pool.execute<RowDataPacket[]>(
      'SELECT setting_value FROM rating_settings WHERE setting_name = "best_results_count"'
    );
    const bestResultsCount = parseInt(settingsRows[0]?.setting_value || "8");

    // Получаем текущий год для проверки лицензий
    const currentYear = new Date().getFullYear();

    // Получаем всех активных лицензированных игроков текущего года
    const [licensedPlayersRows] = await pool.execute<RowDataPacket[]>(
      `
      SELECT 
        lp.id as licensed_player_id,
        p.name as licensed_name,
        p.id as player_id,
        p.gender,
        p.name as player_name
      FROM licensed_players lp
      JOIN players p ON lp.player_id = p.id
      WHERE lp.year = ? AND lp.is_active = TRUE
      ORDER BY p.name
      `,
      [currentYear]
    );

    const ratings: PlayerRating[] = [];

    for (const player of licensedPlayersRows) {
      let allResults: TournamentResultWithTournament[] = [];

      // Получаем все результаты игрока из новой таблицы, только если у него есть player_id
      if (player.player_id) {
        const [resultsRows] = await pool.execute<RowDataPacket[]>(
          `
          SELECT
            ptp.id,
            ptp.tournament_id,
            ptp.player_id as team_id,
            COALESCE(tr.points_reason, 'CUP_QUARTER_FINAL') as points_reason,
            ptp.points,
            tr.cup,
            tr.qualifying_wins,
            ptp.created_at,
            ptp.updated_at,
            t.name as tournament_name,
            t.date as tournament_date,
            p.name as team_players
          FROM player_tournament_points ptp
          JOIN tournaments t ON ptp.tournament_id = t.id
          JOIN players p ON ptp.player_id = p.id
          LEFT JOIN team_players tp ON ptp.player_id = tp.player_id
          LEFT JOIN tournament_results tr ON tp.team_id = tr.team_id AND ptp.tournament_id = tr.tournament_id
          WHERE ptp.player_id = ? AND ptp.points > 0
          GROUP BY ptp.id, ptp.tournament_id, ptp.player_id, ptp.points, tr.points_reason, tr.cup, tr.qualifying_wins
          ORDER BY ptp.points DESC, t.date DESC
          `,
          [player.player_id]
        );

        allResults = resultsRows.map(
          (row: any, index) =>
            ({
              ...row,
              is_counted: index < bestResultsCount,
            } as TournamentResultWithTournament)
        );
      }

      // Берем только лучшие результаты для подсчета рейтинга
      const bestResults = allResults.slice(0, bestResultsCount);
      const totalPoints = bestResults.reduce(
        (sum, result) => sum + result.points,
        0
      );

      // Определяем пол для лицензированных игроков без записей в players
      let finalGender = player.gender;
      if (!player.player_id && !finalGender) {
        const genderResult = detectGender(player.licensed_name);
        if (genderResult.gender && genderResult.confidence !== "low") {
          finalGender = genderResult.gender;
        }
      }

      // Если пол все еще не определен, оставляем null
      if (finalGender === undefined) {
        finalGender = null;
      }

      ratings.push({
        player_id: player.player_id || null,
        player_name: player.player_name,
        gender: finalGender,
        total_points: totalPoints,
        best_results: bestResults,
        all_results: allResults,
        licensed_name: player.licensed_name,
      });
    }

    // Сортируем по общему рейтингу
    return ratings.sort((a, b) => b.total_points - a.total_points);
  }

  // Получить мужской рейтинг
  static async getMalePlayerRatings(): Promise<PlayerRating[]> {
    const allRatings = await this.getPlayerRatings();
    return allRatings
      .filter((rating) => rating.gender === "male")
      .sort((a, b) => b.total_points - a.total_points);
  }

  // Получить женский рейтинг
  static async getFemalePlayerRatings(): Promise<PlayerRating[]> {
    const allRatings = await this.getPlayerRatings();
    return allRatings
      .filter((rating) => rating.gender === "female")
      .sort((a, b) => b.total_points - a.total_points);
  }

  // Получить рейтинги разделенные по полу
  static async getPlayerRatingsByGender(
    gender?: string
  ): Promise<PlayerRating[]> {
    const allRatings = await this.getPlayerRatings();

    const male = allRatings
      .filter((rating) => rating.gender === "male")
      .sort((a, b) => b.total_points - a.total_points);

    const female = allRatings
      .filter((rating) => rating.gender === "female")
      .sort((a, b) => b.total_points - a.total_points);

    const unknown = allRatings
      .filter((rating) => !rating.gender || rating.gender === null)
      .sort((a, b) => b.total_points - a.total_points);

    // Если указан конкретный пол, возвращаем только его
    if (gender) {
      switch (gender) {
        case "male":
          return male;
        case "female":
          return female;
        case "unknown":
          return unknown;
        default:
          return [];
      }
    }

    // Если пол не указан, возвращаем все рейтинги мужского пола (для обратной совместимости)
    return male;
  }

  // Получить рейтинг конкретного игрока на основе новой таблицы
  static async getPlayerRating(playerId: number): Promise<PlayerRating | null> {
    const [playerRows] = await pool.execute<RowDataPacket[]>(
      "SELECT * FROM players WHERE id = ?",
      [playerId]
    );

    if (playerRows.length === 0) return null;
    const player = playerRows[0];

    // Проверяем лицензию игрока
    const currentYear = new Date().getFullYear();
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

    // Получаем все результаты игрока
    const [resultsRows] = await pool.execute<RowDataPacket[]>(
      `
      SELECT
        ptp.id,
        ptp.tournament_id,
        ptp.player_id as team_id,
        COALESCE(tr.points_reason, 'CUP_QUARTER_FINAL') as points_reason,
        ptp.points,
        tr.cup,
        tr.qualifying_wins,
        ptp.created_at,
        ptp.updated_at,
        t.name as tournament_name,
        t.date as tournament_date,
        p.name as team_players
      FROM player_tournament_points ptp
      JOIN tournaments t ON ptp.tournament_id = t.id
      JOIN players p ON ptp.player_id = p.id
      LEFT JOIN team_players tp ON ptp.player_id = tp.player_id
      LEFT JOIN tournament_results tr ON tp.team_id = tr.team_id AND ptp.tournament_id = tr.tournament_id
      WHERE ptp.player_id = ? AND ptp.points > 0
      GROUP BY ptp.id, ptp.tournament_id, ptp.player_id, ptp.points, tr.points_reason, tr.cup, tr.qualifying_wins
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

  // Диагностика дубликатов в player_tournament_points
  static async checkDuplicates(playerId?: number): Promise<void> {
    let whereClause = "";
    let params: number[] = [];

    if (playerId) {
      whereClause = "WHERE player_id = ?";
      params = [playerId];
    }

    const [duplicates] = await pool.execute(
      `
      SELECT player_id, tournament_id, COUNT(*) as count
      FROM player_tournament_points
      ${whereClause}
      GROUP BY player_id, tournament_id
      HAVING COUNT(*) > 1
      ORDER BY player_id, tournament_id
    `,
      params
    );

    if ((duplicates as any[]).length > 0) {
      console.log("Найдены дубликаты в player_tournament_points:");
      (duplicates as any[]).forEach((dup: any) => {
        console.log(
          `Игрок ${dup.player_id}, турнир ${dup.tournament_id}: ${dup.count} записей`
        );
      });
    } else {
      console.log("Дубликатов не найдено");
    }
  }

  // Метод больше не используется - очки теперь рассчитываются напрямую
  // при создании tournament_results и сохраняются в player_tournament_points
  static async syncFromTournamentResults(): Promise<void> {
    console.log(
      "⚠️ Метод syncFromTournamentResults устарел - очки теперь рассчитываются автоматически"
    );
    // Ничего не делаем - очки уже должны быть в player_tournament_points
  }
}
