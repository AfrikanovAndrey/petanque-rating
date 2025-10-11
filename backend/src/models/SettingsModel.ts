import { pool } from "../config/database";
import { RatingSetting } from "../types";
import { ResultSetHeader, RowDataPacket } from "mysql2";

export class SettingsModel {
  static async getAllSettings(): Promise<RatingSetting[]> {
    const [rows] = await pool.execute<RatingSetting[] & RowDataPacket[]>(
      "SELECT * FROM rating_settings ORDER BY setting_name"
    );
    return rows;
  }

  static async getBestResultsCount(): Promise<number> {
    const [rows] = await pool.execute<RatingSetting[] & RowDataPacket[]>(
      "SELECT * FROM rating_settings WHERE setting_name = ?",
      ["best_results_count"]
    );
    return parseInt(rows[0]?.setting_value || "8");
  }

  static async setBestResultsCount(count: number): Promise<boolean> {
    const [result] = await pool.execute<ResultSetHeader>(
      "UPDATE rating_settings SET setting_value = ? WHERE setting_name = ?",
      [count.toString(), "best_results_count"]
    );
    return result.affectedRows > 0;
  }
}
