import { Router } from "express";
import {
  AdminController,
  uploadMiddleware,
} from "../controllers/AdminController";
import { SettingsController } from "../controllers/SettingsController";
import { authenticateAdmin } from "../middleware/auth";

const router = Router();

// Применяем middleware авторизации ко всем админским роутам
router.use(authenticateAdmin);

// === УПРАВЛЕНИЕ ТУРНИРАМИ ===
// POST /api/admin/tournaments/upload - загрузка турнира из Excel
router.post(
  "/tournaments/upload",
  uploadMiddleware,
  AdminController.uploadTournament
);

// GET /api/admin/tournaments - получить все турниры
router.get("/tournaments", AdminController.getTournaments);

// GET /api/admin/tournaments/:tournamentId - получить турнир с результатами
router.get("/tournaments/:tournamentId", AdminController.getTournamentDetails);

// DELETE /api/admin/tournaments/:tournamentId - удалить турнир
router.delete("/tournaments/:tournamentId", AdminController.deleteTournament);

// === УПРАВЛЕНИЕ ИГРОКАМИ ===
// GET /api/admin/players - получить всех игроков
router.get("/players", AdminController.getPlayers);

// PUT /api/admin/players/:playerId - обновить игрока
router.put("/players/:playerId", AdminController.updatePlayer);

// DELETE /api/admin/players/:playerId - удалить игрока
router.delete("/players/:playerId", AdminController.deletePlayer);

// === НАСТРОЙКИ РЕЙТИНГА ===
// GET /api/admin/settings/position-points - получить настройки очков за позицию
router.get("/settings/position-points", SettingsController.getPositionPoints);

// PUT /api/admin/settings/position-points - обновить настройки очков за позицию
router.put(
  "/settings/position-points",
  SettingsController.updatePositionPoints
);

// POST /api/admin/settings/position-points - добавить/обновить очки для позиции
router.post("/settings/position-points", SettingsController.setPositionPoints);

// DELETE /api/admin/settings/position-points/:position - удалить настройку очков для позиции
router.delete(
  "/settings/position-points/:position",
  SettingsController.deletePositionPoints
);

// GET /api/admin/settings/best-results-count - получить количество лучших результатов
router.get(
  "/settings/best-results-count",
  SettingsController.getBestResultsCount
);

// PUT /api/admin/settings/best-results-count - обновить количество лучших результатов
router.put(
  "/settings/best-results-count",
  SettingsController.setBestResultsCount
);

// GET /api/admin/settings - получить все настройки
router.get("/settings", SettingsController.getAllSettings);

export default router;
