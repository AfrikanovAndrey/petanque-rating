import { pool } from "../config/database";
import { Admin } from "../types";
import { ResultSetHeader, RowDataPacket } from "mysql2";
import bcrypt from "bcrypt";

export class AuthModel {
  static async getAdminByUsername(username: string): Promise<Admin | null> {
    const [rows] = await pool.execute<Admin[] & RowDataPacket[]>(
      "SELECT * FROM admins WHERE username = ?",
      [username]
    );
    return rows[0] || null;
  }

  static async createAdmin(
    username: string,
    password: string
  ): Promise<number> {
    const saltRounds = 10;
    const passwordHash = await bcrypt.hash(password, saltRounds);

    const [result] = await pool.execute<ResultSetHeader>(
      "INSERT INTO admins (username, password_hash) VALUES (?, ?)",
      [username, passwordHash]
    );
    return result.insertId;
  }

  static async verifyPassword(
    password: string,
    passwordHash: string
  ): Promise<boolean> {
    return await bcrypt.compare(password, passwordHash);
  }

  static async ensureDefaultAdmin(): Promise<void> {
    // Проверяем, есть ли администраторы в системе
    const [rows] = await pool.execute<RowDataPacket[]>(
      "SELECT COUNT(*) as count FROM admins"
    );

    const adminCount = rows[0].count;

    if (adminCount === 0) {
      // Создаем администратора по умолчанию
      const defaultUsername = process.env.ADMIN_USERNAME || "admin";
      const defaultPassword = process.env.ADMIN_PASSWORD || "admin123";

      await this.createAdmin(defaultUsername, defaultPassword);
      console.log(`✅ Создан администратор по умолчанию: ${defaultUsername}`);
    }
  }
}
