import { Response } from "express";
import fs from "fs";
import path from "path";
import multer from "multer";
import { AuthRequest } from "../middleware/auth";
import { ClubModel } from "../models/ClubModel";
import { UserModel } from "../models/UserModel";
import {
  CreateClubRequest,
  UpdateClubRequest,
  UserRole,
} from "../types";

const UPLOADS_ROOT = path.join(process.cwd(), "uploads", "clubs");

function ensureUploadsDir(): void {
  if (!fs.existsSync(UPLOADS_ROOT)) {
    fs.mkdirSync(UPLOADS_ROOT, { recursive: true });
  }
}

const logoStorage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    ensureUploadsDir();
    cb(null, UPLOADS_ROOT);
  },
  filename: (req, file, cb) => {
    const clubId = req.params.id || "new";
    const ext = path.extname(file.originalname).toLowerCase() || ".png";
    cb(null, `${clubId}-${Date.now()}${ext}`);
  },
});

export const clubLogoUploadMiddleware = multer({
  storage: logoStorage,
  limits: { fileSize: 2 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowed = ["image/png", "image/jpeg", "image/webp", "image/gif"];
    if (!allowed.includes(file.mimetype)) {
      cb(new Error("Допустимы только изображения PNG, JPEG, WEBP или GIF"));
      return;
    }
    cb(null, true);
  },
}).single("logo");

function userRoles(req: AuthRequest): UserRole[] {
  if (req.userRoles && req.userRoles.length > 0) return req.userRoles;
  return req.userRole ? [req.userRole] : [];
}

function isClubAdmin(req: AuthRequest): boolean {
  const roles = userRoles(req);
  return (
    roles.includes(UserRole.ADMIN) ||
    roles.includes(UserRole.PRESIDIUM_MEMBER)
  );
}

function statusFromError(error: unknown): number {
  if (
    error &&
    typeof error === "object" &&
    "statusCode" in error &&
    typeof (error as { statusCode: unknown }).statusCode === "number"
  ) {
    return (error as { statusCode: number }).statusCode;
  }
  return 500;
}

function removeLogoFile(logoPath: string | null | undefined): void {
  if (!logoPath) return;
  const absolute = path.join(process.cwd(), logoPath.replace(/^\//, ""));
  if (fs.existsSync(absolute)) {
    try {
      fs.unlinkSync(absolute);
    } catch (e) {
      console.error("Не удалось удалить файл логотипа:", e);
    }
  }
}

export class ClubController {
  /** GET /api/admin/clubs/owner-candidates — пользователи с ролью CLUB_OWNER */
  static async listOwnerCandidates(
    _req: AuthRequest,
    res: Response
  ): Promise<void> {
    try {
      const users = await UserModel.getAllUsers();
      const candidates = users
        .filter((u) => {
          const roles =
            u.roles && u.roles.length > 0 ? u.roles : u.role ? [u.role] : [];
          return roles.includes(UserRole.CLUB_OWNER);
        })
        .map((u) => ({
          id: u.id,
          name: u.name,
          username: u.username,
        }));
      res.json({ success: true, data: candidates });
    } catch (error) {
      console.error("Ошибка получения кандидатов во владельцы:", error);
      res.status(500).json({
        success: false,
        message: "Ошибка получения списка владельцев",
      });
    }
  }

  /** GET /api/clubs — публичный список */
  static async listPublic(_req: AuthRequest, res: Response): Promise<void> {
    try {
      const clubs = await ClubModel.getAllClubs();
      res.json({
        success: true,
        data: clubs.map((c) => ({
          id: c.id,
          name: c.name,
          logo_url: c.logo_url,
          members_count: c.members.length,
        })),
      });
    } catch (error) {
      console.error("Ошибка получения клубов:", error);
      res.status(500).json({
        success: false,
        message: "Ошибка получения клубов",
      });
    }
  }

  /** GET /api/clubs/:id — публичная карточка */
  static async getPublic(req: AuthRequest, res: Response): Promise<void> {
    try {
      const id = parseInt(req.params.id, 10);
      if (Number.isNaN(id)) {
        res.status(400).json({ success: false, message: "Неверный ID клуба" });
        return;
      }
      const club = await ClubModel.getClubById(id);
      if (!club) {
        res.status(404).json({ success: false, message: "Клуб не найден" });
        return;
      }
      res.json({
        success: true,
        data: {
          id: club.id,
          name: club.name,
          logo_url: club.logo_url,
          members: club.members.map((m) => ({
            player_id: m.player_id,
            player_name: m.player_name,
            city: m.city ?? null,
            created_at: m.created_at,
          })),
        },
      });
    } catch (error) {
      console.error("Ошибка получения клуба:", error);
      res.status(500).json({
        success: false,
        message: "Ошибка получения клуба",
      });
    }
  }

  /** GET /api/admin/clubs — полный список; кнопки на UI зависят от владения */
  static async listAdmin(_req: AuthRequest, res: Response): Promise<void> {
    try {
      const clubs = await ClubModel.getAllClubs();
      res.json({ success: true, data: clubs });
    } catch (error) {
      console.error("Ошибка получения клубов (admin):", error);
      res.status(500).json({
        success: false,
        message: "Ошибка получения клубов",
      });
    }
  }

  /** GET /api/admin/clubs/:id */
  static async getAdmin(req: AuthRequest, res: Response): Promise<void> {
    try {
      const id = parseInt(req.params.id, 10);
      if (Number.isNaN(id)) {
        res.status(400).json({ success: false, message: "Неверный ID клуба" });
        return;
      }
      const club = await ClubModel.getClubById(id);
      if (!club) {
        res.status(404).json({ success: false, message: "Клуб не найден" });
        return;
      }
      if (!isClubAdmin(req)) {
        const owned = await ClubModel.isOwner(id, req.userId!);
        if (!owned) {
          res.status(403).json({
            success: false,
            message: "Недостаточно прав для просмотра этого клуба",
          });
          return;
        }
      }
      res.json({ success: true, data: club });
    } catch (error) {
      console.error("Ошибка получения клуба (admin):", error);
      res.status(500).json({
        success: false,
        message: "Ошибка получения клуба",
      });
    }
  }

  /** POST /api/admin/clubs */
  static async create(req: AuthRequest, res: Response): Promise<void> {
    try {
      const body = req.body as CreateClubRequest;
      if (!body?.name || typeof body.name !== "string") {
        res.status(400).json({
          success: false,
          message: "Название клуба обязательно",
        });
        return;
      }
      const club = await ClubModel.createClub({
        name: body.name,
        owner_user_ids: body.owner_user_ids ?? [],
        member_player_ids: body.member_player_ids ?? [],
      });
      res.status(201).json({
        success: true,
        message: "Клуб создан",
        data: club,
      });
    } catch (error) {
      console.error("Ошибка создания клуба:", error);
      const status = statusFromError(error);
      res.status(status).json({
        success: false,
        message:
          error instanceof Error ? error.message : "Ошибка создания клуба",
      });
    }
  }

  /** PUT /api/admin/clubs/:id */
  static async update(req: AuthRequest, res: Response): Promise<void> {
    try {
      const id = parseInt(req.params.id, 10);
      if (Number.isNaN(id)) {
        res.status(400).json({ success: false, message: "Неверный ID клуба" });
        return;
      }

      const admin = isClubAdmin(req);
      if (!admin) {
        const owned = await ClubModel.isOwner(id, req.userId!);
        if (!owned) {
          res.status(403).json({
            success: false,
            message: "Недостаточно прав для редактирования этого клуба",
          });
          return;
        }
      }

      const body = req.body as UpdateClubRequest;
      if (!admin && body.owner_user_ids !== undefined) {
        res.status(403).json({
          success: false,
          message: "Владелец клуба не может менять список владельцев",
        });
        return;
      }

      const club = await ClubModel.updateClub(
        id,
        {
          name: body.name,
          owner_user_ids: admin ? body.owner_user_ids : undefined,
          member_player_ids: body.member_player_ids,
        },
        { allowOwnersUpdate: admin }
      );

      if (!club) {
        res.status(404).json({ success: false, message: "Клуб не найден" });
        return;
      }

      res.json({
        success: true,
        message: "Клуб обновлён",
        data: club,
      });
    } catch (error) {
      console.error("Ошибка обновления клуба:", error);
      const status = statusFromError(error);
      res.status(status).json({
        success: false,
        message:
          error instanceof Error ? error.message : "Ошибка обновления клуба",
      });
    }
  }

  /** POST /api/admin/clubs/:id/logo */
  static async uploadLogo(req: AuthRequest, res: Response): Promise<void> {
    try {
      const id = parseInt(req.params.id, 10);
      if (Number.isNaN(id)) {
        res.status(400).json({ success: false, message: "Неверный ID клуба" });
        return;
      }

      const admin = isClubAdmin(req);
      if (!admin) {
        const owned = await ClubModel.isOwner(id, req.userId!);
        if (!owned) {
          res.status(403).json({
            success: false,
            message: "Недостаточно прав для изменения логотипа этого клуба",
          });
          return;
        }
      }

      if (!req.file) {
        res.status(400).json({
          success: false,
          message: "Файл логотипа не загружен",
        });
        return;
      }

      const existing = await ClubModel.getClubById(id);
      if (!existing) {
        removeLogoFile(path.join("uploads", "clubs", req.file.filename));
        res.status(404).json({ success: false, message: "Клуб не найден" });
        return;
      }

      const relativePath = `/uploads/clubs/${req.file.filename}`;
      removeLogoFile(existing.logo_path);
      await ClubModel.updateLogoPath(id, relativePath);
      const club = await ClubModel.getClubById(id);

      res.json({
        success: true,
        message: "Логотип обновлён",
        data: club,
      });
    } catch (error) {
      console.error("Ошибка загрузки логотипа:", error);
      res.status(500).json({
        success: false,
        message:
          error instanceof Error ? error.message : "Ошибка загрузки логотипа",
      });
    }
  }

  /** DELETE /api/admin/clubs/:id */
  static async remove(req: AuthRequest, res: Response): Promise<void> {
    try {
      const id = parseInt(req.params.id, 10);
      if (Number.isNaN(id)) {
        res.status(400).json({ success: false, message: "Неверный ID клуба" });
        return;
      }

      const existing = await ClubModel.getClubById(id);
      if (!existing) {
        res.status(404).json({ success: false, message: "Клуб не найден" });
        return;
      }

      const success = await ClubModel.deleteClub(id);
      if (success) {
        removeLogoFile(existing.logo_path);
        res.json({
          success: true,
          message: "Клуб удалён",
        });
      } else {
        res.status(404).json({ success: false, message: "Клуб не найден" });
      }
    } catch (error) {
      console.error("Ошибка удаления клуба:", error);
      res.status(500).json({
        success: false,
        message: "Ошибка удаления клуба",
      });
    }
  }
}
