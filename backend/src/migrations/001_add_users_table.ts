import { Pool, RowDataPacket } from "mysql2/promise";

/**
 * Миграция: Обновление таблицы admins -> users с добавлением ролей
 * Дата: 2025-10-09
 */

export async function up(pool: Pool): Promise<void> {
  // Проверяем, существует ли уже таблица users
  const [usersTables] = await pool.execute<RowDataPacket[]>(`
    SELECT TABLE_NAME 
    FROM information_schema.TABLES 
    WHERE TABLE_SCHEMA = DATABASE() 
    AND TABLE_NAME = 'users'
  `);

  if (usersTables.length > 0) {
    console.log("⏭️  Таблица users уже существует");
    return;
  }

  // Создаем новую таблицу users
  await pool.execute(`
    CREATE TABLE users (
      id INT AUTO_INCREMENT PRIMARY KEY,
      name VARCHAR(255) NOT NULL COMMENT 'Фамилия Имя',
      username VARCHAR(100) NOT NULL UNIQUE COMMENT 'Логин пользователя',
      password_hash VARCHAR(255) NOT NULL,
      role ENUM('ADMIN', 'MANAGER') NOT NULL DEFAULT 'MANAGER',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      INDEX idx_username (username),
      INDEX idx_role (role)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  console.log("✅ Таблица users создана");

  // Проверяем, существует ли таблица admins
  const [adminsTables] = await pool.execute<RowDataPacket[]>(`
    SELECT TABLE_NAME 
    FROM information_schema.TABLES 
    WHERE TABLE_SCHEMA = DATABASE() 
    AND TABLE_NAME = 'admins'
  `);

  if (adminsTables.length > 0) {
    // Таблица admins существует, копируем данные
    // Используем COLLATE для корректного сравнения
    await pool.execute(`
      INSERT IGNORE INTO users (name, username, password_hash, role, created_at, updated_at)
      SELECT 
        username as name,
        username COLLATE utf8mb4_unicode_ci,
        password_hash,
        'ADMIN' as role,
        created_at,
        updated_at
      FROM admins
    `);

    console.log("✅ Данные из таблицы admins скопированы в users");
  } else {
    console.log("⏭️  Таблица admins не найдена, пропускаем копирование");
  }
}

export async function down(pool: Pool): Promise<void> {
  // Откат: удаляем таблицу users
  // ВНИМАНИЕ: Это приведет к потере всех данных пользователей!
  await pool.execute(`DROP TABLE IF EXISTS users`);
}
