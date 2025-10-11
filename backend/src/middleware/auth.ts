import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { UserRole } from "../types";

export interface AuthRequest extends Request {
  userId?: number;
  username?: string;
  userRole?: UserRole;
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
    };

    req.userId = decoded.userId;
    req.username = decoded.username;
    req.userRole = decoded.role;

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

    if (!allowedRoles.includes(req.userRole)) {
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
