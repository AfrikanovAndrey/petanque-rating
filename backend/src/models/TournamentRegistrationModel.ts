import { pool } from "../config/database";
import { PoolConnection, ResultSetHeader, RowDataPacket } from "mysql2/promise";
import { TournamentType } from "../types";
import {
  parseRegistrationRosterJson,
  registrationRosterHasNewPlayer,
  type RegistrationRosterStored,
  type RegistrationRosterStoredSlot,
} from "../utils/registrationRosterUtils";

/** Слот состава для ответа API (страница регистрации). */
export type RegistrationRosterSlotDto =
  | { kind: "player"; player_id: number; name: string }
  | {
      kind: "new";
      display_name: string;
      gender?: "male" | "female";
      license_number?: string;
      city?: string;
    }
  | { kind: "empty" };

export interface RegisteredTeamRow {
  team_id: number;
  updated_at: Date;
  players: string[];
  player_ids: number[];
  is_confirmed: boolean;
  roster_slots: RegistrationRosterSlotDto[];
  has_pending_new_players: boolean;
}

function storedSlotToDto(
  slot: RegistrationRosterStoredSlot,
): RegistrationRosterSlotDto {
  if (slot.kind === "empty") {
    return { kind: "empty" };
  }
  if (slot.kind === "new") {
    return {
      kind: "new",
      display_name: slot.display_name,
      ...(slot.gender ? { gender: slot.gender } : {}),
      ...(slot.license_number
        ? { license_number: slot.license_number }
        : {}),
      ...(slot.city ? { city: slot.city } : {}),
    };
  }
  return {
    kind: "player",
    player_id: slot.player_id,
    name: slot.display_name,
  };
}

function padTripletRoster(
  type: TournamentType,
  slots: RegistrationRosterSlotDto[],
): RegistrationRosterSlotDto[] {
  if (type !== TournamentType.TRIPLETTE) {
    return slots;
  }
  const next = [...slots];
  while (next.length < 4) {
    next.push({ kind: "empty" });
  }
  return next;
}

function rosterFromJoin(
  playerIds: number[],
  playerNames: string[],
): RegistrationRosterSlotDto[] {
  const out: RegistrationRosterSlotDto[] = [];
  const n = Math.min(playerIds.length, playerNames.length);
  for (let i = 0; i < n; i++) {
    out.push({
      kind: "player",
      player_id: playerIds[i],
      name: playerNames[i],
    });
  }
  return out;
}

export class TournamentRegistrationModel {
  private static async hasColumn(columnName: string): Promise<boolean> {
    const [rows] = await pool.execute<RowDataPacket[]>(
      `
      SELECT COLUMN_NAME
      FROM information_schema.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME = 'tournament_registrations'
        AND COLUMN_NAME = ?
      LIMIT 1
      `,
      [columnName],
    );
    return rows.length > 0;
  }

  private static async resolveTimestampColumn(): Promise<string> {
    if (await this.hasColumn("updated_at")) {
      return "updated_at";
    }
    return "created_at";
  }

  /**
   * Команды, записанные на турнир через таблицу регистрации (не tournament_results).
   */
  static async listRegisteredTeamsWithPlayers(
    tournamentId: number,
    tournamentType: TournamentType,
    options?: { confirmedOnly?: boolean },
  ): Promise<RegisteredTeamRow[]> {
    const timestampColumn = await this.resolveTimestampColumn();
    const hasRosterJson = await this.hasColumn("registration_roster_json");
    const whereClauses = ["tr.tournament_id = ?"];
    if (options?.confirmedOnly) {
      whereClauses.push("tr.is_confirmed = 1");
    }

    const rosterSelect = hasRosterJson
      ? "tr.registration_roster_json AS registration_roster_json"
      : "CAST(NULL AS JSON) AS registration_roster_json";

    const groupExtra = hasRosterJson ? ", tr.registration_roster_json" : "";

    const [rows] = await pool.execute<RowDataPacket[]>(
      `
      SELECT 
        tr.team_id,
        tr.${timestampColumn} AS updated_at,
        tr.is_confirmed,
        ${rosterSelect},
        GROUP_CONCAT(tp.player_id ORDER BY tp.position ASC SEPARATOR '|||') AS player_ids_joined,
        GROUP_CONCAT(p.name ORDER BY tp.position ASC, p.name ASC SEPARATOR '|||') AS players_joined
      FROM tournament_registrations tr
      LEFT JOIN team_players tp ON tp.team_id = tr.team_id
      LEFT JOIN players p ON p.id = tp.player_id
      WHERE ${whereClauses.join(" AND ")}
      GROUP BY tr.team_id, tr.${timestampColumn}, tr.is_confirmed${groupExtra}
      ORDER BY tr.${timestampColumn} ASC
      `,
      [tournamentId],
    );

    return rows.map((row) => {
      const player_ids = String(row.player_ids_joined || "")
        .split("|||")
        .map((id) => parseInt(id, 10))
        .filter((id) => Number.isInteger(id) && id > 0);
      const playersJoined = String(row.players_joined || "")
        .split("|||")
        .filter((n) => n.length > 0);

      const parsed = hasRosterJson
        ? parseRegistrationRosterJson(row.registration_roster_json)
        : null;

      let roster_slots: RegistrationRosterSlotDto[];
      let has_pending_new_players = false;

      if (parsed?.slots?.length) {
        roster_slots = padTripletRoster(
          tournamentType,
          parsed.slots.map(storedSlotToDto),
        );
        has_pending_new_players = registrationRosterHasNewPlayer(parsed);
      } else {
        roster_slots = padTripletRoster(
          tournamentType,
          rosterFromJoin(player_ids, playersJoined),
        );
        has_pending_new_players = false;
      }

      const players = roster_slots
        .filter((s) => s.kind !== "empty")
        .map((s) =>
          s.kind === "new" ? s.display_name : s.name,
        );

      const player_ids_out = roster_slots
        .filter((s): s is Extract<RegistrationRosterSlotDto, { kind: "player" }> => s.kind === "player")
        .map((s) => s.player_id);

      return {
        team_id: row.team_id as number,
        updated_at: row.updated_at as Date,
        is_confirmed: Boolean(row.is_confirmed),
        player_ids: player_ids_out,
        players,
        roster_slots,
        has_pending_new_players,
      };
    });
  }

  static async isTeamRegistered(
    tournamentId: number,
    teamId: number,
    connection?: PoolConnection,
  ): Promise<boolean> {
    const exec = connection ?? pool;
    const [rows] = await exec.execute<RowDataPacket[]>(
      `SELECT 1 FROM tournament_registrations
       WHERE tournament_id = ? AND team_id = ?
       LIMIT 1`,
      [tournamentId, teamId],
    );
    return rows.length > 0;
  }

  static async addRegistration(
    tournamentId: number,
    teamId: number,
    connection?: PoolConnection,
    roster?: RegistrationRosterStored | null,
  ): Promise<void> {
    const exec = connection ?? pool;
    const hasRosterJson = await this.hasColumn("registration_roster_json");
    if (hasRosterJson && roster) {
      await exec.execute(
        `INSERT INTO tournament_registrations (tournament_id, team_id, registration_roster_json)
         VALUES (?, ?, CAST(? AS JSON))`,
        [tournamentId, teamId, JSON.stringify(roster)],
      );
      return;
    }
    await exec.execute(
      `INSERT INTO tournament_registrations (tournament_id, team_id) VALUES (?, ?)`,
      [tournamentId, teamId],
    );
  }

  static async confirmRegistration(
    tournamentId: number,
    teamId: number,
  ): Promise<
    | "confirmed"
    | "already_confirmed"
    | "not_found"
    | "pending_new_players"
  > {
    const hasRosterJson = await this.hasColumn("registration_roster_json");
    const rosterSelect = hasRosterJson
      ? ", registration_roster_json"
      : "";

    const [existsRows] = await pool.execute<RowDataPacket[]>(
      `SELECT is_confirmed${rosterSelect}
       FROM tournament_registrations
       WHERE tournament_id = ? AND team_id = ?
       LIMIT 1`,
      [tournamentId, teamId],
    );

    if (existsRows.length === 0) {
      return "not_found";
    }

    if (Boolean(existsRows[0].is_confirmed)) {
      return "already_confirmed";
    }

    if (hasRosterJson) {
      const parsed = parseRegistrationRosterJson(
        existsRows[0].registration_roster_json,
      );
      if (registrationRosterHasNewPlayer(parsed)) {
        return "pending_new_players";
      }
    }

    const hasUpdatedAt = await this.hasColumn("updated_at");
    const hasConfirmedAt = await this.hasColumn("confirmed_at");
    let setClause = "is_confirmed = 1";
    if (hasUpdatedAt) {
      setClause += ", updated_at = NOW()";
    } else if (hasConfirmedAt) {
      setClause += ", confirmed_at = NOW()";
    }

    const [result] = await pool.execute<ResultSetHeader>(
      `UPDATE tournament_registrations
       SET ${setClause}
       WHERE tournament_id = ? AND team_id = ? AND is_confirmed = 0`,
      [tournamentId, teamId],
    );

    return result.affectedRows > 0 ? "confirmed" : "already_confirmed";
  }

  static async replaceRegisteredTeam(
    tournamentId: number,
    currentTeamId: number,
    nextTeamId: number,
    connection?: PoolConnection,
  ): Promise<boolean> {
    const exec = connection ?? pool;
    const hasUpdatedAt = await this.hasColumn("updated_at");
    const hasRosterJson = await this.hasColumn("registration_roster_json");

    let setClause = hasUpdatedAt ? "team_id = ?, updated_at = NOW()" : "team_id = ?";
    const params: (number | string)[] = [nextTeamId];
    if (hasRosterJson) {
      setClause += ", registration_roster_json = NULL";
    }
    params.push(tournamentId, currentTeamId);

    const [result] = await exec.execute<ResultSetHeader>(
      `UPDATE tournament_registrations
       SET ${setClause}
       WHERE tournament_id = ? AND team_id = ?`,
      params,
    );
    return result.affectedRows > 0;
  }

  static async deleteRegistration(
    tournamentId: number,
    teamId: number,
  ): Promise<boolean> {
    const [result] = await pool.execute<ResultSetHeader>(
      `DELETE FROM tournament_registrations
       WHERE tournament_id = ? AND team_id = ?`,
      [tournamentId, teamId],
    );
    return result.affectedRows > 0;
  }
}
