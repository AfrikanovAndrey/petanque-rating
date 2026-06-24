import { PoolConnection, ResultSetHeader, RowDataPacket } from "mysql2/promise";
import { pool } from "../config/database";
import {
  SWISS_BYE_SCORE_A,
  SWISS_BYE_SCORE_B,
  normalizeSwissByeScores,
} from "../services/swissConstants";
import {
  generateRoundOnePairings,
  generateSwissPairings,
  pairKey,
} from "../services/swissPairing";
import {
  calculateSwissStandings,
  rankTeamIdsForPairing,
} from "../services/swissStandings";
import {
  getDefaultTiebreakerOrder,
  parseTiebreakerOrder,
} from "../services/tournamentPlaySettings";
import {
  SwissRoundStatus,
  TiebreakerCriterion,
  TournamentSwissMatch,
  TournamentSwissRound,
  TournamentSwissStanding,
} from "../types";
import { TournamentModel } from "./TournamentModel";

type MatchRow = TournamentSwissMatch & RowDataPacket;
type RoundRow = TournamentSwissRound & RowDataPacket;
type StandingRow = TournamentSwissStanding & RowDataPacket;

export class TournamentSwissModel {
  static async getRounds(
    tournamentId: number,
    connection?: PoolConnection,
  ): Promise<TournamentSwissRound[]> {
    const executor = connection ?? pool;
    const [rows] = await executor.execute<RoundRow[]>(
      `SELECT id, tournament_id, round_number, status, completed_at
       FROM tournament_swiss_rounds
       WHERE tournament_id = ?
       ORDER BY round_number ASC`,
      [tournamentId],
    );
    return rows;
  }

  static async getMatches(
    tournamentId: number,
    connection?: PoolConnection,
  ): Promise<TournamentSwissMatch[]> {
    const executor = connection ?? pool;
    const [rows] = await executor.execute<MatchRow[]>(
      `SELECT
         m.id,
         m.tournament_id,
         m.round_id,
         r.round_number,
         m.team_a_id,
         m.team_b_id,
         m.score_a,
         m.score_b,
         m.winner_team_id,
         m.is_bye,
         m.played_at,
         ta.team_players AS team_a_players,
         tb.team_players AS team_b_players
       FROM tournament_swiss_matches m
       JOIN tournament_swiss_rounds r ON r.id = m.round_id
       LEFT JOIN (
         SELECT tp.team_id,
                GROUP_CONCAT(p.name ORDER BY tp.position ASC, p.name ASC SEPARATOR ', ') AS team_players
         FROM team_players tp
         JOIN players p ON p.id = tp.player_id
         GROUP BY tp.team_id
       ) ta ON ta.team_id = m.team_a_id
       LEFT JOIN (
         SELECT tp.team_id,
                GROUP_CONCAT(p.name ORDER BY tp.position ASC, p.name ASC SEPARATOR ', ') AS team_players
         FROM team_players tp
         JOIN players p ON p.id = tp.player_id
         GROUP BY tp.team_id
       ) tb ON tb.team_id = m.team_b_id
       WHERE m.tournament_id = ?
       ORDER BY r.round_number ASC, m.id ASC`,
      [tournamentId],
    );

    return rows.map((row) => {
      if (!row.is_bye) {
        return row;
      }
      const normalized = normalizeSwissByeScores(row.score_a, row.score_b);
      return {
        ...row,
        score_a: normalized.score_a,
        score_b: normalized.score_b,
      };
    });
  }

  static async getStandings(
    tournamentId: number,
    connection?: PoolConnection,
  ): Promise<TournamentSwissStanding[]> {
    const executor = connection ?? pool;
    const [rows] = await executor.execute<StandingRow[]>(
      `SELECT
         s.*,
         tp.team_players
       FROM tournament_swiss_standings s
       LEFT JOIN (
         SELECT tp.team_id,
                GROUP_CONCAT(p.name ORDER BY tp.position ASC, p.name ASC SEPARATOR ', ') AS team_players
         FROM team_players tp
         JOIN players p ON p.id = tp.player_id
         GROUP BY tp.team_id
       ) tp ON tp.team_id = s.team_id
       WHERE s.tournament_id = ?
       ORDER BY s.rank_position ASC, s.team_id ASC`,
      [tournamentId],
    );
    return rows;
  }

  static async isInitialized(tournamentId: number): Promise<boolean> {
    const [rows] = await pool.execute<RowDataPacket[]>(
      `SELECT id FROM tournament_swiss_rounds WHERE tournament_id = ? LIMIT 1`,
      [tournamentId],
    );
    return rows.length > 0;
  }

  static async getConfirmedTeamIds(tournamentId: number): Promise<number[]> {
    const [rows] = await pool.execute<RowDataPacket[]>(
      `SELECT team_id
       FROM tournament_registrations
       WHERE tournament_id = ? AND is_confirmed = 1
       ORDER BY team_id ASC`,
      [tournamentId],
    );
    return rows.map((row) => Number(row.team_id));
  }

  private static async createRoundMatches(
    connection: PoolConnection,
    tournamentId: number,
    roundId: number,
    pairings: ReturnType<typeof generateRoundOnePairings>,
  ): Promise<void> {
    for (const pairing of pairings) {
      if (pairing.is_bye) {
        await connection.execute(
          `INSERT INTO tournament_swiss_matches
             (tournament_id, round_id, team_a_id, team_b_id, score_a, score_b, winner_team_id, is_bye, played_at)
           VALUES (?, ?, ?, NULL, ?, ?, ?, 1, NOW())`,
          [
            tournamentId,
            roundId,
            pairing.team_a_id,
            SWISS_BYE_SCORE_A,
            SWISS_BYE_SCORE_B,
            pairing.team_a_id,
          ],
        );
        continue;
      }

      await connection.execute(
        `INSERT INTO tournament_swiss_matches
           (tournament_id, round_id, team_a_id, team_b_id, is_bye)
         VALUES (?, ?, ?, ?, 0)`,
        [tournamentId, roundId, pairing.team_a_id, pairing.team_b_id],
      );
    }
  }

  static async initializeSwiss(
    tournamentId: number,
    teamIds: number[],
    totalRounds: number,
  ): Promise<void> {
    if (await this.isInitialized(tournamentId)) {
      throw new Error("Швейцарка уже инициализирована");
    }

    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();

      const [roundResult] = await connection.execute<ResultSetHeader>(
        `INSERT INTO tournament_swiss_rounds (tournament_id, round_number, status)
         VALUES (?, 1, ?)`,
        [tournamentId, SwissRoundStatus.IN_PROGRESS],
      );

      const pairings = generateRoundOnePairings(teamIds);
      await this.createRoundMatches(
        connection,
        tournamentId,
        roundResult.insertId,
        pairings,
      );

      await connection.execute(
        `UPDATE tournaments SET swiss_current_round = 1 WHERE id = ?`,
        [tournamentId],
      );

      await connection.commit();
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }

    await this.refreshStandings(tournamentId, teamIds);
  }

  static async recordMatchResult(
    matchId: number,
    scoreA: number,
    scoreB: number,
  ): Promise<TournamentSwissMatch> {
    if (
      !Number.isInteger(scoreA) ||
      !Number.isInteger(scoreB) ||
      scoreA < 0 ||
      scoreB < 0 ||
      scoreA > 13 ||
      scoreB > 13
    ) {
      throw new Error("Счёт должен быть целым числом от 0 до 13");
    }

    if (scoreA === scoreB) {
      throw new Error("Ничьих в пétanque нет — укажите разный счёт");
    }

    const [rows] = await pool.execute<MatchRow[]>(
      `SELECT m.*, r.round_number, r.status AS round_status
       FROM tournament_swiss_matches m
       JOIN tournament_swiss_rounds r ON r.id = m.round_id
       WHERE m.id = ?`,
      [matchId],
    );

    const match = rows[0];
    if (!match) {
      throw new Error("Матч не найден");
    }
    if (match.is_bye) {
      throw new Error("Нельзя менять результат bye-матча");
    }
    if (match.round_status !== SwissRoundStatus.IN_PROGRESS) {
      throw new Error("Тур уже завершён");
    }

    const winnerTeamId =
      scoreA > scoreB ? match.team_a_id : match.team_b_id!;

    await pool.execute(
      `UPDATE tournament_swiss_matches
       SET score_a = ?, score_b = ?, winner_team_id = ?, played_at = NOW()
       WHERE id = ?`,
      [scoreA, scoreB, winnerTeamId, matchId],
    );

    const teamIds = await this.getConfirmedTeamIds(match.tournament_id);
    await this.refreshStandings(match.tournament_id, teamIds);

    const matches = await this.getMatches(match.tournament_id);
    const updated = matches.find((item) => item.id === matchId);
    if (!updated) {
      throw new Error("Не удалось загрузить обновлённый матч");
    }
    return updated;
  }

  static async completeRound(
    tournamentId: number,
    roundNumber: number,
    teamIds: number[],
    totalRounds: number,
    tiebreakerOrder: TiebreakerCriterion[],
  ): Promise<void> {
    const rounds = await this.getRounds(tournamentId);
    const round = rounds.find((item) => item.round_number === roundNumber);
    if (!round || round.status !== SwissRoundStatus.IN_PROGRESS) {
      throw new Error("Тур не найден или уже завершён");
    }

    const matches = await this.getMatches(tournamentId);
    const roundMatches = matches.filter(
      (match) => match.round_number === roundNumber,
    );
    const incomplete = roundMatches.filter(
      (match) => !match.is_bye && match.winner_team_id == null,
    );
    if (incomplete.length > 0) {
      throw new Error("Не все игры тура имеют результат");
    }

    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();

      await connection.execute(
        `UPDATE tournament_swiss_rounds
         SET status = ?, completed_at = NOW()
         WHERE id = ?`,
        [SwissRoundStatus.COMPLETED, round.id],
      );

      if (roundNumber < totalRounds) {
        const standingsRows = await this.refreshStandings(
          tournamentId,
          teamIds,
          tiebreakerOrder,
          connection,
        );
        const rankedTeamIds = rankTeamIdsForPairing(teamIds, standingsRows);
        const playedPairs = new Set<string>();
        for (const match of matches) {
          if (match.is_bye || match.team_b_id == null) {
            continue;
          }
          playedPairs.add(pairKey(match.team_a_id, match.team_b_id));
        }

        const [roundResult] = await connection.execute<ResultSetHeader>(
          `INSERT INTO tournament_swiss_rounds (tournament_id, round_number, status)
           VALUES (?, ?, ?)`,
          [tournamentId, roundNumber + 1, SwissRoundStatus.IN_PROGRESS],
        );

        const pairings = generateSwissPairings(rankedTeamIds, playedPairs);
        await this.createRoundMatches(
          connection,
          tournamentId,
          roundResult.insertId,
          pairings,
        );

        await connection.execute(
          `UPDATE tournaments SET swiss_current_round = ? WHERE id = ?`,
          [roundNumber + 1, tournamentId],
        );
      } else {
        await connection.execute(
          `UPDATE tournaments SET swiss_current_round = NULL WHERE id = ?`,
          [tournamentId],
        );
      }

      await connection.commit();
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }

    if (roundNumber >= totalRounds) {
      await this.refreshStandings(tournamentId, teamIds, tiebreakerOrder);
    }
  }

  static async refreshStandings(
    tournamentId: number,
    teamIds?: number[],
    tiebreakerOrder?: TiebreakerCriterion[],
    connection?: PoolConnection,
  ): Promise<
    Omit<TournamentSwissStanding, "id" | "tournament_id" | "team_players">[]
  > {
    const executor = connection ?? pool;
    const ids = teamIds ?? (await this.getConfirmedTeamIds(tournamentId));
    const tournament = await TournamentModel.getTournamentById(tournamentId);
    const order =
      tiebreakerOrder ??
      tournament?.tiebreaker_order ??
      getDefaultTiebreakerOrder();

    const matches = await this.getMatches(tournamentId);
    const computed = calculateSwissStandings(ids, matches, order);

    await executor.execute(
      `DELETE FROM tournament_swiss_standings WHERE tournament_id = ?`,
      [tournamentId],
    );

    for (const row of computed) {
      await executor.execute(
        `INSERT INTO tournament_swiss_standings
           (tournament_id, team_id, wins, loses, points_for, points_against,
            buchholz, double_buchholz, berger, progress, point_diff, rank_position)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          tournamentId,
          row.team_id,
          row.wins,
          row.loses,
          row.points_for,
          row.points_against,
          row.buchholz,
          row.double_buchholz,
          row.berger,
          row.progress,
          row.point_diff,
          row.rank_position,
        ],
      );
    }

    return computed;
  }
}
