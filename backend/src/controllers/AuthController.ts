import { Request, Response } from "express";
import jwt from "jsonwebtoken";
import { AuthModel } from "../models/AuthModel";
import { AuthRequest, AuthResponse } from "../types";

export class AuthController {
  static async login(req: Request, res: Response): Promise<void> {
    try {
      const { username, password }: AuthRequest = req.body;

      if (!username || !password) {
        res.status(400).json({
          success: false,
          message: "Имя пользователя и пароль обязательны",
        });
        return;
      }

      // Проверяем пользователя
      const admin = await AuthModel.getAdminByUsername(username);
      if (!admin) {
        res.status(401).json({
          success: false,
          message: "Неверные учетные данные",
        });
        return;
      }

      // Проверяем пароль
      const isPasswordValid = await AuthModel.verifyPassword(
        password,
        admin.password_hash
      );

      if (!isPasswordValid) {
        res.status(401).json({
          success: false,
          message: "Неверные учетные данные",
        });
        return;
      }

      // Создаем JWT токен
      const jwtSecret = process.env.JWT_SECRET || "your-super-secret-jwt-key";
      const token = jwt.sign(
        {
          adminId: admin.id,
          username: admin.username,
        },
        jwtSecret,
        {
          expiresIn: "7d", // Токен действует 7 дней
        }
      );

      const response: AuthResponse = {
        success: true,
        token,
        message: "Успешная авторизация",
      };

      res.json(response);
    } catch (error) {
      console.error("Ошибка авторизации:", error);
      res.status(500).json({
        success: false,
        message: "Внутренняя ошибка сервера",
      });
    }
  }

  static async verifyToken(req: Request, res: Response): Promise<void> {
    try {
      const token = req.header("Authorization")?.replace("Bearer ", "");

      if (!token) {
        res.status(401).json({
          success: false,
          message: "Токен не предоставлен",
        });
        return;
      }

      const jwtSecret = process.env.JWT_SECRET || "your-super-secret-jwt-key";
      const decoded = jwt.verify(token, jwtSecret) as {
        adminId: number;
        username: string;
      };

      res.json({
        success: true,
        admin: {
          id: decoded.adminId,
          username: decoded.username,
        },
      });
    } catch (error) {
      res.status(401).json({
        success: false,
        message: "Недействительный токен",
      });
    }
  }

  static async changePassword(req: Request, res: Response): Promise<void> {
    try {
      const { currentPassword, newPassword } = req.body;
      const token = req.header("Authorization")?.replace("Bearer ", "");

      if (!token) {
        res.status(401).json({
          success: false,
          message: "Токен не предоставлен",
        });
        return;
      }

      const jwtSecret = process.env.JWT_SECRET || "your-super-secret-jwt-key";
      const decoded = jwt.verify(token, jwtSecret) as {
        adminId: number;
        username: string;
      };

      // Проверяем текущий пароль
      const admin = await AuthModel.getAdminByUsername(decoded.username);
      if (!admin) {
        res.status(404).json({
          success: false,
          message: "Администратор не найден",
        });
        return;
      }

      const isCurrentPasswordValid = await AuthModel.verifyPassword(
        currentPassword,
        admin.password_hash
      );

      if (!isCurrentPasswordValid) {
        res.status(401).json({
          success: false,
          message: "Неверный текущий пароль",
        });
        return;
      }

      // Обновляем пароль
      const success = await AuthModel.updateAdminPassword(
        decoded.username,
        newPassword
      );

      if (success) {
        res.json({
          success: true,
          message: "Пароль успешно изменен",
        });
      } else {
        res.status(500).json({
          success: false,
          message: "Ошибка при изменении пароля",
        });
      }
    } catch (error) {
      console.error("Ошибка при изменении пароля:", error);
      res.status(500).json({
        success: false,
        message: "Внутренняя ошибка сервера",
      });
    }
  }
}
