import { pool } from "../config/database";
import { RatingSetting, PositionPoints } from "../types";
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

  static async getAllPositionPoints(): Promise<PositionPoints[]> {
    const [rows] = await pool.execute<PositionPoints[] & RowDataPacket[]>(
      "SELECT * FROM position_points ORDER BY position ASC"
    );
    return rows;
  }

  static async getPointsForPosition(position: number): Promise<number> {
    const [rows] = await pool.execute<RowDataPacket[]>(
      "SELECT points FROM position_points WHERE position = ?",
      [position]
    );

    if (rows.length > 0) {
      return rows[0].points;
    }

    // Если для позиции нет настроенных очков, возвращаем 0
    return 0;
  }

  static async setPointsForPosition(
    position: number,
    points: number
  ): Promise<boolean> {
    const [result] = await pool.execute<ResultSetHeader>(
      "INSERT INTO position_points (position, points) VALUES (?, ?) ON DUPLICATE KEY UPDATE points = VALUES(points)",
      [position, points]
    );
    return result.affectedRows > 0;
  }

  static async deletePositionPoints(position: number): Promise<boolean> {
    const [result] = await pool.execute<ResultSetHeader>(
      "DELETE FROM position_points WHERE position = ?",
      [position]
    );
    return result.affectedRows > 0;
  }

  static async updateMultiplePositionPoints(
    positionPoints: Array<{ position: number; points: number }>
  ): Promise<boolean> {
    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();

      for (const { position, points } of positionPoints) {
        await connection.execute(
          "INSERT INTO position_points (position, points) VALUES (?, ?) ON DUPLICATE KEY UPDATE points = VALUES(points)",
          [position, points]
        );
      }

      await connection.commit();
      return true;
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }
}
