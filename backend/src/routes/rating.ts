import { Router } from "express";
import { RatingController } from "../controllers/RatingController";
import { TournamentController } from "../controllers/TournamentController";

const router = Router();

// === РЕЙТИНГ ИГРОКОВ ===
// GET /api/rating/table - получить таблицу рейтинга (публичный доступ)
router.get("/table", RatingController.getRatingTable);

// GET /api/rating/full - получить полную таблицу рейтинга с деталями (публичный доступ)
router.get("/full", RatingController.getFullRatingTable);

// GET /api/rating/male - получить мужской рейтинг (публичный доступ)
router.get("/male", RatingController.getMaleRatingTable);

// GET /api/rating/female - получить женский рейтинг (публичный доступ)
router.get("/female", RatingController.getFemaleRatingTable);

// GET /api/rating/by-gender - получить рейтинги разделенные по полу (публичный доступ)
router.get("/by-gender", RatingController.getRatingsByGender);

// GET /api/rating/player/:playerId - получить детали игрока (публичный доступ)
router.get("/player/:playerId", RatingController.getPlayerDetails);

// === ТУРНИРЫ ===
// GET /api/rating/tournaments - получить список всех турниров (публичный доступ)
router.get("/tournaments", TournamentController.getAllTournaments);

// GET /api/rating/tournaments/:id - получить турнир с результатами (публичный доступ)
router.get("/tournaments/:id", TournamentController.getTournamentDetails);

// GET /api/rating/tournaments/stats - получить статистику турниров (публичный доступ)
router.get("/tournaments/stats", TournamentController.getTournamentsStats);

// === КУБКИ ===
// GET /api/rating/cups - получить все результаты кубков (публичный доступ)
router.get("/cups", TournamentController.getAllCupResults);

// GET /api/rating/tournaments/:id/cups - получить результаты кубков для турнира (публичный доступ)
router.get(
  "/tournaments/:id/cups",
  TournamentController.getCupResultsByTournament
);

// GET /api/rating/tournaments/:id/cups/:cup - получить результаты конкретного кубка в турнире (публичный доступ)
router.get(
  "/tournaments/:id/cups/:cup",
  TournamentController.getCupResultsByCup
);

// GET /api/rating/cups/config - получить конфигурацию очков за кубки (публичный доступ)
router.get("/cups/config", TournamentController.getCupPointsConfig);

export default router;
