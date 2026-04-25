import { pool } from "../config/database";
import { PoolConnection, ResultSetHeader, RowDataPacket } from "mysql2/promise";

export interface RegisteredTeamRow {
  team_id: number;
  updated_at: Date;
  players: string[];
  player_ids: number[];
  is_confirmed: boolean;
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
    options?: { confirmedOnly?: boolean },
  ): Promise<RegisteredTeamRow[]> {
    const timestampColumn = await this.resolveTimestampColumn();
    const whereClauses = ["tr.tournament_id = ?"];
    if (options?.confirmedOnly) {
      whereClauses.push("tr.is_confirmed = 1");
    }

    const [rows] = await pool.execute<RowDataPacket[]>(
      `
      SELECT 
        tr.team_id,
        tr.${timestampColumn} AS updated_at,
        tr.is_confirmed,
        GROUP_CONCAT(tp.player_id ORDER BY tp.position ASC SEPARATOR '|||') AS player_ids_joined,
        GROUP_CONCAT(p.name ORDER BY tp.position ASC, p.name ASC SEPARATOR '|||') AS players_joined
      FROM tournament_registrations tr
      JOIN team_players tp ON tp.team_id = tr.team_id
      JOIN players p ON p.id = tp.player_id
      WHERE ${whereClauses.join(" AND ")}
      GROUP BY tr.team_id, tr.${timestampColumn}, tr.is_confirmed
      ORDER BY tr.${timestampColumn} ASC
      `,
      [tournamentId],
    );

    return rows.map((row) => ({
      team_id: row.team_id as number,
      updated_at: row.updated_at as Date,
      is_confirmed: Boolean(row.is_confirmed),
      player_ids: String(row.player_ids_joined || "")
        .split("|||")
        .map((id) => parseInt(id, 10))
        .filter((id) => Number.isInteger(id) && id > 0),
      players: String(row.players_joined || "")
        .split("|||")
        .filter((n) => n.length > 0),
    }));
  }

  static async isTeamRegistered(
    tournamentId: number,
    teamId: number,
    connection?: PoolConnection
  ): Promise<boolean> {
    const exec = connection ?? pool;
    const [rows] = await exec.execute<RowDataPacket[]>(
      `SELECT 1 FROM tournament_registrations
       WHERE tournament_id = ? AND team_id = ?
       LIMIT 1`,
      [tournamentId, teamId]
    );
    return rows.length > 0;
  }

  static async addRegistration(
    tournamentId: number,
    teamId: number,
    connection?: PoolConnection
  ): Promise<void> {
    const exec = connection ?? pool;
    await exec.execute(
      `INSERT INTO tournament_registrations (tournament_id, team_id) VALUES (?, ?)`,
      [tournamentId, teamId]
    );
  }

  static async confirmRegistration(
    tournamentId: number,
    teamId: number,
  ): Promise<"confirmed" | "already_confirmed" | "not_found"> {
    const [existsRows] = await pool.execute<RowDataPacket[]>(
      `SELECT is_confirmed
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
    connection?: PoolConnection
  ): Promise<boolean> {
    const exec = connection ?? pool;
    const hasUpdatedAt = await this.hasColumn("updated_at");
    const setClause = hasUpdatedAt ? "team_id = ?, updated_at = NOW()" : "team_id = ?";
    const [result] = await exec.execute<ResultSetHeader>(
      `UPDATE tournament_registrations
       SET ${setClause}
       WHERE tournament_id = ? AND team_id = ?`,
      [nextTeamId, tournamentId, currentTeamId]
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
