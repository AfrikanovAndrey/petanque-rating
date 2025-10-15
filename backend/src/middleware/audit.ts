import { Request, Response, NextFunction } from "express";
import { AuthRequest } from "./auth";
import { AuditLogModel, CreateAuditLogData } from "../models/AuditLogModel";

/**
 * Middleware для автоматического логирования действий авторизованных пользователей
 * Для DELETE операций используйте auditLogDelete, чтобы получить данные ДО удаления
 */
export const auditLog = (options: {
  action: string;
  entityType?: string;
  getEntityId?: (req: AuthRequest) => number | null;
  getEntityName?: (req: AuthRequest) => string | null;
  getDescription?: (req: AuthRequest) => string | null;
  skipRequestBody?: boolean;
}) => {
  return async (req: AuthRequest, res: Response, next: NextFunction) => {
    // Проверяем, что пользователь авторизован
    if (!req.userId || !req.username || !req.userRole) {
      return next();
    }

    // Сохраняем оригинальные методы res
    const originalJson = res.json.bind(res);
    const originalSend = res.send.bind(res);

    let responseBody: any = null;
    let isSuccess = true;
    let errorMessage: string | null = null;

    // Перехватываем ответ
    res.json = function (body: any) {
      responseBody = body;
      isSuccess = res.statusCode >= 200 && res.statusCode < 400;

      if (!isSuccess && body?.message) {
        errorMessage = body.message;
      }

      return originalJson(body);
    };

    res.send = function (body: any) {
      if (!responseBody) {
        try {
          responseBody = typeof body === "string" ? JSON.parse(body) : body;
          isSuccess = res.statusCode >= 200 && res.statusCode < 400;

          if (!isSuccess && responseBody?.message) {
            errorMessage = responseBody.message;
          }
        } catch (e) {
          // Если не можем распарсить - ничего страшного
        }
      }
      return originalSend(body);
    };

    // Слушаем событие finish для логирования после отправки ответа
    res.on("finish", async () => {
      try {
        // Получаем IP адрес
        const ipAddress =
          (req.headers["x-forwarded-for"] as string)?.split(",")[0] ||
          (req.headers["x-real-ip"] as string) ||
          req.socket.remoteAddress ||
          null;

        // Получаем User Agent
        const userAgent = req.headers["user-agent"] || null;

        // Подготавливаем данные для request_body (убираем пароли)
        let requestBody = null;
        if (
          !options.skipRequestBody &&
          req.body &&
          Object.keys(req.body).length > 0
        ) {
          requestBody = { ...req.body };
          // Удаляем чувствительные данные
          if (requestBody.password) delete requestBody.password;
          if (requestBody.password_hash) delete requestBody.password_hash;
          if (requestBody.oldPassword) delete requestBody.oldPassword;
          if (requestBody.newPassword) delete requestBody.newPassword;
        }

        // Получаем ID и имя сущности
        const entityId = options.getEntityId ? options.getEntityId(req) : null;
        let entityName = options.getEntityName
          ? options.getEntityName(req)
          : null;

        // Если имя не передано, но есть ID и тип сущности - пытаемся получить из БД
        if (!entityName && entityId && options.entityType) {
          entityName = await getEntityNameFromDB(options.entityType, entityId);
        }

        const description = options.getDescription
          ? options.getDescription(req)
          : null;

        // Создаем запись в логе
        const auditData: CreateAuditLogData = {
          user_id: req.userId,
          username: req.username,
          user_role: req.userRole,
          action: options.action,
          entity_type: options.entityType || null,
          entity_id: entityId,
          entity_name: entityName,
          description: description,
          ip_address: ipAddress,
          user_agent: userAgent,
          request_method: req.method,
          request_url: req.originalUrl,
          request_body: requestBody,
          success: isSuccess,
          error_message: errorMessage,
        };

        await AuditLogModel.create(auditData);
      } catch (error) {
        // Не прерываем основной запрос, только логируем ошибку
        console.error("❌ Ошибка при создании audit log:", error);
      }
    });

    next();
  };
};

/**
 * Вспомогательная функция для логирования действий без middleware
 * Используется для логирования внутренних операций
 */
export const logAuditAction = async (
  userId: number,
  username: string,
  userRole: string,
  action: string,
  options: {
    entityType?: string;
    entityId?: number;
    entityName?: string;
    description?: string;
    success?: boolean;
    errorMessage?: string;
    changes?: any;
    ipAddress?: string;
  } = {}
): Promise<void> => {
  try {
    await AuditLogModel.create({
      user_id: userId,
      username: username,
      user_role: userRole as any,
      action: action,
      entity_type: options.entityType || null,
      entity_id: options.entityId || null,
      entity_name: options.entityName || null,
      description: options.description || null,
      ip_address: options.ipAddress || null,
      user_agent: null,
      request_method: null,
      request_url: null,
      request_body: null,
      changes: options.changes || null,
      success: options.success !== undefined ? options.success : true,
      error_message: options.errorMessage || null,
    });
  } catch (error) {
    console.error("❌ Ошибка при создании audit log:", error);
  }
};

/**
 * Специальный middleware для логирования входа в систему
 */
export const auditLogin = async (
  req: Request,
  userId: number,
  username: string,
  userRole: string,
  success: boolean,
  errorMessage?: string
): Promise<void> => {
  const ipAddress =
    (req.headers["x-forwarded-for"] as string)?.split(",")[0] ||
    (req.headers["x-real-ip"] as string) ||
    req.socket.remoteAddress ||
    null;

  const userAgent = req.headers["user-agent"] || null;

  await AuditLogModel.create({
    user_id: userId,
    username: username,
    user_role: userRole as any,
    action: "LOGIN",
    description: success
      ? "Успешный вход в систему"
      : "Неудачная попытка входа",
    ip_address: ipAddress,
    user_agent: userAgent,
    request_method: req.method,
    request_url: req.originalUrl,
    success: success,
    error_message: errorMessage || null,
  });
};

/**
 * Вспомогательная функция для получения имени сущности из БД
 */
export const getEntityNameFromDB = async (
  entityType: string,
  entityId: number
): Promise<string | null> => {
  try {
    const { pool } = await import("../config/database");

    let query = "";
    let nameField = "name";

    switch (entityType) {
      case "player":
      case "licensed_player":
        query = "SELECT name FROM players WHERE id = ?";
        break;
      case "tournament":
        query = "SELECT name FROM tournaments WHERE id = ?";
        break;
      case "user":
        query = "SELECT name FROM users WHERE id = ?";
        break;
      case "team":
        query = "SELECT id FROM teams WHERE id = ?";
        nameField = "id";
        break;
      default:
        return null;
    }

    const [rows]: any = await pool.execute(query, [entityId]);

    if (rows.length > 0) {
      return nameField === "id" ? `Команда #${rows[0].id}` : rows[0][nameField];
    }

    return null;
  } catch (error) {
    console.error("Ошибка получения имени сущности:", error);
    return null;
  }
};

/**
 * Middleware для логирования изменений с отслеживанием старых и новых значений
 */
export const auditChanges = (options: {
  action: string;
  entityType: string;
  getEntityId: (req: AuthRequest) => number | null;
  getEntityName?: (req: AuthRequest) => string | null;
  getOldValue?: (req: AuthRequest) => Promise<any>;
  getNewValue?: (req: AuthRequest) => any;
}) => {
  return async (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.userId || !req.username || !req.userRole) {
      return next();
    }

    // Получаем старое значение до выполнения операции
    let oldValue: any = null;
    if (options.getOldValue) {
      try {
        oldValue = await options.getOldValue(req);
      } catch (error) {
        console.error("Ошибка при получении старого значения:", error);
      }
    }

    // Сохраняем оригинальные методы res
    const originalJson = res.json.bind(res);

    res.json = function (body: any) {
      // Логируем после успешного выполнения
      if (res.statusCode >= 200 && res.statusCode < 400) {
        setImmediate(async () => {
          try {
            const entityId = options.getEntityId(req);
            const entityName = options.getEntityName
              ? options.getEntityName(req)
              : null;
            const newValue = options.getNewValue
              ? options.getNewValue(req)
              : req.body;

            const changes = {
              old: oldValue,
              new: newValue,
            };

            const ipAddress =
              (req.headers["x-forwarded-for"] as string)?.split(",")[0] ||
              (req.headers["x-real-ip"] as string) ||
              req.socket.remoteAddress ||
              null;

            await AuditLogModel.create({
              user_id: req.userId!,
              username: req.username!,
              user_role: req.userRole!,
              action: options.action,
              entity_type: options.entityType,
              entity_id: entityId,
              entity_name: entityName,
              changes: changes,
              ip_address: ipAddress,
              user_agent: req.headers["user-agent"] || null,
              request_method: req.method,
              request_url: req.originalUrl,
              success: true,
            });
          } catch (error) {
            console.error(
              "❌ Ошибка при создании audit log с изменениями:",
              error
            );
          }
        });
      }

      return originalJson(body);
    };

    next();
  };
};

/**
 * Middleware для логирования DELETE операций
 * Получает данные сущности ДО её удаления
 */
export const auditLogDelete = (options: {
  action: string;
  entityType: string;
  getEntityId: (req: AuthRequest) => number | null;
  getDescription?: (req: AuthRequest, entityName?: string) => string | null;
}) => {
  return async (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.userId || !req.username || !req.userRole) {
      return next();
    }

    try {
      // Получаем ID сущности
      const entityId = options.getEntityId(req);

      if (!entityId) {
        return next();
      }

      // Получаем имя сущности ДО удаления
      const entityName = await getEntityNameFromDB(
        options.entityType,
        entityId
      );

      // Получаем IP адрес
      const ipAddress =
        (req.headers["x-forwarded-for"] as string)?.split(",")[0] ||
        (req.headers["x-real-ip"] as string) ||
        req.socket.remoteAddress ||
        null;

      // Сохраняем данные в request для использования после удаления
      (req as any).auditData = {
        entityId,
        entityName,
        ipAddress,
      };

      // Сохраняем оригинальный метод res.json
      const originalJson = res.json.bind(res);

      res.json = function (body: any) {
        const isSuccess = res.statusCode >= 200 && res.statusCode < 400;
        let errorMessage: string | null = null;

        if (!isSuccess && body?.message) {
          errorMessage = body.message;
        }

        // Логируем ПОСЛЕ выполнения операции, но с данными, полученными ДО
        setImmediate(async () => {
          try {
            const auditData = (req as any).auditData;
            const description = options.getDescription
              ? options.getDescription(req, auditData.entityName)
              : `Удаление ${options.entityType} ID ${auditData.entityId}`;

            await AuditLogModel.create({
              user_id: req.userId!,
              username: req.username!,
              user_role: req.userRole!,
              action: options.action,
              entity_type: options.entityType,
              entity_id: auditData.entityId,
              entity_name: auditData.entityName,
              description: description,
              ip_address: auditData.ipAddress,
              user_agent: req.headers["user-agent"] || null,
              request_method: req.method,
              request_url: req.originalUrl,
              success: isSuccess,
              error_message: errorMessage,
            });
          } catch (error) {
            console.error(
              "❌ Ошибка при создании audit log для DELETE:",
              error
            );
          }
        });

        return originalJson(body);
      };

      next();
    } catch (error) {
      console.error("❌ Ошибка в auditLogDelete middleware:", error);
      next();
    }
  };
};
