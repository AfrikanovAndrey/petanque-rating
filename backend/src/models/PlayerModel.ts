import { pool } from "../config/database";
import { Player, PlayerRating, TournamentResultWithTournament } from "../types";
import { ResultSetHeader, RowDataPacket } from "mysql2";

export class PlayerModel {
  static async getAllPlayers(): Promise<Player[]> {
    const [rows] = await pool.execute<Player[] & RowDataPacket[]>(
      "SELECT * FROM players ORDER BY name"
    );
    return rows;
  }

  static async getPlayerById(id: number): Promise<Player | null> {
    const [rows] = await pool.execute<Player[] & RowDataPacket[]>(
      "SELECT * FROM players WHERE id = ?",
      [id]
    );
    return rows[0] || null;
  }

  static async getPlayerByName(name: string): Promise<Player[] | null> {
    let rows: Player[] & RowDataPacket[];

    // Если игрок указан с фамилией и именем (абривеатурой). Например: "Елсаков С"
    if (name.includes(" ")) {
      [rows] = await pool.execute<Player[] & RowDataPacket[]>(
        "SELECT * FROM players WHERE name LIKE ?",
        [`${name}%`]
      );
    } else {
      // Если указано только одна часть (имя или фамилия). Например: "Федотов" или "Хафидо"
      [rows] = await pool.execute<Player[] & RowDataPacket[]>(
        "SELECT * FROM players WHERE name LIKE ? OR name LIKE ?",
        [`${name} %`, `% ${name}`]
      );
    }

    return rows.length ? rows : null;
  }

  static async createPlayer(name: string, city?: string): Promise<number> {
    const [result] = await pool.execute<ResultSetHeader>(
      "INSERT INTO players (name, city) VALUES (?, ?)",
      [name, city || null]
    );
    return result.insertId;
  }

  static async updatePlayer(
    id: number,
    name: string,
    gender: string,
    city?: string
  ): Promise<boolean> {
    const [result] = await pool.execute<ResultSetHeader>(
      "UPDATE players SET name = ?, gender = ?, city = ? WHERE id = ?",
      [name, gender, city || null, id]
    );
    return result.affectedRows > 0;
  }

  static async deletePlayer(id: number): Promise<boolean> {
    const [result] = await pool.execute<ResultSetHeader>(
      "DELETE FROM players WHERE id = ?",
      [id]
    );
    return result.affectedRows > 0;
  }
}
