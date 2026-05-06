import { Response } from "express";
import { UserModel } from "../models/UserModel";
import { AuthRequest } from "../middleware/auth";
import { CreateUserRequest, UpdateUserRequest, UserRole } from "../types";

export class UserController {
  private static readonly ALLOWED_ROLES: UserRole[] = [
    UserRole.ADMIN,
    UserRole.MANAGER,
    UserRole.LICENSE_MANAGER,
    UserRole.PRESIDIUM_MEMBER,
  ];

  private static resolveRoles(input: {
    role?: UserRole;
    roles?: UserRole[];
  }): UserRole[] {
    const source =
      input.roles && input.roles.length > 0
        ? input.roles
        : input.role
          ? [input.role]
          : [];
    return [...new Set(source)];
  }

  private static isValidRoles(roles: UserRole[]): boolean {
    return (
      roles.length > 0 &&
      roles.every((role) => UserController.ALLOWED_ROLES.includes(role))
    );
  }

  /**
   * Получить всех пользователей (только для ADMIN)
   */
  static async getAllUsers(req: AuthRequest, res: Response): Promise<void> {
    try {
      const users = await UserModel.getAllUsers();
      console.log(`getAllUsers - возвращаем ${users.length} пользователей`);
      res.json({
        success: true,
        users, // Важно: используем "users", а не "data"
      });
    } catch (error) {
      console.error("Ошибка получения пользователей:", error);
      res.status(500).json({
        success: false,
        message: "Внутренняя ошибка сервера",
      });
    }
  }

  /**
   * Получить текущего пользователя
   */
  static async getCurrentUser(req: AuthRequest, res: Response): Promise<void> {
    try {
      if (!req.userId) {
        res.status(401).json({
          success: false,
          message: "Пользователь не авторизован",
        });
        return;
      }

      const user = await UserModel.getUserById(req.userId);
      if (!user) {
        res.status(404).json({
          success: false,
          message: "Пользователь не найден",
        });
        return;
      }

      // Убираем password_hash из ответа
      const { password_hash, ...userWithoutPassword } = user;

      console.log(
        "getCurrentUser - возвращаем пользователя:",
        userWithoutPassword
      );

      res.json({
        success: true,
        data: userWithoutPassword, // Важно: используем "data", а не "user"
      });
    } catch (error) {
      console.error("Ошибка получения пользователя:", error);
      res.status(500).json({
        success: false,
        message: "Внутренняя ошибка сервера",
      });
    }
  }

  /**
   * Создать нового пользователя (только для ADMIN)
   */
  static async createUser(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { name, username, password, role, roles }: CreateUserRequest =
        req.body;
      const resolvedRoles = UserController.resolveRoles({ role, roles });

      // Валидация
      if (!name || !username || !password || resolvedRoles.length === 0) {
        res.status(400).json({
          success: false,
          message: "Все поля обязательны для заполнения",
        });
        return;
      }

      if (!UserController.isValidRoles(resolvedRoles)) {
        res.status(400).json({
          success: false,
          message: "Недопустимая роль (или набор ролей)",
        });
        return;
      }

      // Проверка длины пароля
      if (password.length < 6) {
        res.status(400).json({
          success: false,
          message: "Пароль должен содержать минимум 6 символов",
        });
        return;
      }

      // Проверка уникальности username
      const existingUser = await UserModel.getUserByUsername(username);
      if (existingUser) {
        res.status(409).json({
          success: false,
          message: "Пользователь с таким логином уже существует",
        });
        return;
      }

      const userId = await UserModel.createUser({
        name,
        username,
        password,
        role: resolvedRoles[0],
        roles: resolvedRoles,
      });
      res.status(201).json({
        success: true,
        message: "Пользователь успешно создан",
        userId,
      });
    } catch (error) {
      console.error("Ошибка создания пользователя:", error);
      res.status(500).json({
        success: false,
        message: "Внутренняя ошибка сервера",
      });
    }
  }

  /**
   * Обновить пользователя (только для ADMIN)
   */
  static async updateUser(req: AuthRequest, res: Response): Promise<void> {
    try {
      const userId = parseInt(req.params.userId);
      if (isNaN(userId)) {
        res.status(400).json({
          success: false,
          message: "Неверный ID пользователя",
        });
        return;
      }

      const data: UpdateUserRequest = req.body;
      const hasRoles = data.roles !== undefined || data.role !== undefined;
      const resolvedRoles = hasRoles
        ? UserController.resolveRoles({ role: data.role, roles: data.roles })
        : undefined;

      if (
        resolvedRoles !== undefined &&
        !UserController.isValidRoles(resolvedRoles)
      ) {
        res.status(400).json({
          success: false,
          message: "Недопустимая роль (или набор ролей)",
        });
        return;
      }

      const existingUser = await UserModel.getUserById(userId);
      if (!existingUser) {
        res.status(404).json({
          success: false,
          message: "Пользователь не найден",
        });
        return;
      }

      // Проверка длины пароля, если он указан
      if (data.password && data.password.length < 6) {
        res.status(400).json({
          success: false,
          message: "Пароль должен содержать минимум 6 символов",
        });
        return;
      }

      // Проверка уникальности username, если он изменяется
      if (data.username) {
        const duplicateLogin = await UserModel.getUserByUsername(data.username);
        if (duplicateLogin && duplicateLogin.id !== userId) {
          res.status(409).json({
            success: false,
            message: "Пользователь с таким логином уже существует",
          });
          return;
        }
      }

      const success = await UserModel.updateUser(userId, {
        ...data,
        role: resolvedRoles?.[0] ?? data.role,
        roles: resolvedRoles ?? data.roles,
      });
      if (success) {
        res.json({
          success: true,
          message: "Пользователь успешно обновлен",
        });
      } else {
        res.status(404).json({
          success: false,
          message: "Пользователь не найден",
        });
      }
    } catch (error) {
      console.error("Ошибка обновления пользователя:", error);
      res.status(500).json({
        success: false,
        message: "Внутренняя ошибка сервера",
      });
    }
  }

  /**
   * Удалить пользователя (только для ADMIN)
   */
  static async deleteUser(req: AuthRequest, res: Response): Promise<void> {
    try {
      const userId = parseInt(req.params.userId);
      if (isNaN(userId)) {
        res.status(400).json({
          success: false,
          message: "Неверный ID пользователя",
        });
        return;
      }

      // Запрещаем удалять самого себя
      if (req.userId === userId) {
        res.status(403).json({
          success: false,
          message: "Нельзя удалить свой собственный аккаунт",
        });
        return;
      }

      const success = await UserModel.deleteUser(userId);
      if (success) {
        res.json({
          success: true,
          message: "Пользователь успешно удален",
        });
      } else {
        res.status(404).json({
          success: false,
          message: "Пользователь не найден",
        });
      }
    } catch (error) {
      console.error("Ошибка удаления пользователя:", error);
      res.status(500).json({
        success: false,
        message: "Внутренняя ошибка сервера",
      });
    }
  }
}
