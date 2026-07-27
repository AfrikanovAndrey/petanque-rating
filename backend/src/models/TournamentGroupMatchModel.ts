import { pool } from "../config/database";
import { PoolConnection, ResultSetHeader, RowDataPacket } from "mysql2/promise";
import {
  generateAllGroupFixtures,
  type GroupMatchFixture,
} from "../services/groupStageService";
import { TournamentGroupDrawGroup } from "../types";

export type TournamentGroupMatchRow = {
  id: number;
  tournament_id: number;
  group_number: number;
  round_number: number;
  team_a_id: number;
  team_b_id: number;
  score_a: number | null;
  score_b: number | null;
  court: number | null;
  created_at: Date;
  updated_at: Date;
};

export class TournamentGroupMatchModel {
  static async deleteByTournament(
    tournamentId: number,
    connection?: PoolConnection,
  ): Promise<void> {
    const exec = connection ?? pool;
    await exec.execute(
      `DELETE FROM tournament_group_matches WHERE tournament_id = ?`,
      [tournamentId],
    );
  }

  static async countByTournament(tournamentId: number): Promise<number> {
    const [rows] = await pool.execute<RowDataPacket[]>(
      `SELECT COUNT(*) AS cnt FROM tournament_group_matches WHERE tournament_id = ?`,
      [tournamentId],
    );
    return Number(rows[0]?.cnt ?? 0);
  }

  static async insertFixtures(
    tournamentId: number,
    fixtures: GroupMatchFixture[],
    connection?: PoolConnection,
  ): Promise<void> {
    if (fixtures.length === 0) {
      return;
    }
    const exec = connection ?? pool;
    const values: unknown[] = [];
    const placeholders = fixtures
      .map((f) => {
        values.push(
          tournamentId,
          f.group_number,
          f.round_number,
          f.team_a_id,
          f.team_b_id,
          f.court,
        );
        return "(?, ?, ?, ?, ?, ?)";
      })
      .join(", ");

    await exec.execute(
      `INSERT INTO tournament_group_matches
        (tournament_id, group_number, round_number, team_a_id, team_b_id, court)
       VALUES ${placeholders}`,
      values,
    );
  }

  /** Создать фикстуры из жеребьёвки (предварительно удаляет старые). */
  static async regenerateFromDraw(
    tournamentId: number,
    groupDraw: TournamentGroupDrawGroup[],
    connection?: PoolConnection,
  ): Promise<number> {
    await this.deleteByTournament(tournamentId, connection);
    const fixtures = generateAllGroupFixtures(groupDraw);
    await this.insertFixtures(tournamentId, fixtures, connection);
    return fixtures.length;
  }

  static async listByTournament(
    tournamentId: number,
  ): Promise<TournamentGroupMatchRow[]> {
    const [rows] = await pool.execute<RowDataPacket[]>(
      `SELECT id, tournament_id, group_number, round_number,
              team_a_id, team_b_id, score_a, score_b, court,
              created_at, updated_at
       FROM tournament_group_matches
       WHERE tournament_id = ?
       ORDER BY group_number ASC, round_number ASC, id ASC`,
      [tournamentId],
    );
    return rows.map((row) => ({
      id: row.id as number,
      tournament_id: row.tournament_id as number,
      group_number: row.group_number as number,
      round_number: row.round_number as number,
      team_a_id: row.team_a_id as number,
      team_b_id: row.team_b_id as number,
      score_a: row.score_a == null ? null : Number(row.score_a),
      score_b: row.score_b == null ? null : Number(row.score_b),
      court: row.court == null ? null : Number(row.court),
      created_at: row.created_at as Date,
      updated_at: row.updated_at as Date,
    }));
  }

  static async getById(
    matchId: number,
  ): Promise<TournamentGroupMatchRow | null> {
    const [rows] = await pool.execute<RowDataPacket[]>(
      `SELECT id, tournament_id, group_number, round_number,
              team_a_id, team_b_id, score_a, score_b, court,
              created_at, updated_at
       FROM tournament_group_matches
       WHERE id = ?
       LIMIT 1`,
      [matchId],
    );
    if (rows.length === 0) {
      return null;
    }
    const row = rows[0];
    return {
      id: row.id as number,
      tournament_id: row.tournament_id as number,
      group_number: row.group_number as number,
      round_number: row.round_number as number,
      team_a_id: row.team_a_id as number,
      team_b_id: row.team_b_id as number,
      score_a: row.score_a == null ? null : Number(row.score_a),
      score_b: row.score_b == null ? null : Number(row.score_b),
      court: row.court == null ? null : Number(row.court),
      created_at: row.created_at as Date,
      updated_at: row.updated_at as Date,
    };
  }

  static async updateScores(
    matchId: number,
    scoreA: number | null,
    scoreB: number | null,
    court?: number | null,
  ): Promise<boolean> {
    if (court === undefined) {
      const [result] = await pool.execute<ResultSetHeader>(
        `UPDATE tournament_group_matches
         SET score_a = ?, score_b = ?
         WHERE id = ?`,
        [scoreA, scoreB, matchId],
      );
      return result.affectedRows > 0;
    }
    const [result] = await pool.execute<ResultSetHeader>(
      `UPDATE tournament_group_matches
       SET score_a = ?, score_b = ?, court = ?
       WHERE id = ?`,
      [scoreA, scoreB, court, matchId],
    );
    return result.affectedRows > 0;
  }
}
