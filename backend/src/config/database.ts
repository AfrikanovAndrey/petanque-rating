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
  connectionLimit: 10,
  queueLimit: 0,
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
