import { Response } from "express";
import { AuthRequest } from "../middleware/auth";
import { AuditLogModel, AuditLogFilters } from "../models/AuditLogModel";

export class AdminAuditController {
  /**
   * Получить список логов аудита с фильтрацией и пагинацией
   * GET /api/admin/audit-logs
   */
  static async getAuditLogs(req: AuthRequest, res: Response) {
    try {
      const filters: AuditLogFilters = {
        user_id: req.query.user_id ? Number(req.query.user_id) : undefined,
        username:
          req.query.username && req.query.username !== ""
            ? String(req.query.username)
            : undefined,
        action:
          req.query.action && req.query.action !== ""
            ? String(req.query.action)
            : undefined,
        entity_type:
          req.query.entity_type && req.query.entity_type !== ""
            ? String(req.query.entity_type)
            : undefined,
        entity_id: req.query.entity_id
          ? Number(req.query.entity_id)
          : undefined,
        success:
          req.query.success !== undefined && req.query.success !== ""
            ? req.query.success === "true"
            : undefined,
        date_from:
          req.query.date_from && req.query.date_from !== ""
            ? String(req.query.date_from)
            : undefined,
        date_to:
          req.query.date_to && req.query.date_to !== ""
            ? String(req.query.date_to)
            : undefined,
        limit: req.query.limit ? Number(req.query.limit) : 50,
        offset: req.query.offset ? Number(req.query.offset) : 0,
      };

      const result = await AuditLogModel.findAll(filters);

      return res.json({
        success: true,
        data: result.logs,
        total: result.total,
        limit: filters.limit,
        offset: filters.offset,
      });
    } catch (error: any) {
      console.error("Ошибка при получении логов аудита:", error);
      return res.status(500).json({
        success: false,
        message: "Ошибка при получении логов аудита",
        error: error.message,
      });
    }
  }

  /**
   * Получить конкретную запись аудита по ID
   * GET /api/admin/audit-logs/:id
   */
  static async getAuditLogById(req: AuthRequest, res: Response) {
    try {
      const id = Number(req.params.id);

      if (!id || isNaN(id)) {
        return res.status(400).json({
          success: false,
          message: "Неверный ID записи",
        });
      }

      const log = await AuditLogModel.findById(id);

      if (!log) {
        return res.status(404).json({
          success: false,
          message: "Запись аудита не найдена",
        });
      }

      return res.json({
        success: true,
        data: log,
      });
    } catch (error: any) {
      console.error("Ошибка при получении записи аудита:", error);
      return res.status(500).json({
        success: false,
        message: "Ошибка при получении записи аудита",
        error: error.message,
      });
    }
  }

  /**
   * Получить историю действий пользователя
   * GET /api/admin/audit-logs/user/:userId
   */
  static async getUserAuditHistory(req: AuthRequest, res: Response) {
    try {
      const userId = Number(req.params.userId);
      const limit = req.query.limit ? Number(req.query.limit) : 50;

      if (!userId || isNaN(userId)) {
        return res.status(400).json({
          success: false,
          message: "Неверный ID пользователя",
        });
      }

      const logs = await AuditLogModel.findByUser(userId, limit);

      return res.json({
        success: true,
        data: logs,
      });
    } catch (error: any) {
      console.error("Ошибка при получении истории пользователя:", error);
      return res.status(500).json({
        success: false,
        message: "Ошибка при получении истории пользователя",
        error: error.message,
      });
    }
  }

  /**
   * Получить историю изменений сущности
   * GET /api/admin/audit-logs/entity/:entityType/:entityId
   */
  static async getEntityAuditHistory(req: AuthRequest, res: Response) {
    try {
      const entityType = req.params.entityType;
      const entityId = Number(req.params.entityId);
      const limit = req.query.limit ? Number(req.query.limit) : 50;

      if (!entityType || !entityId || isNaN(entityId)) {
        return res.status(400).json({
          success: false,
          message: "Неверные параметры сущности",
        });
      }

      const logs = await AuditLogModel.findByEntity(
        entityType,
        entityId,
        limit
      );

      return res.json({
        success: true,
        data: logs,
      });
    } catch (error: any) {
      console.error("Ошибка при получении истории сущности:", error);
      return res.status(500).json({
        success: false,
        message: "Ошибка при получении истории сущности",
        error: error.message,
      });
    }
  }

  /**
   * Получить статистику по действиям
   * GET /api/admin/audit-logs/statistics
   */
  static async getStatistics(req: AuthRequest, res: Response) {
    try {
      const dateFrom = req.query.date_from as string;
      const dateTo = req.query.date_to as string;

      const statistics = await AuditLogModel.getStatistics(dateFrom, dateTo);

      return res.json({
        success: true,
        data: statistics,
      });
    } catch (error: any) {
      console.error("Ошибка при получении статистики:", error);
      return res.status(500).json({
        success: false,
        message: "Ошибка при получении статистики",
        error: error.message,
      });
    }
  }

  /**
   * Получить список доступных действий (actions)
   * GET /api/admin/audit-logs/actions
   */
  static async getAvailableActions(req: AuthRequest, res: Response) {
    try {
      // Список основных типов действий в системе
      const actions = [
        { value: "LOGIN", label: "Вход в систему" },
        { value: "LOGOUT", label: "Выход из системы" },
        { value: "CREATE_TOURNAMENT", label: "Создание турнира" },
        { value: "UPDATE_TOURNAMENT", label: "Редактирование турнира" },
        { value: "DELETE_TOURNAMENT", label: "Удаление турнира" },
        { value: "UPLOAD_TOURNAMENT", label: "Загрузка результатов турнира" },
        { value: "CREATE_PLAYER", label: "Создание игрока" },
        { value: "UPDATE_PLAYER", label: "Редактирование игрока" },
        { value: "DELETE_PLAYER", label: "Удаление игрока" },
        { value: "MERGE_PLAYERS", label: "Слияние игроков" },
        { value: "CREATE_USER", label: "Создание пользователя" },
        { value: "UPDATE_USER", label: "Редактирование пользователя" },
        { value: "DELETE_USER", label: "Удаление пользователя" },
        { value: "UPDATE_SETTINGS", label: "Изменение настроек" },
        {
          value: "UPLOAD_LICENSED_PLAYERS",
          label: "Загрузка лицензированных игроков",
        },
        { value: "CREATE_TEAM", label: "Создание команды" },
        { value: "UPDATE_TEAM", label: "Редактирование команды" },
        { value: "DELETE_TEAM", label: "Удаление команды" },
      ];

      return res.json({
        success: true,
        data: actions,
      });
    } catch (error: any) {
      console.error("Ошибка при получении списка действий:", error);
      return res.status(500).json({
        success: false,
        message: "Ошибка при получении списка действий",
        error: error.message,
      });
    }
  }

  /**
   * Получить список типов сущностей
   * GET /api/admin/audit-logs/entity-types
   */
  static async getEntityTypes(req: AuthRequest, res: Response) {
    try {
      const entityTypes = [
        { value: "tournament", label: "Турнир" },
        { value: "player", label: "Игрок" },
        { value: "team", label: "Команда" },
        { value: "user", label: "Пользователь" },
        { value: "settings", label: "Настройки" },
        { value: "licensed_player", label: "Лицензированный игрок" },
      ];

      return res.json({
        success: true,
        data: entityTypes,
      });
    } catch (error: any) {
      console.error("Ошибка при получении типов сущностей:", error);
      return res.status(500).json({
        success: false,
        message: "Ошибка при получении типов сущностей",
        error: error.message,
      });
    }
  }

  /**
   * Удалить старые записи аудита (только для ADMIN)
   * DELETE /api/admin/audit-logs/cleanup
   */
  static async cleanup(req: AuthRequest, res: Response) {
    try {
      const days = req.body.days || 365; // По умолчанию удаляем записи старше года

      if (days < 30) {
        return res.status(400).json({
          success: false,
          message: "Нельзя удалять записи моложе 30 дней",
        });
      }

      const deletedCount = await AuditLogModel.deleteOlderThan(days);

      return res.json({
        success: true,
        message: `Удалено записей: ${deletedCount}`,
        deletedCount,
      });
    } catch (error: any) {
      console.error("Ошибка при очистке логов:", error);
      return res.status(500).json({
        success: false,
        message: "Ошибка при очистке логов",
        error: error.message,
      });
    }
  }
}
