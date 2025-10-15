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
import { authenticateAdmin, requireAdmin } from "../middleware/auth";

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
router.post("/users", requireAdmin, UserController.createUser);

// PUT /api/admin/users/:userId - обновить пользователя
router.put("/users/:userId", requireAdmin, UserController.updateUser);

// DELETE /api/admin/users/:userId - удалить пользователя
router.delete("/users/:userId", requireAdmin, UserController.deleteUser);

// === УПРАВЛЕНИЕ ТУРНИРАМИ ===
// Доступно для ADMIN и MANAGER
// POST /api/admin/tournaments/upload - загрузка турнира из Excel
router.post(
  "/tournaments/upload",
  uploadMiddleware,
  AdminController.uploadTournament
);

// POST /api/admin/tournaments/upload-from-google-sheets - загрузка турнира из Google Sheets
router.post(
  "/tournaments/upload-from-google-sheets",
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
router.put("/tournaments/:tournamentId", AdminController.updateTournament);

// DELETE /api/admin/tournaments/:tournamentId - удалить турнир (только ADMIN)
router.delete(
  "/tournaments/:tournamentId",
  requireAdmin,
  AdminController.deleteTournament
);

// DELETE /api/admin/tournaments/results/:resultId - удалить результат (турнир/кубок) (только ADMIN)
router.delete(
  "/tournaments/results/:resultId",
  requireAdmin,
  TournamentController.deleteTournamentResult
);

// === УПРАВЛЕНИЕ ИГРОКАМИ ===
// Доступно для ADMIN и MANAGER
// GET /api/admin/players - получить всех игроков
router.get("/players", AdminController.getPlayers);

// POST /api/admin/players - создать игрока
router.post("/players", AdminController.createPlayer);

// POST /api/admin/players/upload-text - массовая загрузка игроков из текстового файла
router.post(
  "/players/upload-text",
  playersTextUploadMiddleware,
  AdminController.uploadPlayersFromText
);

// PUT /api/admin/players/:playerId - обновить игрока
router.put("/players/:playerId", AdminController.updatePlayer);

// DELETE /api/admin/players/:playerId - удалить игрока (только ADMIN)
router.delete("/players/:playerId", requireAdmin, AdminController.deletePlayer);

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
router.post("/licensed-players", AdminController.createLicensedPlayer);

// PUT /api/admin/licensed-players/:playerId - обновить лицензионного игрока
router.put("/licensed-players/:playerId", AdminController.updateLicensedPlayer);

// DELETE /api/admin/licensed-players/:playerId - удалить лицензионного игрока (только ADMIN)
router.delete(
  "/licensed-players/:playerId",
  requireAdmin,
  AdminController.deleteLicensedPlayer
);

// POST /api/admin/licensed-players/upload - загрузка списка из Excel файла
router.post(
  "/licensed-players/upload",
  licensedPlayersUploadMiddleware,
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

export default router;
