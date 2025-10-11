import { Request, Response } from "express";
import jwt from "jsonwebtoken";
import { AuthModel } from "../models/AuthModel";
import { UserModel } from "../models/UserModel";
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

      // Проверяем пользователя в новой таблице users
      let user = await UserModel.getUserByUsername(username);

      // Для обратной совместимости проверяем старую таблицу admins
      if (!user) {
        const admin = await AuthModel.getAdminByUsername(username);
        if (admin) {
          res.status(401).json({
            success: false,
            message:
              "Используйте новую систему аутентификации. Свяжитесь с администратором.",
          });
          return;
        }
      }

      if (!user) {
        res.status(401).json({
          success: false,
          message: "Неверные учетные данные",
        });
        return;
      }

      // Проверяем пароль
      const isPasswordValid = await UserModel.verifyPassword(
        password,
        user.password_hash
      );

      if (!isPasswordValid) {
        res.status(401).json({
          success: false,
          message: "Неверные учетные данные",
        });
        return;
      }

      // Создаем JWT токен с новыми полями
      const jwtSecret = process.env.JWT_SECRET || "your-super-secret-jwt-key";
      const token = jwt.sign(
        {
          userId: user.id,
          username: user.username,
          role: user.role,
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
        user: {
          id: user.id,
          name: user.name,
          username: user.username,
          role: user.role,
        },
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
        userId: number;
        username: string;
        role: string;
      };

      // Получаем актуальные данные пользователя из БД
      const user = await UserModel.getUserById(decoded.userId);
      if (!user) {
        res.status(401).json({
          success: false,
          message: "Пользователь не найден",
        });
        return;
      }

      res.json({
        success: true,
        user: {
          id: user.id,
          name: user.name,
          username: user.username,
          role: user.role,
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
        userId: number;
        username: string;
        role: string;
      };

      // Проверяем текущий пароль
      const user = await UserModel.getUserById(decoded.userId);
      if (!user) {
        res.status(404).json({
          success: false,
          message: "Пользователь не найден",
        });
        return;
      }

      const isCurrentPasswordValid = await UserModel.verifyPassword(
        currentPassword,
        user.password_hash
      );

      if (!isCurrentPasswordValid) {
        res.status(401).json({
          success: false,
          message: "Неверный текущий пароль",
        });
        return;
      }

      // Проверка длины нового пароля
      if (newPassword.length < 6) {
        res.status(400).json({
          success: false,
          message: "Пароль должен содержать минимум 6 символов",
        });
        return;
      }

      // Обновляем пароль
      const success = await UserModel.updateUserPassword(
        decoded.userId,
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
