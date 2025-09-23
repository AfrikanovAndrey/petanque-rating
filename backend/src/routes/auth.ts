import { Router } from "express";
import { AuthController } from "../controllers/AuthController";

const router = Router();

// POST /api/auth/login - авторизация администратора
router.post("/login", AuthController.login);

// GET /api/auth/verify - проверка токена
router.get("/verify", AuthController.verifyToken);

// PUT /api/auth/change-password - изменение пароля
router.put("/change-password", AuthController.changePassword);

export default router;
