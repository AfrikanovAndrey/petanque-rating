import { Router } from "express";
import {
  AdminController,
  licensedPlayersUploadMiddleware,
  playersTextUploadMiddleware,
  uploadMiddleware,
} from "../controllers/AdminController";
import { SettingsController } from "../controllers/SettingsController";
import { TournamentController } from "../controllers/TournamentController";
import { UserController } from "../controllers/UserController";
import { AdminAuditController } from "../controllers/AdminAuditController";
import { authenticateAdmin, requireAdmin } from "../middleware/auth";
import { auditLog, auditLogDelete } from "../middleware/audit";

const router = Router();

// === ТЕСТИРОВАНИЕ И ДИАГНОСТИКА (БЕЗ АУТЕНТИФИКАЦИИ) ===
// GET /api/admin/test-google-sheets-api - тестирование Google Sheets API ключа
router.get(
  "/test-google-sheets-api",
  TournamentController.testGoogleSheetsApiKey
);

// Применяем middleware авторизации ко всем остальным админским роутам
router.use(authenticateAdmin);

// === УПРАВЛЕНИЕ ПОЛЬЗОВАТЕЛЯМИ (только для ADMIN) ===
// GET /api/admin/users - получить всех пользователей
router.get("/users", requireAdmin, UserController.getAllUsers);

// GET /api/admin/users/current - получить текущего пользователя
router.get("/users/current", UserController.getCurrentUser);

// POST /api/admin/users - создать пользователя
router.post(
  "/users",
  requireAdmin,
  auditLog({
    action: "CREATE_USER",
    entityType: "user",
    getEntityName: (req) => req.body.username || null,
    getDescription: (req) =>
      `Создание пользователя ${req.body.name || req.body.username}`,
  }),
  UserController.createUser
);

// PUT /api/admin/users/:userId - обновить пользователя
router.put(
  "/users/:userId",
  requireAdmin,
  auditLog({
    action: "UPDATE_USER",
    entityType: "user",
    getEntityId: (req) => parseInt(req.params.userId),
    getEntityName: (req) => req.body.username || null,
    getDescription: (req) => `Обновление пользователя ID ${req.params.userId}`,
  }),
  UserController.updateUser
);

// DELETE /api/admin/users/:userId - удалить пользователя
router.delete(
  "/users/:userId",
  requireAdmin,
  auditLogDelete({
    action: "DELETE_USER",
    entityType: "user",
    getEntityId: (req) => parseInt(req.params.userId),
    getDescription: (req, entityName) =>
      `Удаление пользователя ${entityName || "ID " + req.params.userId}`,
  }),
  UserController.deleteUser
);

// === УПРАВЛЕНИЕ ТУРНИРАМИ ===
// Доступно для ADMIN и MANAGER
// POST /api/admin/tournaments/upload - загрузка турнира из Excel
router.post(
  "/tournaments/upload",
  uploadMiddleware,
  auditLog({
    action: "UPLOAD_TOURNAMENT",
    entityType: "tournament",
    getDescription: (req) => `Загрузка турнира из файла`,
  }),
  AdminController.uploadTournament
);

// POST /api/admin/tournaments/upload-from-google-sheets - загрузка турнира из Google Sheets
router.post(
  "/tournaments/upload-from-google-sheets",
  auditLog({
    action: "UPLOAD_TOURNAMENT",
    entityType: "tournament",
    getEntityName: (req) => req.body.tournament_name || null,
    getDescription: (req) =>
      `Загрузка турнира из Google Sheets: ${req.body.tournament_name}`,
  }),
  AdminController.uploadTournamentFromGoogleSheets
);

// POST /api/admin/tournaments/check-google-sheets - проверка доступности Google таблицы
router.post(
  "/tournaments/check-google-sheets",
  TournamentController.checkGoogleSheetsAccess
);

// GET /api/admin/tournaments - получить все турниры
router.get("/tournaments", AdminController.getTournaments);

// GET /api/admin/tournaments/:tournamentId - получить турнир с результатами
router.get("/tournaments/:tournamentId", AdminController.getTournamentDetails);

// PUT /api/admin/tournaments/:tournamentId - обновить турнир (ADMIN и MANAGER)
router.put(
  "/tournaments/:tournamentId",
  auditLog({
    action: "UPDATE_TOURNAMENT",
    entityType: "tournament",
    getEntityId: (req) => parseInt(req.params.tournamentId),
    getEntityName: (req) => req.body.name || null,
    getDescription: (req) => `Обновление турнира ID ${req.params.tournamentId}`,
  }),
  AdminController.updateTournament
);

// DELETE /api/admin/tournaments/:tournamentId - удалить турнир (ADMIN и MANAGER)
router.delete(
  "/tournaments/:tournamentId",
  auditLogDelete({
    action: "DELETE_TOURNAMENT",
    entityType: "tournament",
    getEntityId: (req) => parseInt(req.params.tournamentId),
    getDescription: (req, entityName) =>
      `Удаление турнира "${entityName || "ID " + req.params.tournamentId}"`,
  }),
  AdminController.deleteTournament
);

// DELETE /api/admin/tournaments/results/:resultId - удалить результат (турнир/кубок) (только ADMIN)
router.delete(
  "/tournaments/results/:resultId",
  requireAdmin,
  auditLogDelete({
    action: "DELETE_TOURNAMENT",
    entityType: "tournament",
    getEntityId: (req) => parseInt(req.params.resultId),
    getDescription: (req, entityName) =>
      `Удаление результата турнира "${
        entityName || "ID " + req.params.resultId
      }"`,
  }),
  TournamentController.deleteTournamentResult
);

// === УПРАВЛЕНИЕ ИГРОКАМИ ===
// Доступно для ADMIN и MANAGER
// GET /api/admin/players - получить всех игроков
router.get("/players", AdminController.getPlayers);

// POST /api/admin/players - создать игрока
router.post(
  "/players",
  auditLog({
    action: "CREATE_PLAYER",
    entityType: "player",
    getEntityName: (req) => req.body.name || null,
    getDescription: (req) => `Создание игрока ${req.body.name}`,
  }),
  AdminController.createPlayer
);

// POST /api/admin/players/upload-text - массовая загрузка игроков из текстового файла
router.post(
  "/players/upload-text",
  playersTextUploadMiddleware,
  auditLog({
    action: "CREATE_PLAYER",
    entityType: "player",
    getDescription: (req) => `Массовая загрузка игроков из файла`,
  }),
  AdminController.uploadPlayersFromText
);

// PUT /api/admin/players/:playerId - обновить игрока
router.put(
  "/players/:playerId",
  auditLog({
    action: "UPDATE_PLAYER",
    entityType: "player",
    getEntityId: (req) => parseInt(req.params.playerId),
    getEntityName: (req) => req.body.name || null,
    getDescription: (req) => `Обновление игрока ID ${req.params.playerId}`,
  }),
  AdminController.updatePlayer
);

// DELETE /api/admin/players/:playerId - удалить игрока (ADMIN и MANAGER, если игрок не участвовал в турнирах)
router.delete(
  "/players/:playerId",
  auditLogDelete({
    action: "DELETE_PLAYER",
    entityType: "player",
    getEntityId: (req) => parseInt(req.params.playerId),
    getDescription: (req, entityName) =>
      `Удаление игрока ${entityName || "ID " + req.params.playerId}`,
  }),
  AdminController.deletePlayer
);

// === НАСТРОЙКИ РЕЙТИНГА (только для ADMIN) ===

// GET /api/admin/settings/best-results-count - получить количество лучших результатов
router.get(
  "/settings/best-results-count",
  requireAdmin,
  SettingsController.getBestResultsCount
);

// PUT /api/admin/settings/best-results-count - обновить количество лучших результатов
router.put(
  "/settings/best-results-count",
  requireAdmin,
  auditLog({
    action: "UPDATE_SETTINGS",
    entityType: "settings",
    getDescription: (req) =>
      `Изменение количества лучших результатов: ${req.body.count}`,
  }),
  SettingsController.setBestResultsCount
);

// GET /api/admin/settings - получить все настройки
router.get("/settings", requireAdmin, SettingsController.getAllSettings);

// === УПРАВЛЕНИЕ ЛИЦЕНЗИОННЫМИ ИГРОКАМИ ===
// Доступно для ADMIN и MANAGER
// GET /api/admin/licensed-players - получить всех лицензионных игроков
router.get("/licensed-players", AdminController.getLicensedPlayers);

// GET /api/admin/licensed-players/active - получить активных лицензионных игроков
router.get(
  "/licensed-players/active",
  AdminController.getActiveLicensedPlayers
);

// GET /api/admin/licensed-players/years - получить доступные годы
router.get("/licensed-players/years", AdminController.getLicensedPlayersYears);

// GET /api/admin/licensed-players/statistics - получить статистику
router.get(
  "/licensed-players/statistics",
  AdminController.getLicensedPlayersStatistics
);

// POST /api/admin/licensed-players - создать лицензионного игрока
router.post(
  "/licensed-players",
  auditLog({
    action: "CREATE_PLAYER",
    entityType: "licensed_player",
    getEntityName: (req) => req.body.player_name || null,
    getDescription: (req) =>
      `Создание лицензионного игрока ${req.body.player_name}`,
  }),
  AdminController.createLicensedPlayer
);

// PUT /api/admin/licensed-players/:playerId - обновить лицензионного игрока
router.put(
  "/licensed-players/:playerId",
  auditLog({
    action: "UPDATE_PLAYER",
    entityType: "licensed_player",
    getEntityId: (req) => parseInt(req.params.playerId),
    getDescription: (req) =>
      `Обновление лицензионного игрока ID ${req.params.playerId}`,
  }),
  AdminController.updateLicensedPlayer
);

// DELETE /api/admin/licensed-players/:playerId - удалить лицензионного игрока (только ADMIN)
router.delete(
  "/licensed-players/:playerId",
  requireAdmin,
  auditLogDelete({
    action: "DELETE_PLAYER",
    entityType: "licensed_player",
    getEntityId: (req) => parseInt(req.params.playerId),
    getDescription: (req, entityName) =>
      `Удаление лицензионного игрока ${
        entityName || "ID " + req.params.playerId
      }`,
  }),
  AdminController.deleteLicensedPlayer
);

// POST /api/admin/licensed-players/upload - загрузка списка из Excel файла
router.post(
  "/licensed-players/upload",
  licensedPlayersUploadMiddleware,
  auditLog({
    action: "UPLOAD_LICENSED_PLAYERS",
    entityType: "licensed_player",
    getDescription: (req) => `Загрузка лицензионных игроков из файла`,
  }),
  AdminController.uploadLicensedPlayers
);

// === ПЕРЕСЧЁТ РЕЙТИНГА ===
// POST /api/admin/tournaments/recalculate-points - пересчитать очки всех турниров (только ADMIN)
router.post(
  "/tournaments/recalculate-points",
  requireAdmin,
  AdminController.recalculateTournamentPoints
);

// POST /api/admin/tournaments/:tournamentId/recalculate-points - пересчитать очки конкретного турнира (только ADMIN)
router.post(
  "/tournaments/:tournamentId/recalculate-points",
  requireAdmin,
  async (req, res) => {
    try {
      const tournamentId = parseInt(req.params.tournamentId);
      if (isNaN(tournamentId)) {
        res.status(400).json({
          success: false,
          message: "Неверный ID турнира",
        });
        return;
      }

      const { TournamentModel } = await import("../models/TournamentModel");
      await TournamentModel.recalculateTournamentPoints(tournamentId);

      res.json({
        success: true,
        message: `Очки турнира ${tournamentId} успешно пересчитаны`,
      });
    } catch (error) {
      console.error("Ошибка пересчёта очков турнира:", error);
      res.status(500).json({
        success: false,
        message: "Ошибка пересчёта очков: " + (error as Error).message,
      });
    }
  }
);

// === ЛОГИ АУДИТА (только для ADMIN) ===
// GET /api/admin/audit-logs - получить логи аудита с фильтрацией
router.get("/audit-logs", requireAdmin, AdminAuditController.getAuditLogs);

// GET /api/admin/audit-logs/statistics - получить статистику по действиям
router.get(
  "/audit-logs/statistics",
  requireAdmin,
  AdminAuditController.getStatistics
);

// GET /api/admin/audit-logs/actions - получить список доступных действий
router.get(
  "/audit-logs/actions",
  requireAdmin,
  AdminAuditController.getAvailableActions
);

// GET /api/admin/audit-logs/entity-types - получить список типов сущностей
router.get(
  "/audit-logs/entity-types",
  requireAdmin,
  AdminAuditController.getEntityTypes
);

// GET /api/admin/audit-logs/user/:userId - получить историю действий пользователя
router.get(
  "/audit-logs/user/:userId",
  requireAdmin,
  AdminAuditController.getUserAuditHistory
);

// GET /api/admin/audit-logs/entity/:entityType/:entityId - получить историю изменений сущности
router.get(
  "/audit-logs/entity/:entityType/:entityId",
  requireAdmin,
  AdminAuditController.getEntityAuditHistory
);

// GET /api/admin/audit-logs/:id - получить конкретную запись аудита
router.get(
  "/audit-logs/:id",
  requireAdmin,
  AdminAuditController.getAuditLogById
);

// DELETE /api/admin/audit-logs/cleanup - удалить старые записи
router.delete(
  "/audit-logs/cleanup",
  requireAdmin,
  AdminAuditController.cleanup
);

export default router;
