import { Router } from "express";
import { PlayerTournamentPointsController } from "../controllers/PlayerTournamentPointsController";
import { authenticateAdmin } from "../middleware/auth";

const router = Router();

// === ОЧКИ ИГРОКОВ ЗА ТУРНИРЫ (требует авторизации) ===

// GET /api/player-points/player/:playerId - получить все очки игрока
router.get(
  "/player/:playerId",
  authenticateAdmin,
  PlayerTournamentPointsController.getPlayerPoints
);

// GET /api/player-points/tournament/:tournamentId - получить очки всех игроков за турнир
router.get(
  "/tournament/:tournamentId",
  authenticateAdmin,
  PlayerTournamentPointsController.getTournamentPoints
);

// POST /api/player-points - создать очки игрока за турнир
router.post(
  "/",
  authenticateAdmin,
  PlayerTournamentPointsController.createPlayerPoints
);

// PUT /api/player-points/:id - обновить очки игрока за турнир
router.put(
  "/:id",
  authenticateAdmin,
  PlayerTournamentPointsController.updatePlayerPoints
);

// DELETE /api/player-points/:id - удалить очки игрока за турнир
router.delete(
  "/:id",
  authenticateAdmin,
  PlayerTournamentPointsController.deletePlayerPoints
);

// DELETE /api/player-points/tournament/:tournamentId - удалить все очки за турнир
router.delete(
  "/tournament/:tournamentId",
  authenticateAdmin,
  PlayerTournamentPointsController.deleteTournamentPoints
);

// POST /api/player-points/sync - синхронизировать очки из tournament_results
router.post(
  "/sync",
  authenticateAdmin,
  PlayerTournamentPointsController.syncFromTournamentResults
);

export default router;
