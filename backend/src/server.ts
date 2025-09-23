import express from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import * as dotenv from "dotenv";
import path from "path";

import routes from "./routes";
import { testConnection } from "./config/database";
import { runMigrations } from "./migrations/migrate";
import { AuthModel } from "./models/AuthModel";

// Загружаем переменные окружения
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(
  helmet({
    crossOriginResourcePolicy: { policy: "cross-origin" },
  })
);
app.use(
  cors({
    origin: process.env.FRONTEND_URL || "http://localhost:3000",
    credentials: true,
  })
);
app.use(morgan("combined"));
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));

// API routes
app.use("/api", routes);

// Serve static files from React build (в продакшене)
if (process.env.NODE_ENV === "production") {
  const buildPath = path.join(__dirname, "../../frontend/dist");
  app.use(express.static(buildPath));

  // Все остальные запросы направляем на React роутер
  app.get("*", (req, res) => {
    res.sendFile(path.join(buildPath, "index.html"));
  });
}

// Global error handler
app.use(
  (
    error: any,
    req: express.Request,
    res: express.Response,
    next: express.NextFunction
  ) => {
    console.error("Ошибка сервера:", error);

    if (error.code === "LIMIT_FILE_SIZE") {
      return res.status(413).json({
        success: false,
        message: "Файл слишком большой. Максимальный размер: 5MB",
      });
    }

    if (error.message.includes("Excel")) {
      return res.status(400).json({
        success: false,
        message: error.message,
      });
    }

    res.status(500).json({
      success: false,
      message: "Внутренняя ошибка сервера",
    });
  }
);

// 404 handler for API routes
app.use("/api/*", (req, res) => {
  res.status(404).json({
    success: false,
    message: "API эндпоинт не найден",
  });
});

// Функция инициализации сервера
const initializeServer = async () => {
  try {
    console.log("🚀 Инициализация сервера...");

    // 1. Проверяем подключение к базе данных
    const dbConnected = await testConnection();
    if (!dbConnected) {
      console.error("❌ Не удалось подключиться к базе данных");
      process.exit(1);
    }

    // 2. Выполняем миграции
    console.log("🔄 Выполнение миграций...");
    await runMigrations();

    // 3. Инициализируем администратора по умолчанию
    console.log("👤 Проверка администраторов...");
    await AuthModel.ensureDefaultAdmin();

    // 4. Запускаем сервер
    app.listen(PORT, () => {
      console.log(`✅ Сервер запущен на порту ${PORT}`);
      console.log(`🌐 API доступен по адресу: http://localhost:${PORT}/api`);

      if (process.env.NODE_ENV !== "production") {
        console.log(`🔧 Режим разработки`);
        console.log(
          `📊 Рейтинг доступен: http://localhost:${PORT}/api/rating/table`
        );
        console.log(`🔐 Админ панель: http://localhost:${PORT}/api/admin/*`);
      }
    });
  } catch (error) {
    console.error("❌ Ошибка инициализации сервера:", error);
    process.exit(1);
  }
};

// Обработка graceful shutdown
process.on("SIGINT", () => {
  console.log("\n🛑 Получен сигнал SIGINT. Завершение работы...");
  process.exit(0);
});

process.on("SIGTERM", () => {
  console.log("\n🛑 Получен сигнал SIGTERM. Завершение работы...");
  process.exit(0);
});

// Обработка необработанных ошибок
process.on("unhandledRejection", (reason, promise) => {
  console.error(
    "❌ Необработанное отклонение Promise:",
    promise,
    "Причина:",
    reason
  );
});

process.on("uncaughtException", (error) => {
  console.error("❌ Необработанная ошибка:", error);
  process.exit(1);
});

// Запуск сервера
initializeServer();
