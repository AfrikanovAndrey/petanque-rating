import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";

export interface AuthRequest extends Request {
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
      adminId: number;
      username: string;
    };

    req.adminId = decoded.adminId;
    req.adminUsername = decoded.username;
    next();
  } catch (error) {
    return res.status(401).json({
      success: false,
      message: "Недействительный токен",
    });
  }
};
