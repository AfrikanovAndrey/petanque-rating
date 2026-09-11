import { pool } from "../config/database";
import { RowDataPacket } from "mysql2/promise";
import { TournamentType } from "../types";
import {
  computeTeamRatingFromPlayerPoints,
  playerRatingsForSwissSeed,
} from "./swissStageService";
import {
  resolveAsOfDateStr,
  subtractDaysFromDateStr,
} from "../utils/ymdDate";

export type SwissTeamRatingDetails = {
  rating: number;
  player_ratings: number[];
};

/** Как RatingController.getBestResultsCount */
async function getBestResultsCount(
  refYear: number,
  asOfDateStr: string,
): Promise<number> {
  const [tournamentsRows] = await pool.execute<RowDataPacket[]>(
    "SELECT COUNT(*) as count FROM tournaments WHERE YEAR(date) = ? AND date <= ?",
    [refYear, asOfDateStr],
  );
  const hasTournamentsThisYear = Number(tournamentsRows[0]?.count ?? 0) > 0;
  const yearToUse = hasTournamentsThisYear ? refYear : refYear - 1;

  const [settingsRows] = await pool.execute<RowDataPacket[]>(
    `SELECT setting_value FROM rating_settings
     WHERE setting_name = "best_results_count" AND year = ?`,
    [yearToUse],
  );
  return parseInt(String(settingsRows[0]?.setting_value ?? "8"), 10);
}

function licenseDateStr(licenseDate: unknown): string {
  if (licenseDate instanceof Date) {
    return licenseDate.toISOString().split("T")[0];
  }
  return new Date(String(licenseDate)).toISOString().split("T")[0];
}

/**
 * Рейтинг игроков как на публичной странице:
 * только лицензированные (текущий/прошлый год), турниры после даты лицензии,
 * сумма лучших N признанных результатов за 365 дней.
 * Без лицензии — 0.
 */
export async function loadPlayerTotalPointsMap(
  playerIds: number[],
  asOfDateStr?: string | null,
): Promise<Map<number, number>> {
  const result = new Map<number, number>();
  const unique = [...new Set(playerIds.filter((id) => id > 0))];
  for (const id of unique) {
    result.set(id, 0);
  }
  if (unique.length === 0) {
    return result;
  }

  const refDateStr = resolveAsOfDateStr(asOfDateStr);
  const refYear = Number(refDateStr.slice(0, 4));
  const bestResultsCount = await getBestResultsCount(refYear, refDateStr);
  const minDateStr = subtractDaysFromDateStr(refDateStr, 365);

  for (const playerId of unique) {
    const [licensesRows] = await pool.execute<RowDataPacket[]>(
      `SELECT year, license_date FROM licensed_players
       WHERE player_id = ? AND year IN (?, ?)`,
      [playerId, refYear, refYear - 1],
    );

    if (licensesRows.length === 0) {
      // Нелицензированный — как на публичном рейтинге (игрока нет в таблице)
      continue;
    }

    const licenseConditions = licensesRows
      .map(
        (lic) =>
          `(YEAR(t.date) = ${Number(lic.year)} AND t.date >= '${licenseDateStr(
            lic.license_date,
          )}')`,
      )
      .join(" OR ");

    const [rows] = await pool.execute<RowDataPacket[]>(
      `SELECT tr.points
       FROM tournament_results tr
       JOIN tournaments t ON tr.tournament_id = t.id
       WHERE EXISTS (
         SELECT 1 FROM team_players tp
         WHERE tp.team_id = tr.team_id AND tp.player_id = ?
       )
         AND tr.points > 0
         AND t.date >= ?
         AND t.date <= ?
         AND t.results_validated_at IS NOT NULL
         AND (${licenseConditions})
       ORDER BY tr.points DESC, t.date DESC`,
      [playerId, minDateStr, refDateStr],
    );

    const total = rows
      .slice(0, bestResultsCount)
      .reduce((sum, r) => sum + Number(r.points || 0), 0);
    result.set(playerId, total);
  }

  return result;
}

export async function computeTeamRatingsForSwiss(
  teams: Array<{ team_id: number; player_ids: number[] }>,
  tournamentType: TournamentType,
  asOfDateStr?: string | null,
): Promise<Map<number, SwissTeamRatingDetails>> {
  const allPlayerIds = teams.flatMap((t) => t.player_ids);
  const pointsByPlayer = await loadPlayerTotalPointsMap(
    allPlayerIds,
    asOfDateStr,
  );
  const ratings = new Map<number, SwissTeamRatingDetails>();
  for (const team of teams) {
    const playerPoints = team.player_ids.map(
      (id) => pointsByPlayer.get(id) ?? 0,
    );
    ratings.set(team.team_id, {
      rating: computeTeamRatingFromPlayerPoints(playerPoints, tournamentType),
      player_ratings: playerRatingsForSwissSeed(playerPoints, tournamentType),
    });
  }
  return ratings;
}
