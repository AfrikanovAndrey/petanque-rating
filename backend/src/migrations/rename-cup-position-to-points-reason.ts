import { pool } from "../config/database";
import { RowDataPacket } from "mysql2";
import { convertCupPositionToPointsReason, PointsReason } from "../types";

interface TableColumn extends RowDataPacket {
  Field: string;
  Type: string;
  Null: string;
  Key: string;
  Default: string | null;
  Extra: string;
}

export const renameCupPositionToPointsReason = async () => {
  try {
    console.log("🔄 Миграция: Переименование cup_position в points_reason...");

    // Проверяем структуру таблицы
    const [columns] = await pool.execute<TableColumn[]>(
      "DESCRIBE tournament_results"
    );

    const hasCupPosition = columns.some((col) => col.Field === "cup_position");
    const hasPointsReason = columns.some(
      (col) => col.Field === "points_reason"
    );

    if (!hasCupPosition && hasPointsReason) {
      console.log("✅ Миграция уже выполнена");
      return;
    }

    if (!hasCupPosition) {
      console.log("❌ Столбец cup_position не найден");
      return;
    }

    // 1. Добавляем новый столбец points_reason с enum (если его нет)
    if (!hasPointsReason) {
      console.log("📝 Добавляем столбец points_reason...");
      await pool.execute(`
        ALTER TABLE tournament_results 
        ADD COLUMN points_reason ENUM(
          'CUP_WINNER',
          'CUP_RUNNER_UP', 
          'CUP_THIRD_PLACE',
          'CUP_SEMI_FINAL',
          'CUP_QUARTER_FINAL',
          'QUALIFYING_HIGH',
          'QUALIFYING_LOW'
        ) NOT NULL DEFAULT 'CUP_QUARTER_FINAL' AFTER cup_position
      `);
    } else {
      console.log("✅ Столбец points_reason уже существует");
    }

    // 2. Переносим данные из cup_position в points_reason
    console.log("🔄 Конвертируем данные из cup_position в points_reason...");

    const [results] = await pool.execute<RowDataPacket[]>(
      "SELECT id, cup_position FROM tournament_results"
    );

    let convertedCount = 0;
    for (const row of results) {
      const pointsReason = convertCupPositionToPointsReason(row.cup_position);
      await pool.execute(
        "UPDATE tournament_results SET points_reason = ? WHERE id = ?",
        [pointsReason, row.id]
      );
      convertedCount++;
    }

    console.log(`✅ Конвертировано ${convertedCount} записей`);

    // 3. Удаляем старый столбец cup_position (если он еще есть)
    if (hasCupPosition) {
      console.log("🗑️ Удаляем старый столбец cup_position...");
      await pool.execute(`
        ALTER TABLE tournament_results 
        DROP COLUMN cup_position
      `);
    } else {
      console.log("✅ Столбец cup_position уже удален");
    }

    // 4. Добавляем индекс для нового столбца (если его нет)
    try {
      console.log("📊 Добавляем индекс для points_reason...");
      await pool.execute(`
        ALTER TABLE tournament_results 
        ADD INDEX idx_points_reason (points_reason)
      `);
    } catch (error: any) {
      if (error.code === "ER_DUP_KEYNAME") {
        console.log("✅ Индекс idx_points_reason уже существует");
      } else {
        throw error;
      }
    }

    console.log("✅ Миграция успешно завершена!");

    // Показываем итоговую структуру
    const [finalColumns] = await pool.execute<TableColumn[]>(
      "DESCRIBE tournament_results"
    );
    console.log("📋 Новая структура таблицы tournament_results:");
    finalColumns.forEach((col) => {
      console.log(
        `  - ${col.Field}: ${col.Type} ${
          col.Null === "NO" ? "NOT NULL" : "NULL"
        }`
      );
    });
  } catch (error) {
    console.error("❌ Ошибка миграции:", error);
    throw error;
  }
};
