import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { UserRole } from "../types";

export interface AuthRequest extends Request {
  userId?: number;
  username?: string;
  userRole?: UserRole;
  userRoles?: UserRole[];
  // Для обратной совместимости
  adminId?: number;
  adminUsername?: string;
}

export const authenticateAdmin = (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  const token = req.header("Authorization")?.replace("Bearer ", "");

  if (!token) {
    return res.status(401).json({
      success: false,
      message: "Токен доступа не предоставлен",
    });
  }

  try {
    const jwtSecret = process.env.JWT_SECRET || "your-super-secret-jwt-key";
    const decoded = jwt.verify(token, jwtSecret) as {
      userId: number;
      username: string;
      role: UserRole;
      roles?: UserRole[];
    };

    req.userId = decoded.userId;
    req.username = decoded.username;
    const roles = decoded.roles && decoded.roles.length > 0
      ? decoded.roles
      : [decoded.role];
    req.userRoles = [...new Set(roles)];
    req.userRole = req.userRoles[0] || decoded.role;

    // Для обратной совместимости
    req.adminId = decoded.userId;
    req.adminUsername = decoded.username;

    next();
  } catch (error) {
    return res.status(401).json({
      success: false,
      message: "Недействительный токен",
    });
  }
};

/**
 * Middleware для проверки роли пользователя
 * @param allowedRoles - массив разрешенных ролей
 */
export const requireRole = (allowedRoles: UserRole[]) => {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.userRole) {
      return res.status(401).json({
        success: false,
        message: "Пользователь не авторизован",
      });
    }

    const userRoles = req.userRoles && req.userRoles.length > 0
      ? req.userRoles
      : req.userRole
        ? [req.userRole]
        : [];
    const hasRole = allowedRoles.some((role) => userRoles.includes(role));
    if (!hasRole) {
      return res.status(403).json({
        success: false,
        message: "Недостаточно прав для выполнения этой операции",
      });
    }

    next();
  };
};

/**
 * Middleware только для ADMIN
 */
export const requireAdmin = requireRole([UserRole.ADMIN]);

/** Турниры: только ADMIN и MANAGER */
export const requireTournamentStaff = requireRole([
  UserRole.ADMIN,
  UserRole.MANAGER,
]);

/** Просмотр списка турниров и карточки турнира: организаторы и член президиума */
export const requireTournamentViewer = requireRole([
  UserRole.ADMIN,
  UserRole.MANAGER,
  UserRole.PRESIDIUM_MEMBER,
]);

/** Признание результатов турнира */
export const requirePresidiumOrAdmin = requireRole([
  UserRole.ADMIN,
  UserRole.PRESIDIUM_MEMBER,
]);

/** Игроки рейтинга (справочник): ADMIN, MANAGER и менеджер лицензий */
export const requirePlayersSectionAccess = requireRole([
  UserRole.ADMIN,
  UserRole.MANAGER,
  UserRole.LICENSE_MANAGER,
]);

/** Раздел лицензионных игроков (API чтения и записи): только ADMIN и LICENSE_MANAGER */
export const requireLicensedPlayersEditor = requireRole([
  UserRole.ADMIN,
  UserRole.LICENSE_MANAGER,
]);
