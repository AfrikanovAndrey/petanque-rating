import { Router } from "express";
import { TeamController } from "../controllers/TeamController";
import { authenticateAdmin } from "../middleware/auth";

const router = Router();

// Публичные маршруты
router.get("/", TeamController.getAllTeams);
router.get("/ratings", TeamController.getTeamRatings);
router.get("/:id", TeamController.getTeamById);
router.get("/tournament/:tournamentId", TeamController.getTeamsByTournament);

// Защищенные маршруты (требуют аутентификации)
router.post("/", authenticateAdmin, TeamController.createTeam);
router.put("/:id", authenticateAdmin, TeamController.updateTeam);
router.delete("/:id", authenticateAdmin, TeamController.deleteTeam);
router.delete("/", authenticateAdmin, TeamController.deleteAllTeams);
router.post(
  "/upload",
  authenticateAdmin,
  TeamController.uploadTournamentTeamData
);

export default router;
