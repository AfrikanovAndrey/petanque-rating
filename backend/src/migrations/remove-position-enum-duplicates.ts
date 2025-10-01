import { pool } from "../config/database";
import { RowDataPacket, ResultSetHeader } from "mysql2";

interface TableColumn extends RowDataPacket {
  Field: string;
  Type: string;
  Null: string;
  Key: string;
  Default: string | null;
  Extra: string;
}

export const removePositionEnumDuplicates = async () => {
  try {
    console.log(
      "🔄 Миграция: Удаление дублирующихся POSITION_* значений в enum points_reason..."
    );

    // Проверяем структуру таблицы
    const [columns] = await pool.execute<TableColumn[]>(
      "DESCRIBE tournament_results"
    );

    const hasPointsReason = columns.some(
      (col) => col.Field === "points_reason"
    );

    if (!hasPointsReason) {
      console.log("❌ Столбец points_reason не найден");
      return;
    }

    // 1. Обновляем существующие записи с POSITION_* на соответствующие CUP_*
    console.log("🔄 Обновляем POSITION_* значения на CUP_*...");

    // POSITION_1 -> CUP_WINNER
    const [result1] = await pool.execute<ResultSetHeader>(
      "UPDATE tournament_results SET points_reason = 'CUP_WINNER' WHERE points_reason = 'POSITION_1'"
    );
    console.log(
      `✅ POSITION_1 -> CUP_WINNER: обновлено ${result1.affectedRows} записей`
    );

    // POSITION_2 -> CUP_RUNNER_UP
    const [result2] = await pool.execute<ResultSetHeader>(
      "UPDATE tournament_results SET points_reason = 'CUP_RUNNER_UP' WHERE points_reason = 'POSITION_2'"
    );
    console.log(
      `✅ POSITION_2 -> CUP_RUNNER_UP: обновлено ${result2.affectedRows} записей`
    );

    // POSITION_3 -> CUP_THIRD_PLACE
    const [result3] = await pool.execute<ResultSetHeader>(
      "UPDATE tournament_results SET points_reason = 'CUP_THIRD_PLACE' WHERE points_reason = 'POSITION_3'"
    );
    console.log(
      `✅ POSITION_3 -> CUP_THIRD_PLACE: обновлено ${result3.affectedRows} записей`
    );

    // POSITION_1_2 -> CUP_SEMI_FINAL
    const [result4] = await pool.execute<ResultSetHeader>(
      "UPDATE tournament_results SET points_reason = 'CUP_SEMI_FINAL' WHERE points_reason = 'POSITION_1_2'"
    );
    console.log(
      `✅ POSITION_1_2 -> CUP_SEMI_FINAL: обновлено ${result4.affectedRows} записей`
    );

    // POSITION_1_4 -> CUP_QUARTER_FINAL
    const [result5] = await pool.execute<ResultSetHeader>(
      "UPDATE tournament_results SET points_reason = 'CUP_QUARTER_FINAL' WHERE points_reason = 'POSITION_1_4'"
    );
    console.log(
      `✅ POSITION_1_4 -> CUP_QUARTER_FINAL: обновлено ${result5.affectedRows} записей`
    );

    const totalUpdated =
      result1.affectedRows +
      result2.affectedRows +
      result3.affectedRows +
      result4.affectedRows +
      result5.affectedRows;
    console.log(`✅ Всего обновлено записей: ${totalUpdated}`);

    // 2. Обновляем enum в таблице - убираем POSITION_* значения
    console.log(
      "🔄 Обновляем enum points_reason - убираем POSITION_* значения..."
    );
    await pool.execute(`
      ALTER TABLE tournament_results 
      MODIFY COLUMN points_reason ENUM(
        'CUP_WINNER',
        'CUP_RUNNER_UP', 
        'CUP_THIRD_PLACE',
        'CUP_SEMI_FINAL',
        'CUP_QUARTER_FINAL',
        'QUALIFYING_HIGH',
        'QUALIFYING_LOW'
      ) NOT NULL
    `);

    console.log("✅ Enum обновлён - POSITION_* значения удалены");

    console.log("✅ Миграция успешно завершена!");

    // Показываем итоговую структуру
    const [finalColumns] = await pool.execute<TableColumn[]>(
      "DESCRIBE tournament_results"
    );
    console.log("📋 Обновлённая структура таблицы tournament_results:");
    const pointsReasonColumn = finalColumns.find(
      (col) => col.Field === "points_reason"
    );
    if (pointsReasonColumn) {
      console.log(`  - points_reason: ${pointsReasonColumn.Type}`);
    }
  } catch (error) {
    console.error("❌ Ошибка миграции:", error);
    throw error;
  }
};
