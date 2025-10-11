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

  static async getSetting(settingName: string): Promise<RatingSetting | null> {
    const [rows] = await pool.execute<RatingSetting[] & RowDataPacket[]>(
      "SELECT * FROM rating_settings WHERE setting_name = ?",
      [settingName]
    );
    return rows[0] || null;
  }

  static async updateSetting(
    settingName: string,
    settingValue: string
  ): Promise<boolean> {
    const [result] = await pool.execute<ResultSetHeader>(
      "UPDATE rating_settings SET setting_value = ? WHERE setting_name = ?",
      [settingValue, settingName]
    );
    return result.affectedRows > 0;
  }

  static async createSetting(
    settingName: string,
    settingValue: string,
    description?: string
  ): Promise<number> {
    const [result] = await pool.execute<ResultSetHeader>(
      "INSERT INTO rating_settings (setting_name, setting_value, description) VALUES (?, ?, ?)",
      [settingName, settingValue, description]
    );
    return result.insertId;
  }

  static async getBestResultsCount(): Promise<number> {
    const setting = await this.getSetting("best_results_count");
    return parseInt(setting?.setting_value || "8");
  }

  static async setBestResultsCount(count: number): Promise<boolean> {
    return await this.updateSetting("best_results_count", count.toString());
  }
}
