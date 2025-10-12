import { pool } from "../config/database";
import { ResultSetHeader, RowDataPacket, PoolConnection } from "mysql2/promise";

export interface Team {
  id: number;
  created_at: string;
  updated_at: string;
}

export interface TeamWithMembers extends Team {
  // Получение всех участников команды как массив ID игроков
  getPlayerIds(): number[];
  // Получение всех участников команды с именами
  getPlayersWithNames(): Promise<
    Array<{
      player_id: number;
      player_name: string;
      sort_order: number;
    }>
  >;
}

export class TeamModel {
  /**
   * Получить все команды
   */
  static async getAllTeams(): Promise<Team[]> {
    const [rows] = await pool.execute<Team[] & RowDataPacket[]>(
      "SELECT * FROM teams ORDER BY id"
    );
    return rows;
  }

  /**
   * Получить команду по ID
   */
  static async getTeamById(id: number): Promise<Team | null> {
    const [rows] = await pool.execute<Team[] & RowDataPacket[]>(
      "SELECT * FROM teams WHERE id = ?",
      [id]
    );
    return rows[0] || null;
  }

  /**
   * Получить команды для турнира
   */
  static async getTeamsByTournament(tournamentId: number): Promise<Team[]> {
    const [teamRows] = await pool.execute<Team[] & RowDataPacket[]>(
      `SELECT DISTINCT t.* FROM teams t
       JOIN tournament_results tr ON t.id = tr.team_id
       WHERE tr.tournament_id = ?
       ORDER BY t.id`,
      [tournamentId]
    );

    return teamRows;
  }

  /**
   * Получить участников команды отсортированных по именам
   */
  static async getTeamMembers(team: Team): Promise<
    Array<{
      player_id: number;
      player_name: string;
      sort_order: number;
    }>
  > {
    const [rows] = await pool.execute<RowDataPacket[]>(
      `SELECT 
        tp.player_id,
        p.name as player_name,
        tp.position
      FROM team_players tp
      JOIN players p ON tp.player_id = p.id
      WHERE tp.team_id = ?
      ORDER BY p.name ASC`,
      [team.id]
    );

    return rows.map((row: any, index) => ({
      player_id: row.player_id,
      player_name: row.player_name,
      sort_order: index + 1,
    }));
  }

  /**
   * Создать команду из отсортированных по фамилиям игроков
   */
  static async createTeam(
    playerIds: number[],
    connection?: PoolConnection
  ): Promise<number> {
    if (playerIds.length < 1 || playerIds.length > 4) {
      throw new Error("В команде должно быть от 1 до 4 игроков");
    }

    const useExternalConnection = !!connection;
    const conn = connection || (await pool.getConnection());

    try {
      if (!useExternalConnection) {
        await conn.beginTransaction();
      }

      // Создаем команду
      const [teamResult] = await conn.execute<ResultSetHeader>(
        `INSERT INTO teams (created_at, updated_at) VALUES (NOW(), NOW())`
      );

      const teamId = teamResult.insertId;

      // Получаем имена игроков и сортируем их по фамилиям
      const [playerRows] = await conn.execute<RowDataPacket[]>(
        `SELECT id, name FROM players WHERE id IN (${playerIds
          .map(() => "?")
          .join(",")}) ORDER BY name ASC`,
        playerIds
      );

      // Добавляем игроков в team_players
      for (let i = 0; i < playerRows.length; i++) {
        const player = playerRows[i] as any;
        await conn.execute(
          `INSERT INTO team_players (team_id, player_id, position) VALUES (?, ?, ?)`,
          [teamId, player.id, i + 1]
        );
      }

      if (!useExternalConnection) {
        await conn.commit();
      }
      return teamId;
    } catch (error) {
      if (!useExternalConnection) {
        await conn.rollback();
      }
      throw error;
    } finally {
      if (!useExternalConnection) {
        conn.release();
      }
    }
  }

  /**
   * Найти существующую команду по составу игроков
   */
  static async findExistingTeam(
    playerIds: number[],
    connection?: PoolConnection
  ): Promise<Team | null> {
    if (playerIds.length < 1 || playerIds.length > 4) {
      return null;
    }

    const executor = connection || pool;

    // Получаем имена игроков и сортируем их по фамилиям
    const [playerRows] = await executor.execute<RowDataPacket[]>(
      `SELECT id, name FROM players WHERE id IN (${playerIds
        .map(() => "?")
        .join(",")}) ORDER BY name ASC`,
      playerIds
    );

    const sortedPlayerIds = playerRows.map((player: any) => player.id);

    // Ищем команду с точно таким же составом игроков
    const [rows] = await executor.execute<Team[] & RowDataPacket[]>(
      `SELECT t.* FROM teams t
       WHERE t.id IN (
         SELECT team_id FROM team_players
         WHERE player_id IN (${sortedPlayerIds.map(() => "?").join(",")})
         GROUP BY team_id
         HAVING COUNT(DISTINCT player_id) = ? 
         AND COUNT(player_id) = ?
       )
       AND t.id NOT IN (
         SELECT team_id FROM team_players
         WHERE player_id NOT IN (${sortedPlayerIds.map(() => "?").join(",")})
       )
       LIMIT 1`,
      [
        ...sortedPlayerIds, // для IN clause
        sortedPlayerIds.length, // для HAVING COUNT(DISTINCT player_id) = ?
        sortedPlayerIds.length, // для HAVING COUNT(player_id) = ?
        ...sortedPlayerIds, // для NOT IN clause
      ]
    );

    return rows[0] || null;
  }

  /**
   * Получить все ID игроков команды
   */
  static async getPlayerIds(team: Team): Promise<number[]> {
    const [rows] = await pool.execute<RowDataPacket[]>(
      `SELECT player_id FROM team_players WHERE team_id = ? ORDER BY position`,
      [team.id]
    );
    return rows.map((row: any) => row.player_id);
  }

  /**
   * Удалить команду
   */
  static async deleteTeam(id: number): Promise<boolean> {
    const [result] = await pool.execute<ResultSetHeader>(
      "DELETE FROM teams WHERE id = ?",
      [id]
    );
    return result.affectedRows > 0;
  }

  /**
   * Удалить все команды
   */
  static async deleteAllTeams(): Promise<number> {
    const [result] = await pool.execute<ResultSetHeader>("DELETE FROM teams");
    return result.affectedRows;
  }
}
