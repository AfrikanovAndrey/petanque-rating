import { Router } from "express";
import authRoutes from "./auth";
import ratingRoutes from "./rating";
import adminRoutes from "./admin";
import teamsRoutes from "./teams";
import playerPointsRoutes from "./player-points";

const router = Router();

// Подключаем все роуты с соответствующими префиксами
router.use("/auth", authRoutes);
router.use("/rating", ratingRoutes);
router.use("/admin", adminRoutes);
router.use("/teams", teamsRoutes);
router.use("/player-points", playerPointsRoutes);

// Базовый роут для проверки работы API
router.get("/", (req, res) => {
  res.json({
    success: true,
    message: "Petanque Rating API работает",
    version: "1.0.0",
    endpoints: {
      auth: "/api/auth/*",
      rating: "/api/rating/* (публичный доступ, включая кубки)",
      admin: "/api/admin/* (требует авторизации, включая управление кубками)",
      teams: "/api/teams/* (команды и рейтинги команд)",
      "player-points":
        "/api/player-points/* (управление очками игроков за турниры, требует авторизации)",
    },
  });
});

// Обработка неизвестных роутов
router.use("*", (req, res) => {
  res.status(404).json({
    success: false,
    message: "Эндпоинт не найден",
  });
});

export default router;
