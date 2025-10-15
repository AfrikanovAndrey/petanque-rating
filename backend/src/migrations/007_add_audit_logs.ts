import { Pool, RowDataPacket } from "mysql2/promise";

/**
 * Миграция: Создание таблицы audit_logs для логирования действий пользователей
 * Дата: 2025-10-15
 */

export async function up(pool: Pool): Promise<void> {
  // Проверяем, существует ли уже таблица audit_logs
  const [auditTables] = await pool.execute<RowDataPacket[]>(`
    SELECT TABLE_NAME 
    FROM information_schema.TABLES 
    WHERE TABLE_SCHEMA = DATABASE() 
    AND TABLE_NAME = 'audit_logs'
  `);

  if (auditTables.length > 0) {
    console.log("⏭️  Таблица audit_logs уже существует");
    return;
  }

  // Создаем таблицу audit_logs
  await pool.execute(`
    CREATE TABLE audit_logs (
      id INT AUTO_INCREMENT PRIMARY KEY,
      user_id INT NOT NULL COMMENT 'ID пользователя, совершившего действие',
      username VARCHAR(100) NOT NULL COMMENT 'Имя пользователя для удобства',
      user_role ENUM('ADMIN', 'MANAGER') NOT NULL COMMENT 'Роль пользователя на момент действия',
      action VARCHAR(100) NOT NULL COMMENT 'Тип действия (CREATE, UPDATE, DELETE, LOGIN, etc.)',
      entity_type VARCHAR(50) NULL COMMENT 'Тип сущности (tournament, player, team, user, etc.)',
      entity_id INT NULL COMMENT 'ID сущности, над которой совершено действие',
      entity_name VARCHAR(255) NULL COMMENT 'Название сущности для удобства чтения',
      description TEXT NULL COMMENT 'Подробное описание действия',
      ip_address VARCHAR(45) NULL COMMENT 'IP адрес пользователя (поддержка IPv6)',
      user_agent TEXT NULL COMMENT 'User Agent браузера',
      request_method VARCHAR(10) NULL COMMENT 'HTTP метод (GET, POST, PUT, DELETE)',
      request_url VARCHAR(500) NULL COMMENT 'URL запроса',
      request_body JSON NULL COMMENT 'Тело запроса (без чувствительных данных)',
      changes JSON NULL COMMENT 'Изменения в формате JSON (old/new values)',
      success BOOLEAN DEFAULT TRUE COMMENT 'Успешность операции',
      error_message TEXT NULL COMMENT 'Сообщение об ошибке, если не успешно',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT 'Время выполнения действия',
      INDEX idx_user_id (user_id),
      INDEX idx_username (username),
      INDEX idx_action (action),
      INDEX idx_entity (entity_type, entity_id),
      INDEX idx_created_at (created_at DESC),
      INDEX idx_success (success),
      INDEX idx_user_action (user_id, action),
      INDEX idx_entity_type (entity_type),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE RESTRICT
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Логи действий пользователей в системе'
  `);

  console.log("✅ Таблица audit_logs создана");
}

export async function down(pool: Pool): Promise<void> {
  // Откат: удаляем таблицу audit_logs
  await pool.execute(`DROP TABLE IF EXISTS audit_logs`);
  console.log("✅ Таблица audit_logs удалена");
}
