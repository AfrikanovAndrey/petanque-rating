import { pool } from "../config/database";
import { PoolConnection, ResultSetHeader, RowDataPacket } from "mysql2/promise";
import type { SwissMatchFixture } from "../services/swissStageService";

export type TournamentSwissMatchRow = {
  id: number;
  tournament_id: number;
  round_number: number;
  team_a_id: number;
  team_b_id: number | null;
  score_a: number | null;
  score_b: number | null;
  is_bye: boolean;
  court: number | null;
  created_at: Date;
  updated_at: Date;
};

function mapRow(row: RowDataPacket): TournamentSwissMatchRow {
  return {
    id: row.id as number,
    tournament_id: row.tournament_id as number,
    round_number: row.round_number as number,
    team_a_id: row.team_a_id as number,
    team_b_id: row.team_b_id == null ? null : Number(row.team_b_id),
    score_a: row.score_a == null ? null : Number(row.score_a),
    score_b: row.score_b == null ? null : Number(row.score_b),
    is_bye: Boolean(row.is_bye),
    court: row.court == null ? null : Number(row.court),
    created_at: row.created_at as Date,
    updated_at: row.updated_at as Date,
  };
}

export class TournamentSwissMatchModel {
  static async deleteByTournament(
    tournamentId: number,
    connection?: PoolConnection,
  ): Promise<void> {
    const exec = connection ?? pool;
    await exec.execute(
      `DELETE FROM tournament_swiss_matches WHERE tournament_id = ?`,
      [tournamentId],
    );
  }

  static async deleteRoundsFrom(
    tournamentId: number,
    fromRound: number,
    connection?: PoolConnection,
  ): Promise<void> {
    const exec = connection ?? pool;
    await exec.execute(
      `DELETE FROM tournament_swiss_matches
       WHERE tournament_id = ? AND round_number >= ?`,
      [tournamentId, fromRound],
    );
  }

  static async countByTournament(tournamentId: number): Promise<number> {
    const [rows] = await pool.execute<RowDataPacket[]>(
      `SELECT COUNT(*) AS cnt FROM tournament_swiss_matches WHERE tournament_id = ?`,
      [tournamentId],
    );
    return Number(rows[0]?.cnt ?? 0);
  }

  static async insertFixtures(
    tournamentId: number,
    fixtures: SwissMatchFixture[],
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
          f.round_number,
          f.team_a_id,
          f.team_b_id,
          f.is_bye ? 1 : 0,
          f.court,
          f.is_bye ? (f.score_a ?? 13) : null,
          f.is_bye ? (f.score_b ?? 7) : null,
        );
        return "(?, ?, ?, ?, ?, ?, ?, ?)";
      })
      .join(", ");

    await exec.execute(
      `INSERT INTO tournament_swiss_matches
        (tournament_id, round_number, team_a_id, team_b_id, is_bye, court, score_a, score_b)
       VALUES ${placeholders}`,
      values,
    );
  }

  static async listByTournament(
    tournamentId: number,
  ): Promise<TournamentSwissMatchRow[]> {
    const [rows] = await pool.execute<RowDataPacket[]>(
      `SELECT id, tournament_id, round_number,
              team_a_id, team_b_id, score_a, score_b, is_bye, court,
              created_at, updated_at
       FROM tournament_swiss_matches
       WHERE tournament_id = ?
       ORDER BY round_number ASC, id ASC`,
      [tournamentId],
    );
    return rows.map(mapRow);
  }

  static async getById(
    matchId: number,
  ): Promise<TournamentSwissMatchRow | null> {
    const [rows] = await pool.execute<RowDataPacket[]>(
      `SELECT id, tournament_id, round_number,
              team_a_id, team_b_id, score_a, score_b, is_bye, court,
              created_at, updated_at
       FROM tournament_swiss_matches
       WHERE id = ?
       LIMIT 1`,
      [matchId],
    );
    if (rows.length === 0) {
      return null;
    }
    return mapRow(rows[0]);
  }

  static async updateScores(
    matchId: number,
    scoreA: number | null,
    scoreB: number | null,
    court?: number | null,
  ): Promise<boolean> {
    if (court === undefined) {
      const [result] = await pool.execute<ResultSetHeader>(
        `UPDATE tournament_swiss_matches
         SET score_a = ?, score_b = ?
         WHERE id = ? AND is_bye = 0`,
        [scoreA, scoreB, matchId],
      );
      return result.affectedRows > 0;
    }
    const [result] = await pool.execute<ResultSetHeader>(
      `UPDATE tournament_swiss_matches
       SET score_a = ?, score_b = ?, court = ?
       WHERE id = ? AND is_bye = 0`,
      [scoreA, scoreB, court, matchId],
    );
    return result.affectedRows > 0;
  }

  static async updateCourtOnly(
    matchId: number,
    court: number | null,
  ): Promise<boolean> {
    const [result] = await pool.execute<ResultSetHeader>(
      `UPDATE tournament_swiss_matches SET court = ? WHERE id = ? AND is_bye = 0`,
      [court, matchId],
    );
    return result.affectedRows > 0;
  }
}
