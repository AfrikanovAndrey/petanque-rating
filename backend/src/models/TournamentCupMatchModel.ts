import { pool } from "../config/database";
import { PoolConnection, ResultSetHeader, RowDataPacket } from "mysql2/promise";
import type { CupBracketCode, CupMatchFixture } from "../services/cupStageService";

export type TournamentCupMatchRow = {
  id: number;
  tournament_id: number;
  cup: CupBracketCode;
  round_number: number;
  match_index: number;
  team_a_id: number | null;
  team_b_id: number | null;
  score_a: number | null;
  score_b: number | null;
  court: number | null;
  is_third_place: boolean;
  next_match_round: number | null;
  next_match_index: number | null;
  next_slot: "a" | "b" | null;
  loser_next_match_round: number | null;
  loser_next_match_index: number | null;
  loser_next_slot: "a" | "b" | null;
  created_at: Date;
  updated_at: Date;
};

function mapRow(row: RowDataPacket): TournamentCupMatchRow {
  return {
    id: row.id as number,
    tournament_id: row.tournament_id as number,
    cup: row.cup as CupBracketCode,
    round_number: Number(row.round_number),
    match_index: Number(row.match_index),
    team_a_id: row.team_a_id == null ? null : Number(row.team_a_id),
    team_b_id: row.team_b_id == null ? null : Number(row.team_b_id),
    score_a: row.score_a == null ? null : Number(row.score_a),
    score_b: row.score_b == null ? null : Number(row.score_b),
    court: row.court == null ? null : Number(row.court),
    is_third_place: Boolean(row.is_third_place),
    next_match_round:
      row.next_match_round == null ? null : Number(row.next_match_round),
    next_match_index:
      row.next_match_index == null ? null : Number(row.next_match_index),
    next_slot: (row.next_slot as "a" | "b" | null) ?? null,
    loser_next_match_round:
      row.loser_next_match_round == null
        ? null
        : Number(row.loser_next_match_round),
    loser_next_match_index:
      row.loser_next_match_index == null
        ? null
        : Number(row.loser_next_match_index),
    loser_next_slot: (row.loser_next_slot as "a" | "b" | null) ?? null,
    created_at: row.created_at as Date,
    updated_at: row.updated_at as Date,
  };
}

export class TournamentCupMatchModel {
  static async deleteByTournament(
    tournamentId: number,
    connection?: PoolConnection,
  ): Promise<void> {
    const exec = connection ?? pool;
    await exec.execute(
      `DELETE FROM tournament_cup_matches WHERE tournament_id = ?`,
      [tournamentId],
    );
  }

  static async deleteByTournamentAndCups(
    tournamentId: number,
    cups: CupBracketCode[],
    connection?: PoolConnection,
  ): Promise<void> {
    if (cups.length === 0) {
      return;
    }
    const exec = connection ?? pool;
    const placeholders = cups.map(() => "?").join(", ");
    await exec.execute(
      `DELETE FROM tournament_cup_matches
       WHERE tournament_id = ? AND cup IN (${placeholders})`,
      [tournamentId, ...cups],
    );
  }

  static async countByTournament(tournamentId: number): Promise<number> {
    const [rows] = await pool.execute<RowDataPacket[]>(
      `SELECT COUNT(*) AS cnt FROM tournament_cup_matches WHERE tournament_id = ?`,
      [tournamentId],
    );
    return Number(rows[0]?.cnt ?? 0);
  }

  static async insertFixtures(
    tournamentId: number,
    fixtures: CupMatchFixture[],
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
          f.cup,
          f.round_number,
          f.match_index,
          f.team_a_id,
          f.team_b_id,
          f.court,
          f.is_third_place ? 1 : 0,
          f.next_match_round,
          f.next_match_index,
          f.next_slot,
          f.loser_next_match_round,
          f.loser_next_match_index,
          f.loser_next_slot,
        );
        return "(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)";
      })
      .join(", ");

    await exec.execute(
      `INSERT INTO tournament_cup_matches
        (tournament_id, cup, round_number, match_index,
         team_a_id, team_b_id, court, is_third_place,
         next_match_round, next_match_index, next_slot,
         loser_next_match_round, loser_next_match_index, loser_next_slot)
       VALUES ${placeholders}`,
      values,
    );
  }

  static async listByTournament(
    tournamentId: number,
  ): Promise<TournamentCupMatchRow[]> {
    const [rows] = await pool.execute<RowDataPacket[]>(
      `SELECT *
       FROM tournament_cup_matches
       WHERE tournament_id = ?
       ORDER BY FIELD(cup, 'AB', 'A', 'B', 'C', 'D'),
                is_third_place ASC,
                round_number ASC,
                match_index ASC`,
      [tournamentId],
    );
    return rows.map(mapRow);
  }

  static async getById(
    matchId: number,
  ): Promise<TournamentCupMatchRow | null> {
    const [rows] = await pool.execute<RowDataPacket[]>(
      `SELECT * FROM tournament_cup_matches WHERE id = ? LIMIT 1`,
      [matchId],
    );
    if (rows.length === 0) {
      return null;
    }
    return mapRow(rows[0]);
  }

  static async findSlot(
    tournamentId: number,
    cup: CupBracketCode,
    roundNumber: number,
    matchIndex: number,
    isThirdPlace: boolean,
  ): Promise<TournamentCupMatchRow | null> {
    const [rows] = await pool.execute<RowDataPacket[]>(
      `SELECT * FROM tournament_cup_matches
       WHERE tournament_id = ? AND cup = ?
         AND round_number = ? AND match_index = ?
         AND is_third_place = ?
       LIMIT 1`,
      [tournamentId, cup, roundNumber, matchIndex, isThirdPlace ? 1 : 0],
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
        `UPDATE tournament_cup_matches
         SET score_a = ?, score_b = ?
         WHERE id = ?`,
        [scoreA, scoreB, matchId],
      );
      return result.affectedRows > 0;
    }
    const [result] = await pool.execute<ResultSetHeader>(
      `UPDATE tournament_cup_matches
       SET score_a = ?, score_b = ?, court = ?
       WHERE id = ?`,
      [scoreA, scoreB, court, matchId],
    );
    return result.affectedRows > 0;
  }

  static async setTeamSlot(
    matchId: number,
    slot: "a" | "b",
    teamId: number | null,
  ): Promise<boolean> {
    const col = slot === "a" ? "team_a_id" : "team_b_id";
    const [result] = await pool.execute<ResultSetHeader>(
      `UPDATE tournament_cup_matches SET ${col} = ? WHERE id = ?`,
      [teamId, matchId],
    );
    return result.affectedRows > 0;
  }
}
