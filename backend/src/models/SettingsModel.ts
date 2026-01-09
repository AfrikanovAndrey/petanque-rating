import { pool } from "../config/database";
import { RatingSetting } from "../types";
import { ResultSetHeader, RowDataPacket } from "mysql2";

export class SettingsModel {
  static async getAllSettings(): Promise<RatingSetting[]> {
    const [rows] = await pool.execute<RatingSetting[] & RowDataPacket[]>(
      "SELECT * FROM rating_settings ORDER BY setting_name, year DESC"
    );
    return rows;
  }

  /**
   * Получить best_results_count для указанного года.
   * Если для года нет настройки, берётся ближайшая предыдущая или значение по умолчанию (8).
   */
  static async getBestResultsCount(year?: number): Promise<number> {
    const targetYear = year || new Date().getFullYear();
    
    // Сначала пробуем найти настройку для конкретного года
    const [rows] = await pool.execute<RatingSetting[] & RowDataPacket[]>(
      "SELECT setting_value FROM rating_settings WHERE setting_name = ? AND year = ?",
      ["best_results_count", targetYear]
    );
    
    if (rows.length > 0) {
      return parseInt(rows[0].setting_value || "8");
    }
    
    // Если нет для конкретного года, берём ближайший предыдущий год
    const [fallbackRows] = await pool.execute<RatingSetting[] & RowDataPacket[]>(
      "SELECT setting_value FROM rating_settings WHERE setting_name = ? AND year <= ? ORDER BY year DESC LIMIT 1",
      ["best_results_count", targetYear]
    );
    
    return parseInt(fallbackRows[0]?.setting_value || "8");
  }

  /**
   * Установить best_results_count для указанного года.
   */
  static async setBestResultsCount(count: number, year?: number): Promise<boolean> {
    const targetYear = year || new Date().getFullYear();
    
    // Используем INSERT ... ON DUPLICATE KEY UPDATE для upsert
    const [result] = await pool.execute<ResultSetHeader>(
      `INSERT INTO rating_settings (setting_name, year, setting_value, description) 
       VALUES (?, ?, ?, 'Количество лучших результатов для подсчета рейтинга')
       ON DUPLICATE KEY UPDATE setting_value = ?`,
      ["best_results_count", targetYear, count.toString(), count.toString()]
    );
    return result.affectedRows > 0;
  }

  /**
   * Получить настройку для всех годов
   */
  static async getBestResultsCountByYears(): Promise<Array<{ year: number; count: number }>> {
    const [rows] = await pool.execute<RowDataPacket[]>(
      "SELECT year, setting_value FROM rating_settings WHERE setting_name = ? ORDER BY year DESC",
      ["best_results_count"]
    );
    return (rows as any[]).map(row => ({
      year: row.year,
      count: parseInt(row.setting_value || "8")
    }));
  }
}
