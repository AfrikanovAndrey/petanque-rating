import { pool } from "../config/database";
import { Tournament, TournamentResult, TournamentUploadData } from "../types";
import { ResultSetHeader, RowDataPacket } from "mysql2";
import { PlayerModel } from "./PlayerModel";
import { SettingsModel } from "./SettingsModel";

export class TournamentModel {
  static async getAllTournaments(): Promise<Tournament[]> {
    const [rows] = await pool.execute<Tournament[] & RowDataPacket[]>(
      "SELECT * FROM tournaments ORDER BY date DESC"
    );
    return rows;
  }

  static async getTournamentById(id: number): Promise<Tournament | null> {
    const [rows] = await pool.execute<Tournament[] & RowDataPacket[]>(
      "SELECT * FROM tournaments WHERE id = ?",
      [id]
    );
    return rows[0] || null;
  }

  static async createTournament(name: string, date: string): Promise<number> {
    const [result] = await pool.execute<ResultSetHeader>(
      "INSERT INTO tournaments (name, date) VALUES (?, ?)",
      [name, date]
    );
    return result.insertId;
  }

  static async updateTournament(
    id: number,
    name: string,
    date: string
  ): Promise<boolean> {
    const [result] = await pool.execute<ResultSetHeader>(
      "UPDATE tournaments SET name = ?, date = ? WHERE id = ?",
      [name, date, id]
    );
    return result.affectedRows > 0;
  }

  static async deleteTournament(id: number): Promise<boolean> {
    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();

      // Удаляем все результаты турнира
      await connection.execute(
        "DELETE FROM tournament_results WHERE tournament_id = ?",
        [id]
      );

      // Удаляем сам турнир
      const [result] = await connection.execute<ResultSetHeader>(
        "DELETE FROM tournaments WHERE id = ?",
        [id]
      );

      await connection.commit();
      return result.affectedRows > 0;
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }

  static async getTournamentResults(
    tournamentId: number
  ): Promise<TournamentResult[]> {
    const [rows] = await pool.execute<TournamentResult[] & RowDataPacket[]>(
      `
      SELECT 
        tr.*,
        p.name as player_name,
        t.name as tournament_name,
        t.date as tournament_date
      FROM tournament_results tr
      JOIN players p ON tr.player_id = p.id
      JOIN tournaments t ON tr.tournament_id = t.id
      WHERE tr.tournament_id = ?
      ORDER BY tr.position ASC
    `,
      [tournamentId]
    );
    return rows;
  }

  static async addTournamentResult(
    tournamentId: number,
    playerId: number,
    position: number,
    points: number
  ): Promise<number> {
    const [result] = await pool.execute<ResultSetHeader>(
      "INSERT INTO tournament_results (tournament_id, player_id, position, points) VALUES (?, ?, ?, ?)",
      [tournamentId, playerId, position, points]
    );
    return result.insertId;
  }

  static async updateTournamentResult(
    id: number,
    position: number,
    points: number
  ): Promise<boolean> {
    const [result] = await pool.execute<ResultSetHeader>(
      "UPDATE tournament_results SET position = ?, points = ? WHERE id = ?",
      [position, points, id]
    );
    return result.affectedRows > 0;
  }

  static async deleteTournamentResult(id: number): Promise<boolean> {
    const [result] = await pool.execute<ResultSetHeader>(
      "DELETE FROM tournament_results WHERE id = ?",
      [id]
    );
    return result.affectedRows > 0;
  }

  static async uploadTournamentData(
    data: TournamentUploadData
  ): Promise<number> {
    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();

      // 1. Создаем турнир
      const [tournamentResult] = await connection.execute<ResultSetHeader>(
        "INSERT INTO tournaments (name, date) VALUES (?, ?)",
        [data.tournament_name, data.tournament_date]
      );
      const tournamentId = tournamentResult.insertId;

      // 2. Обрабатываем результаты
      for (const result of data.results) {
        let playerId: number;

        // Проверяем, существует ли игрок
        let player = await PlayerModel.getPlayerByName(result.player_name);
        if (!player) {
          // Создаем нового игрока
          playerId = await PlayerModel.createPlayer(result.player_name);
        } else {
          playerId = player.id;
        }

        // Получаем очки за позицию
        const points = await SettingsModel.getPointsForPosition(
          result.position
        );

        // Добавляем результат
        await connection.execute(
          "INSERT INTO tournament_results (tournament_id, player_id, position, points) VALUES (?, ?, ?, ?)",
          [tournamentId, playerId, result.position, points]
        );
      }

      await connection.commit();
      return tournamentId;
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }

  static async getTournamentWithResults(id: number): Promise<{
    tournament: Tournament;
    results: TournamentResult[];
  } | null> {
    const tournament = await this.getTournamentById(id);
    if (!tournament) return null;

    const results = await this.getTournamentResults(id);
    return { tournament, results };
  }
}
