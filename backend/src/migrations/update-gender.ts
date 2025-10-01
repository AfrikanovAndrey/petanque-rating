import { pool } from "../config/database";
import { detectGender, Gender } from "../utils/genderDetector";
import { RowDataPacket } from "mysql2";

interface PlayerRow {
  id: number;
  name: string;
  gender?: Gender;
}

/**
 * Миграция для повторного определения пола всех игроков с улучшенным алгоритмом
 */
export async function updateGender(): Promise<void> {
  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();
    console.log(
      "🔄 Повторное определение пола всех игроков с улучшенным алгоритмом..."
    );

    // 1. Получаем всех игроков
    const [players] = await connection.execute<(PlayerRow & RowDataPacket)[]>(
      `SELECT id, name, gender FROM players ORDER BY name`
    );

    console.log(`📊 Обрабатываем ${players.length} игроков`);

    let maleCount = 0;
    let femaleCount = 0;
    let ambiguousCount = 0;
    let updatedCount = 0;
    const ambiguousPlayers: string[] = [];

    // 2. Определяем пол для каждого игрока
    for (const player of players) {
      const genderResult = detectGender(player.name);

      console.log(
        `👤 ${player.name}: ${genderResult.gender || "неизвестно"} (${
          genderResult.confidence
        }) - ${genderResult.reason}`
      );

      // Обновляем только если пол определен с достаточной уверенностью
      if (genderResult.gender && genderResult.confidence !== "low") {
        // Обновляем пол в базе данных (даже если он уже был определен)
        await connection.execute(`UPDATE players SET gender = ? WHERE id = ?`, [
          genderResult.gender,
          player.id,
        ]);

        if (genderResult.gender === "male") {
          maleCount++;
        } else {
          femaleCount++;
        }

        // Считаем обновления только если пол изменился
        if (player.gender !== genderResult.gender) {
          updatedCount++;
        }
      } else {
        // Сохраняем неоднозначные случаи для ручной проверки
        ambiguousCount++;
        ambiguousPlayers.push(
          `${player.name} (ID: ${player.id}) - ${genderResult.reason}`
        );
      }
    }

    await connection.commit();

    console.log("✅ Обновление пола завершено:");
    console.log(`   👨 Мужчин: ${maleCount}`);
    console.log(`   👩 Женщин: ${femaleCount}`);
    console.log(`   ❓ Неоднозначных: ${ambiguousCount}`);
    console.log(`   🔄 Обновлено записей: ${updatedCount}`);

    if (ambiguousPlayers.length > 0) {
      console.log("\n❓ Игроки с неоднозначными именами:");
      ambiguousPlayers
        .slice(0, 20)
        .forEach((player) => console.log(`   - ${player}`));
      if (ambiguousPlayers.length > 20) {
        console.log(`   ... и еще ${ambiguousPlayers.length - 20} игроков`);
      }
      console.log("\n⚠️  Для этих игроков потребуется ручное определение пола");
    }
  } catch (error) {
    await connection.rollback();
    console.error("❌ Ошибка миграции:", error);
    throw error;
  } finally {
    connection.release();
  }
}
