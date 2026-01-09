/**
 * Миграция 010: Добавление столбца year в rating_settings
 *
 * Позволяет задавать разные настройки (например, best_results_count) для разных годов.
 * Уникальный ключ теперь по (setting_name, year).
 */

export const up = async (pool: any): Promise<void> => {
  console.log("🔍 Проверка наличия столбца year в rating_settings...");

  const [columns] = await pool.execute(
    `SELECT COLUMN_NAME FROM information_schema.COLUMNS 
     WHERE TABLE_SCHEMA = DATABASE() 
     AND TABLE_NAME = 'rating_settings' 
     AND COLUMN_NAME = 'year'`
  );

  if ((columns as any[]).length === 0) {
    console.log("📦 Добавление столбца year в rating_settings...");

    // Добавляем столбец year
    await pool.execute(
      `ALTER TABLE rating_settings ADD COLUMN year INT NOT NULL DEFAULT ${new Date().getFullYear()} AFTER setting_name`
    );

    // Удаляем старый уникальный ключ по setting_name
    try {
      await pool.execute(`ALTER TABLE rating_settings DROP INDEX setting_name`);
    } catch (e) {
      // Индекс может не существовать
      console.log("⏭️ Индекс setting_name не найден, пропускаем удаление");
    }

    // Добавляем новый уникальный ключ по (setting_name, year)
    await pool.execute(
      `ALTER TABLE rating_settings ADD UNIQUE KEY unique_setting_year (setting_name, year)`
    );

    // Добавляем индекс по году
    await pool.execute(`ALTER TABLE rating_settings ADD INDEX idx_year (year)`);

    console.log("✅ Столбец year добавлен в rating_settings");
  } else {
    console.log("⏭️ Столбец year уже существует, пропускаем");
  }
};

export const down = async (pool: any): Promise<void> => {
  console.log("📦 Удаление столбца year из rating_settings...");

  // Удаляем индексы
  try {
    await pool.execute(
      `ALTER TABLE rating_settings DROP INDEX unique_setting_year`
    );
  } catch (e) {}

  try {
    await pool.execute(`ALTER TABLE rating_settings DROP INDEX idx_year`);
  } catch (e) {}

  // Удаляем столбец
  await pool.execute(`ALTER TABLE rating_settings DROP COLUMN year`);

  // Восстанавливаем уникальный ключ по setting_name
  await pool.execute(
    `ALTER TABLE rating_settings ADD UNIQUE KEY setting_name (setting_name)`
  );

  console.log("✅ Столбец year удалён из rating_settings");
};
