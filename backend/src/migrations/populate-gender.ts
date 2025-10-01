import { pool } from "../config/database";
import { detectGender, Gender } from "../utils/genderDetector";
import { RowDataPacket } from "mysql2";

interface PlayerRow {
  id: number;
  name: string;
  gender?: Gender;
}

/**
 * Миграция для заполнения поля gender у существующих игроков
 */
export async function populateGender(): Promise<void> {
  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();
    console.log("🚻 Заполнение поля gender для существующих игроков...");

    // 1. Получаем всех игроков без определенного пола
    const [players] = await connection.execute<(PlayerRow & RowDataPacket)[]>(
      `SELECT id, name, gender FROM players WHERE gender IS NULL ORDER BY name`
    );

    console.log(`📊 Найдено ${players.length} игроков без определенного пола`);

    let maleCount = 0;
    let femaleCount = 0;
    let ambiguousCount = 0;
    const ambiguousPlayers: string[] = [];

    // 2. Определяем пол для каждого игрока
    for (const player of players) {
      const genderResult = detectGender(player.name);

      console.log(
        `👤 ${player.name}: ${genderResult.gender || "неизвестно"} (${
          genderResult.confidence
        }) - ${genderResult.reason}`
      );

      if (genderResult.gender && genderResult.confidence !== "low") {
        // Обновляем пол в базе данных
        await connection.execute(`UPDATE players SET gender = ? WHERE id = ?`, [
          genderResult.gender,
          player.id,
        ]);

        if (genderResult.gender === "male") {
          maleCount++;
        } else {
          femaleCount++;
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

    console.log("✅ Заполнение пола завершено:");
    console.log(`   👨 Мужчин: ${maleCount}`);
    console.log(`   👩 Женщин: ${femaleCount}`);
    console.log(`   ❓ Неоднозначных: ${ambiguousCount}`);

    if (ambiguousPlayers.length > 0) {
      console.log("\n❓ Игроки с неоднозначными именами:");
      ambiguousPlayers.forEach((player) => console.log(`   - ${player}`));
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

/**
 * Функция для ручного обновления пола конкретного игрока
 */
export async function updatePlayerGender(
  playerId: number,
  gender: Gender
): Promise<void> {
  const connection = await pool.getConnection();

  try {
    await connection.execute(`UPDATE players SET gender = ? WHERE id = ?`, [
      gender,
      playerId,
    ]);
    console.log(`✅ Пол игрока ID ${playerId} обновлен на ${gender}`);
  } catch (error) {
    console.error("❌ Ошибка обновления пола:", error);
    throw error;
  } finally {
    connection.release();
  }
}
