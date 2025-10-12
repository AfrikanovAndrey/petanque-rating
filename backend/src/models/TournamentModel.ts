import { ResultSetHeader, RowDataPacket, PoolConnection } from "mysql2/promise";
import { getCupPoints, getPointsByQualifyingStage } from "../config/cupPoints";
import { pool } from "../config/database";

import {
  Cup,
  CupPosition,
  Tournament,
  TournamentCategoryEnum,
  TournamentResult,
  TournamentType,
} from "../types";

export class TournamentModel {
  static async getAllTournaments(): Promise<Tournament[]> {
    const [rows] = await pool.execute<Tournament[] & RowDataPacket[]>(
      `SELECT 
        t.*,
        COALESCE(COUNT(DISTINCT tr.team_id), 0) as teams_count
      FROM tournaments t
      LEFT JOIN tournament_results tr ON t.id = tr.tournament_id
      GROUP BY t.id
      ORDER BY t.date DESC`
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

  static async getTournamentTeamsCount(tournamentId: number): Promise<number> {
    const [rows] = await pool.execute<RowDataPacket[]>(
      "SELECT COUNT(DISTINCT team_id) as teams_count FROM tournament_results WHERE tournament_id = ?",
      [tournamentId]
    );
    return (rows[0]?.teams_count as number) || 0;
  }

  static async createTournament(
    name: string,
    type: TournamentType,
    category: TournamentCategoryEnum,
    date: string,
    connection?: PoolConnection
  ): Promise<number> {
    const executor = connection || pool;
    const [result] = await executor.execute<ResultSetHeader>(
      "INSERT INTO tournaments (name, type, category, date) VALUES (?, ?, ?, ?)",
      [name, type, TournamentCategoryEnum[category], date]
    );
    return result.insertId;
  }

  static async updateTournament(
    id: number,
    name?: string,
    type?: TournamentType,
    category?: TournamentCategoryEnum,
    date?: string
  ): Promise<boolean> {
    const updates: string[] = [];
    const values: any[] = [];

    if (name !== undefined) {
      updates.push("name = ?");
      values.push(name);
    }
    if (type !== undefined) {
      updates.push("type = ?");
      values.push(type);
    }
    if (category !== undefined) {
      updates.push("category = ?");
      values.push(TournamentCategoryEnum[category]);
    }
    if (date !== undefined) {
      updates.push("date = ?");
      values.push(date);
    }

    if (updates.length === 0) {
      return false; // Нет данных для обновления
    }

    values.push(id);
    const [result] = await pool.execute<ResultSetHeader>(
      `UPDATE tournaments SET ${updates.join(", ")} WHERE id = ?`,
      values
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
        GROUP_CONCAT(p.name ORDER BY p.name SEPARATOR ', ') as team_name,
        t.name as tournament_name,
        t.date as tournament_date,
        GROUP_CONCAT(p.name ORDER BY p.name SEPARATOR ', ') as team_players
      FROM tournament_results tr
      JOIN teams tm ON tr.team_id = tm.id
      JOIN tournaments t ON tr.tournament_id = t.id
      JOIN team_players tp ON tm.id = tp.team_id
      JOIN players p ON tp.player_id = p.id
      WHERE tr.tournament_id = ?
      GROUP BY tr.id, t.name, t.date
      ORDER BY tr.cup_position ASC
    `,
      [tournamentId]
    );
    return rows;
  }

  static ensureValue<T>(value: T | undefined | null, defaultValue: T) {
    return value === undefined || value === null ? defaultValue : value;
  }

  static async addTournamentResult(
    tournamentId: number,
    teamId: number,
    wins: number,
    loses: number,
    cupPosition?: CupPosition,
    cup?: Cup,
    qualifying_wins?: number,
    points?: number,
    connection?: PoolConnection
  ): Promise<number> {
    const executor = connection || pool;
    const [result] = await executor.execute<ResultSetHeader>(
      "INSERT INTO tournament_results (tournament_id, team_id, cup, cup_position, qualifying_wins, wins, loses, points) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
      [
        TournamentModel.ensureValue(tournamentId, 0),
        TournamentModel.ensureValue(teamId, 0),
        TournamentModel.ensureValue(cup, null),
        TournamentModel.ensureValue(cupPosition, null),
        TournamentModel.ensureValue(qualifying_wins, 0),
        TournamentModel.ensureValue(wins, 0),
        TournamentModel.ensureValue(loses, 0),
        TournamentModel.ensureValue(points, 0),
      ]
    );
    return result.insertId;
  }

  static async deleteTournamentResult(id: number): Promise<boolean> {
    const [result] = await pool.execute<ResultSetHeader>(
      "DELETE FROM tournament_results WHERE id = ?",
      [id]
    );
    return result.affectedRows > 0;
  }

  // Функция для пересчета очков существующего турнира
  static async recalculatePoints(): Promise<void> {
    console.log(`🔄 Начинаю пересчет очков для всех турниров`);

    // Получаем все турниры
    const [tournamentRows] = await pool.execute<RowDataPacket[]>(
      "SELECT * FROM tournaments ORDER BY id"
    );

    console.log(`📊 Найдено ${tournamentRows.length} турниров для пересчета`);

    for (const tournamentRow of tournamentRows) {
      const tournament = tournamentRow as Tournament;
      const tournamentId = tournament.id;

      console.log(
        `\n📝 Обрабатываю турнир ID ${tournamentId}: "${tournament.name}"`
      );

      // Получаем все результаты команд из tournament_results
      const [resultsRows] = await pool.execute<RowDataPacket[]>(
        `
        SELECT 
          tr.id, 
          tr.cup_position, 
          tr.cup, 
          tr.team_id, 
          tr.qualifying_wins,
          tr.points as old_points,
          GROUP_CONCAT(p.name ORDER BY p.name SEPARATOR ', ') as team_players
        FROM tournament_results tr
        JOIN teams tm ON tr.team_id = tm.id
        JOIN team_players tp ON tm.id = tp.team_id
        JOIN players p ON tp.player_id = p.id
        WHERE tr.tournament_id = ?
        GROUP BY tr.id
        `,
        [tournamentId]
      );

      console.log(
        `   📌 Найдено ${resultsRows.length} результатов команд для турнира ID ${tournamentId}`
      );

      for (const result of resultsRows) {
        console.log(
          `   🔍 Обрабатываем команду ID ${result.team_id}: "${result.team_players}"`
        );

        // Получаем количество команд из результатов турнира
        const totalTeams = await TournamentModel.getTournamentTeamsCount(
          tournamentId
        );
        const categoryEnum =
          tournament.category === "FEDERAL"
            ? TournamentCategoryEnum.FEDERAL
            : TournamentCategoryEnum.REGIONAL;

        let newPoints = 0;

        if (result.cup) {
          // Команда в кубке - рассчитываем очки за место в кубке
          let cupPosition: CupPosition;
          switch (result.cup_position) {
            case "CUP_WINNER":
              cupPosition = CupPosition.WINNER;
              break;
            case "CUP_RUNNER_UP":
              cupPosition = CupPosition.RUNNER_UP;
              break;
            case "CUP_THIRD_PLACE":
              cupPosition = CupPosition.THIRD_PLACE;
              break;
            case "CUP_SEMI_FINAL":
              cupPosition = CupPosition.SEMI_FINAL;
              break;
            case "CUP_QUARTER_FINAL":
              cupPosition = CupPosition.QUARTER_FINAL;
              break;
            default:
              cupPosition = CupPosition.QUARTER_FINAL;
          }

          console.log(`      🎯 Команда в кубке ${result.cup}:`, {
            position: cupPosition,
            category: categoryEnum,
            totalTeams,
          });

          newPoints = getCupPoints(
            categoryEnum,
            result.cup,
            cupPosition,
            totalTeams
          );
        } else {
          // Команда НЕ в кубке - рассчитываем очки за победы в квалификации
          console.log(`      🎯 Команда в квалификации:`, {
            qualifying_wins: result.qualifying_wins || 0,
            category: categoryEnum,
          });

          newPoints = getPointsByQualifyingStage(
            categoryEnum,
            result.qualifying_wins || 0
          );
        }

        console.log(
          `      📈 Старые очки: ${result.old_points}, новые очки: ${newPoints}`
        );

        // Обновляем очки в базе tournament_results
        await pool.execute(
          "UPDATE tournament_results SET points = ? WHERE id = ?",
          [newPoints, result.id]
        );
      }

      console.log(
        `   ✅ Пересчет очков для турнира "${tournament.name}" завершен`
      );
    }

    console.log(`\n🎉 Пересчет очков для всех турниров успешно завершен!`);
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

  // Методы для работы с кубками

  static async getCupResults(): Promise<TournamentResult[]> {
    const [rows] = await pool.execute<TournamentResult[] & RowDataPacket[]>(
      `
      SELECT 
        tr.*,
        GROUP_CONCAT(p.name ORDER BY p.name SEPARATOR ', ') as team_name,
        t.name as tournament_name,
        t.date as tournament_date,
        GROUP_CONCAT(p.name ORDER BY p.name SEPARATOR ', ') as team_players
      FROM tournament_results tr
      JOIN teams tm ON tr.team_id = tm.id
      JOIN tournaments t ON tr.tournament_id = t.id
      JOIN team_players tp ON tm.id = tp.team_id
      JOIN players p ON tp.player_id = p.id
      WHERE tr.cup IS NOT NULL
      GROUP BY tr.id, t.name, t.date
      ORDER BY t.date DESC, tr.cup, tr.cup_position
      `
    );
    return rows;
  }

  static async getCupResultsByTournament(
    tournamentId: number
  ): Promise<TournamentResult[]> {
    const [rows] = await pool.execute<TournamentResult[] & RowDataPacket[]>(
      `
      SELECT 
        tr.*,
        GROUP_CONCAT(p.name ORDER BY p.name SEPARATOR ', ') as team_name,
        t.name as tournament_name,
        t.date as tournament_date,
        GROUP_CONCAT(p.name ORDER BY p.name SEPARATOR ', ') as team_players
      FROM tournament_results tr
      JOIN teams tm ON tr.team_id = tm.id
      JOIN tournaments t ON tr.tournament_id = t.id
      JOIN team_players tp ON tm.id = tp.team_id
      JOIN players p ON tp.player_id = p.id
      WHERE tr.tournament_id = ? AND tr.cup IS NOT NULL
      GROUP BY tr.id, t.name, t.date
      ORDER BY tr.cup, tr.cup_position
      `,
      [tournamentId]
    );
    return rows;
  }

  static async getCupResultsByCup(
    tournamentId: number,
    cup: string
  ): Promise<TournamentResult[]> {
    const [rows] = await pool.execute<TournamentResult[] & RowDataPacket[]>(
      `
      SELECT 
        tr.*,
        GROUP_CONCAT(p.name ORDER BY p.name SEPARATOR ', ') as team_name,
        GROUP_CONCAT(p.name ORDER BY p.name SEPARATOR ', ') as team_players
      FROM tournament_results tr
      JOIN teams tm ON tr.team_id = tm.id
      JOIN team_players tp ON tm.id = tp.team_id
      JOIN players p ON tp.player_id = p.id
      WHERE tr.tournament_id = ? AND tr.cup = ?
      GROUP BY tr.id
      ORDER BY tr.cup_position
      `,
      [tournamentId, cup]
    );
    return rows;
  }
}
