import { Router } from "express";
import { authenticateAdmin } from "../middleware/auth";

const router = Router();

// === ОЧКИ ИГРОКОВ ЗА ТУРНИРЫ — УСТАРЕЛО (таблица удалена) ===
// Все данные теперь берутся из tournament_results.points

const gone = (_req: any, res: any) => {
  res.status(410).json({
    success: false,
    message: "Эндпоинт устарел: используйте данные из tournament_results",
  });
};

router.get("/player/:playerId", authenticateAdmin, gone);
router.get("/tournament/:tournamentId", authenticateAdmin, gone);
router.post("/", authenticateAdmin, gone);
router.put("/:id", authenticateAdmin, gone);
router.delete("/:id", authenticateAdmin, gone);
router.delete("/tournament/:tournamentId", authenticateAdmin, gone);
router.post("/sync", authenticateAdmin, gone);

export default router;
