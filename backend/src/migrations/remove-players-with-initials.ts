import { pool } from "../config/database";
import { RowDataPacket } from "mysql2";

/**
 * Миграция для удаления игроков с инициалами вместо имени
 * Удаляет игроков вида "Фамилия И." (вторая часть — инициал с точкой)
 */
export async function removePlayersWithInitials(): Promise<void> {
  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();
    console.log("🔄 Поиск игроков с инициалами вместо полного имени...");

    // Получаем всех игроков
    const [players] = await connection.execute<
      (RowDataPacket & { id: number; name: string })[]
    >(`SELECT id, name FROM players ORDER BY name`);

    console.log(`📊 Анализируем ${players.length} игроков`);

    const playersToDelete: Array<{ id: number; name: string }> = [];

    // Проверяем каждое имя
    for (const player of players) {
      const parts = player.name.trim().split(/\s+/);

      // Ищем строго двусоставные записи: "Фамилия И."
      if (parts.length === 2) {
        const second = parts[1];
        const isInitial = /^(?:[А-ЯA-Z]\.)$/.test(second);
        if (isInitial) {
          playersToDelete.push({ id: player.id, name: player.name });
        }
      }
    }

    if (playersToDelete.length === 0) {
      await connection.rollback();
      console.log("✅ Игроки с инициалами не найдены - удаление не требуется");
      return;
    }

    console.log(
      `🗑️  Удаляем ${playersToDelete.length} игроков с инициалами...`
    );

    for (const p of playersToDelete) {
      await connection.execute(`DELETE FROM players WHERE id = ?`, [p.id]);
      console.log(`   ✓ Удален: "${p.name}" (ID: ${p.id})`);
    }

    await connection.commit();
    console.log("✅ Удаление завершено");
  } catch (error) {
    await connection.rollback();
    console.error("❌ Ошибка миграции:", error);
    throw error;
  } finally {
    connection.release();
  }
}
