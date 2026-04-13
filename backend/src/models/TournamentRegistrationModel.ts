import { pool } from "../config/database";
import { RowDataPacket } from "mysql2/promise";

export interface RegisteredTeamRow {
  team_id: number;
  registered_at: Date;
  players: string[];
}

export class TournamentRegistrationModel {
  /**
   * Команды, записанные на турнир через таблицу регистрации (не tournament_results).
   */
  static async listRegisteredTeamsWithPlayers(
    tournamentId: number,
  ): Promise<RegisteredTeamRow[]> {
    const [rows] = await pool.execute<RowDataPacket[]>(
      `
      SELECT 
        tr.team_id,
        tr.created_at AS registered_at,
        GROUP_CONCAT(p.name ORDER BY tp.position ASC, p.name ASC SEPARATOR '|||') AS players_joined
      FROM tournament_registrations tr
      JOIN team_players tp ON tp.team_id = tr.team_id
      JOIN players p ON p.id = tp.player_id
      WHERE tr.tournament_id = ?
      GROUP BY tr.team_id, tr.created_at
      ORDER BY tr.created_at ASC
      `,
      [tournamentId],
    );

    return rows.map((row) => ({
      team_id: row.team_id as number,
      registered_at: row.registered_at as Date,
      players: String(row.players_joined || "")
        .split("|||")
        .filter((n) => n.length > 0),
    }));
  }
}
