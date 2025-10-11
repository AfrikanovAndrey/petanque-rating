import mysql from "mysql2/promise";
import * as dotenv from "dotenv";

dotenv.config();

const dbConfig = {
  host: process.env.DB_HOST || "localhost",
  port: parseInt(process.env.DB_PORT || "3306"),
  user: process.env.DB_USER || "root",
  password: process.env.DB_PASSWORD || "",
  database: process.env.DB_NAME || "petanque_rating",
  waitForConnections: true,
  connectionLimit: 20, // Увеличено для лучшей параллельности
  queueLimit: 0,
  acquireTimeout: 60000, // Таймаут получения соединения
  timeout: 60000, // Общий таймаут запроса
};

export const pool = mysql.createPool(dbConfig);

// Проверка соединения
export const testConnection = async () => {
  try {
    const connection = await pool.getConnection();
    console.log("✅ База данных успешно подключена");
    connection.release();
    return true;
  } catch (error) {
    console.error("❌ Ошибка подключения к базе данных:", error);
    return false;
  }
};
