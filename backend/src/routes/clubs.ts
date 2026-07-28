import { Router } from "express";
import { ClubController } from "../controllers/ClubController";

const router = Router();

// GET /api/clubs — список клубов (публичный)
router.get("/", ClubController.listPublic);

// GET /api/clubs/:id — карточка клуба (публичный)
router.get("/:id", ClubController.getPublic);

export default router;
