/**
 * Миграция 009: Удаление настройки current_season
 *
 * Настройка current_season не используется в приложении и может быть удалена.
 */

export const up = async (pool: any): Promise<void> => {
  console.log("🔍 Проверка наличия current_season в rating_settings...");

  const [rows] = await pool.execute(
    "SELECT id FROM rating_settings WHERE setting_name = 'current_season'"
  );

  if ((rows as any[]).length > 0) {
    console.log("📦 Удаление current_season из rating_settings...");
    await pool.execute(
      "DELETE FROM rating_settings WHERE setting_name = 'current_season'"
    );
    console.log("✅ current_season удалён");
  } else {
    console.log("⏭️ current_season не найден, пропускаем");
  }
};

export const down = async (pool: any): Promise<void> => {
  console.log("📦 Восстановление current_season в rating_settings...");
  await pool.execute(`
    INSERT IGNORE INTO rating_settings (setting_name, setting_value, description) 
    VALUES ('current_season', '2025', 'Текущий сезон')
  `);
  console.log("✅ current_season восстановлен");
};
