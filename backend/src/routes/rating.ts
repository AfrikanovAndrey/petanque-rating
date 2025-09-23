import { Router } from "express";
import { RatingController } from "../controllers/RatingController";
import { TournamentController } from "../controllers/TournamentController";

const router = Router();

// === РЕЙТИНГ ИГРОКОВ ===
// GET /api/rating/table - получить таблицу рейтинга (публичный доступ)
router.get("/table", RatingController.getRatingTable);

// GET /api/rating/full - получить полную таблицу рейтинга с деталями (публичный доступ)
router.get("/full", RatingController.getFullRatingTable);

// GET /api/rating/player/:playerId - получить детали игрока (публичный доступ)
router.get("/player/:playerId", RatingController.getPlayerDetails);

// === ТУРНИРЫ ===
// GET /api/rating/tournaments - получить список всех турниров (публичный доступ)
router.get("/tournaments", TournamentController.getAllTournaments);

// GET /api/rating/tournaments/:id - получить турнир с результатами (публичный доступ)
router.get("/tournaments/:id", TournamentController.getTournamentDetails);

// GET /api/rating/tournaments/stats - получить статистику турниров (публичный доступ)
router.get("/tournaments/stats", TournamentController.getTournamentsStats);

export default router;
