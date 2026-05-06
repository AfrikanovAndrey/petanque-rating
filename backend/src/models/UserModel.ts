import { pool } from "../config/database";
import { User, UserRole, CreateUserRequest, UpdateUserRequest } from "../types";
import { ResultSetHeader, RowDataPacket } from "mysql2";
import bcrypt from "bcrypt";

export class UserModel {
  private static readonly ROLE_PRIORITY: UserRole[] = [
    UserRole.ADMIN,
    UserRole.MANAGER,
    UserRole.LICENSE_MANAGER,
    UserRole.PRESIDIUM_MEMBER,
  ];

  private static getPrimaryRole(roles: UserRole[], fallback: UserRole): UserRole {
    for (const role of UserModel.ROLE_PRIORITY) {
      if (roles.includes(role)) return role;
    }
    return fallback;
  }

  private static normalizeRoles(rawRoles: unknown, fallbackRole: UserRole): UserRole[] {
    let parsed: unknown = rawRoles;

    if (typeof rawRoles === "string") {
      try {
        parsed = JSON.parse(rawRoles);
      } catch {
        parsed = null;
      }
    }

    if (!Array.isArray(parsed)) {
      return [fallbackRole];
    }

    const allowed = new Set<string>(Object.values(UserRole));
    const roles = parsed.filter(
      (r): r is UserRole => typeof r === "string" && allowed.has(r),
    );
    return roles.length > 0 ? [...new Set(roles)] : [fallbackRole];
  }

  private static normalizeUserRow(row: User & RowDataPacket): User {
    const roles = UserModel.normalizeRoles(row.roles, row.role);
    return {
      ...row,
      role: UserModel.getPrimaryRole(roles, row.role),
      roles,
    };
  }

  /**
   * Получить пользователя по username
   */
  static async getUserByUsername(username: string): Promise<User | null> {
    const [rows] = await pool.execute<(User & RowDataPacket)[]>(
      "SELECT * FROM users WHERE username = ?",
      [username]
    );
    if (rows.length === 0) return null;
    return UserModel.normalizeUserRow(rows[0]);
  }

  /**
   * Получить пользователя по ID
   */
  static async getUserById(id: number): Promise<User | null> {
    const [rows] = await pool.execute<(User & RowDataPacket)[]>(
      "SELECT * FROM users WHERE id = ?",
      [id]
    );
    if (rows.length === 0) return null;
    return UserModel.normalizeUserRow(rows[0]);
  }

  /**
   * Получить всех пользователей (без паролей)
   */
  static async getAllUsers(): Promise<Omit<User, "password_hash">[]> {
    const [rows] = await pool.execute<RowDataPacket[]>(
      "SELECT id, name, username, role, roles, created_at, updated_at FROM users ORDER BY name"
    );
    return (rows as (User & RowDataPacket)[]).map((row) => {
      const normalized = UserModel.normalizeUserRow(row);
      const { password_hash, ...userWithoutPassword } = normalized;
      return userWithoutPassword;
    });
  }

  /**
   * Создать нового пользователя
   */
  static async createUser(data: CreateUserRequest): Promise<number> {
    const saltRounds = 10;
    const passwordHash = await bcrypt.hash(data.password, saltRounds);
    const roles = data.roles && data.roles.length > 0
      ? [...new Set(data.roles)]
      : data.role
        ? [data.role]
        : [UserRole.MANAGER];
    const primaryRole = UserModel.getPrimaryRole(roles, UserRole.MANAGER);

    const [result] = await pool.execute<ResultSetHeader>(
      "INSERT INTO users (name, username, password_hash, role, roles) VALUES (?, ?, ?, ?, ?)",
      [data.name, data.username, passwordHash, primaryRole, JSON.stringify(roles)]
    );
    return result.insertId;
  }

  /**
   * Обновить пользователя
   */
  static async updateUser(
    id: number,
    data: UpdateUserRequest
  ): Promise<boolean> {
    const updates: string[] = [];
    const values: any[] = [];

    if (data.name !== undefined) {
      updates.push("name = ?");
      values.push(data.name);
    }

    if (data.username !== undefined) {
      updates.push("username = ?");
      values.push(data.username);
    }

    if (data.password !== undefined && data.password.length > 0) {
      const saltRounds = 10;
      const passwordHash = await bcrypt.hash(data.password, saltRounds);
      updates.push("password_hash = ?");
      values.push(passwordHash);
    }

    if (data.role !== undefined) {
      updates.push("role = ?");
      values.push(data.role);
      if (data.roles === undefined) {
        updates.push("roles = ?");
        values.push(JSON.stringify([data.role]));
      }
    }
    if (data.roles !== undefined) {
      const roles = data.roles.length > 0 ? [...new Set(data.roles)] : [];
      if (roles.length > 0) {
        updates.push("roles = ?");
        values.push(JSON.stringify(roles));
        if (data.role === undefined) {
          updates.push("role = ?");
          values.push(UserModel.getPrimaryRole(roles, UserRole.MANAGER));
        }
      }
    }

    if (updates.length === 0) {
      return true; // Нечего обновлять
    }

    values.push(id);

    const [result] = await pool.execute<ResultSetHeader>(
      `UPDATE users SET ${updates.join(", ")} WHERE id = ?`,
      values
    );
    return result.affectedRows > 0;
  }

  /**
   * Удалить пользователя
   */
  static async deleteUser(id: number): Promise<boolean> {
    const [result] = await pool.execute<ResultSetHeader>(
      "DELETE FROM users WHERE id = ?",
      [id]
    );
    return result.affectedRows > 0;
  }

  /**
   * Проверить пароль
   */
  static async verifyPassword(
    password: string,
    passwordHash: string
  ): Promise<boolean> {
    return await bcrypt.compare(password, passwordHash);
  }

  /**
   * Обновить пароль пользователя
   */
  static async updateUserPassword(
    id: number,
    newPassword: string
  ): Promise<boolean> {
    const saltRounds = 10;
    const passwordHash = await bcrypt.hash(newPassword, saltRounds);

    const [result] = await pool.execute<ResultSetHeader>(
      "UPDATE users SET password_hash = ? WHERE id = ?",
      [passwordHash, id]
    );
    return result.affectedRows > 0;
  }

  /**
   * Создать пользователя по умолчанию (ADMIN), если таблица users пуста
   */
  static async ensureDefaultAdmin(): Promise<void> {
    // Проверяем, есть ли пользователи в системе
    const [rows] = await pool.execute<RowDataPacket[]>(
      "SELECT COUNT(*) as count FROM users"
    );

    const userCount = rows[0].count;

    if (userCount === 0) {
      // Создаем администратора по умолчанию
      const defaultName = process.env.ADMIN_NAME || "Администратор";
      const defaultUsername = process.env.ADMIN_USERNAME || "admin";
      const defaultPassword = process.env.ADMIN_PASSWORD || "admin123";

      await this.createUser({
        name: defaultName,
        username: defaultUsername,
        password: defaultPassword,
        role: UserRole.ADMIN,
      });
      console.log(`✅ Создан администратор по умолчанию: ${defaultUsername}`);
    }
  }
}
