import { pool } from "../config/database";
import { RowDataPacket, ResultSetHeader } from "mysql2/promise";
import { UserRole } from "../types";

export interface AuditLog {
  id: number;
  user_id: number;
  username: string;
  user_role: UserRole;
  action: string;
  entity_type?: string | null;
  entity_id?: number | null;
  entity_name?: string | null;
  description?: string | null;
  ip_address?: string | null;
  user_agent?: string | null;
  request_method?: string | null;
  request_url?: string | null;
  request_body?: any | null;
  changes?: any | null;
  success: boolean;
  error_message?: string | null;
  created_at: Date;
}

export interface CreateAuditLogData {
  user_id: number;
  username: string;
  user_role: UserRole;
  action: string;
  entity_type?: string | null;
  entity_id?: number | null;
  entity_name?: string | null;
  description?: string | null;
  ip_address?: string | null;
  user_agent?: string | null;
  request_method?: string | null;
  request_url?: string | null;
  request_body?: any | null;
  changes?: any | null;
  success?: boolean;
  error_message?: string | null;
}

export interface AuditLogFilters {
  user_id?: number;
  username?: string;
  action?: string;
  entity_type?: string;
  entity_id?: number;
  success?: boolean;
  date_from?: string;
  date_to?: string;
  limit?: number;
  offset?: number;
}

export class AuditLogModel {
  /**
   * Создать запись в логе аудита
   */
  static async create(data: CreateAuditLogData): Promise<number> {
    try {
      const [result] = await pool.execute<ResultSetHeader>(
        `INSERT INTO audit_logs (
          user_id, username, user_role, action, entity_type, entity_id, 
          entity_name, description, ip_address, user_agent, request_method,
          request_url, request_body, changes, success, error_message
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          data.user_id,
          data.username,
          data.user_role,
          data.action,
          data.entity_type || null,
          data.entity_id || null,
          data.entity_name || null,
          data.description || null,
          data.ip_address || null,
          data.user_agent || null,
          data.request_method || null,
          data.request_url || null,
          data.request_body ? JSON.stringify(data.request_body) : null,
          data.changes ? JSON.stringify(data.changes) : null,
          data.success !== undefined ? data.success : true,
          data.error_message || null,
        ]
      );

      return result.insertId;
    } catch (error) {
      // Не пробрасываем ошибку дальше, чтобы не прерывать основной запрос
      console.error("❌ Ошибка при создании записи аудита:", error);
      return 0;
    }
  }

  /**
   * Получить записи аудита с фильтрацией
   */
  static async findAll(filters: AuditLogFilters = {}): Promise<{
    logs: AuditLog[];
    total: number;
  }> {
    const conditions: string[] = [];
    const params: any[] = [];

    // Фильтры
    if (filters.user_id) {
      conditions.push("user_id = ?");
      params.push(filters.user_id);
    }

    if (filters.username) {
      conditions.push("username LIKE ?");
      params.push(`%${filters.username}%`);
    }

    if (filters.action) {
      conditions.push("action = ?");
      params.push(filters.action);
    }

    if (filters.entity_type) {
      conditions.push("entity_type = ?");
      params.push(filters.entity_type);
    }

    if (filters.entity_id) {
      conditions.push("entity_id = ?");
      params.push(filters.entity_id);
    }

    if (filters.success !== undefined) {
      conditions.push("success = ?");
      params.push(filters.success);
    }

    if (filters.date_from) {
      conditions.push("created_at >= ?");
      params.push(filters.date_from);
    }

    if (filters.date_to) {
      conditions.push("created_at <= ?");
      params.push(filters.date_to);
    }

    const whereClause =
      conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

    // Получаем общее количество записей
    const [countResult] = await pool.execute<RowDataPacket[]>(
      `SELECT COUNT(*) as total FROM audit_logs ${whereClause}`,
      params
    );

    const total = countResult[0].total;

    // Получаем записи с пагинацией
    const limit = Math.max(1, Math.min(1000, filters.limit || 50)); // Ограничиваем от 1 до 1000
    const offset = Math.max(0, filters.offset || 0);

    // LIMIT и OFFSET используем напрямую (безопасно, так как мы контролируем значения)
    const selectQuery = `SELECT 
        id, user_id, username, user_role, action, entity_type, entity_id, 
        entity_name, description, ip_address, user_agent, request_method,
        request_url, request_body, changes, success, error_message, created_at
       FROM audit_logs ${whereClause} 
       ORDER BY created_at DESC 
       LIMIT ${limit} OFFSET ${offset}`;

    const [rows] = await pool.execute<RowDataPacket[]>(selectQuery, params);

    const logs: AuditLog[] = rows.map((row) => {
      try {
        return {
          ...row,
          request_body:
            row.request_body && typeof row.request_body === "string"
              ? JSON.parse(row.request_body)
              : row.request_body || null,
          changes:
            row.changes && typeof row.changes === "string"
              ? JSON.parse(row.changes)
              : row.changes || null,
        };
      } catch (e) {
        console.error("Error parsing JSON for row:", row.id, e);
        return {
          ...row,
          request_body: null,
          changes: null,
        };
      }
    }) as AuditLog[];

    return { logs, total };
  }

  /**
   * Получить запись аудита по ID
   */
  static async findById(id: number): Promise<AuditLog | null> {
    const [rows] = await pool.execute<RowDataPacket[]>(
      `SELECT * FROM audit_logs WHERE id = ?`,
      [id]
    );

    if (rows.length === 0) {
      return null;
    }

    const row = rows[0];
    return {
      ...row,
      request_body:
        row.request_body && typeof row.request_body === "string"
          ? JSON.parse(row.request_body)
          : row.request_body || null,
      changes:
        row.changes && typeof row.changes === "string"
          ? JSON.parse(row.changes)
          : row.changes || null,
    } as AuditLog;
  }

  /**
   * Получить последние действия пользователя
   */
  static async findByUser(
    userId: number,
    limit: number = 50
  ): Promise<AuditLog[]> {
    const [rows] = await pool.execute<RowDataPacket[]>(
      `SELECT * FROM audit_logs 
       WHERE user_id = ? 
       ORDER BY created_at DESC 
       LIMIT ?`,
      [userId, limit]
    );

    return rows.map((row) => ({
      ...row,
      request_body:
        row.request_body && typeof row.request_body === "string"
          ? JSON.parse(row.request_body)
          : row.request_body || null,
      changes:
        row.changes && typeof row.changes === "string"
          ? JSON.parse(row.changes)
          : row.changes || null,
    })) as AuditLog[];
  }

  /**
   * Получить историю изменений сущности
   */
  static async findByEntity(
    entityType: string,
    entityId: number,
    limit: number = 50
  ): Promise<AuditLog[]> {
    const [rows] = await pool.execute<RowDataPacket[]>(
      `SELECT * FROM audit_logs 
       WHERE entity_type = ? AND entity_id = ? 
       ORDER BY created_at DESC 
       LIMIT ?`,
      [entityType, entityId, limit]
    );

    return rows.map((row) => ({
      ...row,
      request_body:
        row.request_body && typeof row.request_body === "string"
          ? JSON.parse(row.request_body)
          : row.request_body || null,
      changes:
        row.changes && typeof row.changes === "string"
          ? JSON.parse(row.changes)
          : row.changes || null,
    })) as AuditLog[];
  }

  /**
   * Получить статистику действий
   */
  static async getStatistics(
    dateFrom?: string,
    dateTo?: string
  ): Promise<{
    totalActions: number;
    successfulActions: number;
    failedActions: number;
    actionsByType: { action: string; count: number }[];
    actionsByUser: { username: string; count: number }[];
    actionsByEntity: { entity_type: string; count: number }[];
  }> {
    const conditions: string[] = [];
    const params: any[] = [];

    if (dateFrom) {
      conditions.push("created_at >= ?");
      params.push(dateFrom);
    }

    if (dateTo) {
      conditions.push("created_at <= ?");
      params.push(dateTo);
    }

    const whereClause =
      conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

    // Общее количество действий
    const [totalResult] = await pool.execute<RowDataPacket[]>(
      `SELECT 
        COUNT(*) as total,
        SUM(CASE WHEN success = 1 THEN 1 ELSE 0 END) as successful,
        SUM(CASE WHEN success = 0 THEN 1 ELSE 0 END) as failed
       FROM audit_logs ${whereClause}`,
      params
    );

    // Действия по типам
    const [actionsByType] = await pool.execute<RowDataPacket[]>(
      `SELECT action, COUNT(*) as count 
       FROM audit_logs ${whereClause}
       GROUP BY action 
       ORDER BY count DESC 
       LIMIT 20`,
      params
    );

    // Действия по пользователям
    const [actionsByUser] = await pool.execute<RowDataPacket[]>(
      `SELECT username, COUNT(*) as count 
       FROM audit_logs ${whereClause}
       GROUP BY username 
       ORDER BY count DESC 
       LIMIT 20`,
      params
    );

    // Действия по типам сущностей
    const [actionsByEntity] = await pool.execute<RowDataPacket[]>(
      `SELECT entity_type, COUNT(*) as count 
       FROM audit_logs ${whereClause}
       WHERE entity_type IS NOT NULL
       GROUP BY entity_type 
       ORDER BY count DESC`,
      params
    );

    return {
      totalActions: totalResult[0].total || 0,
      successfulActions: totalResult[0].successful || 0,
      failedActions: totalResult[0].failed || 0,
      actionsByType: actionsByType as any[],
      actionsByUser: actionsByUser as any[],
      actionsByEntity: actionsByEntity as any[],
    };
  }

  /**
   * Удалить старые записи (для очистки)
   */
  static async deleteOlderThan(days: number): Promise<number> {
    const [result] = await pool.execute<ResultSetHeader>(
      `DELETE FROM audit_logs 
       WHERE created_at < DATE_SUB(NOW(), INTERVAL ? DAY)`,
      [days]
    );

    return result.affectedRows;
  }
}
