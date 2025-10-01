import { pool } from "../config/database";
import { RowDataPacket } from "mysql2";

interface TableColumn extends RowDataPacket {
  Field: string;
  Type: string;
  Null: string;
  Key: string;
  Default: string | null;
  Extra: string;
}

const checkAndFixCupPositionColumn = async () => {
  try {
    console.log("🔍 Проверка структуры таблицы tournament_results...");

    // Проверяем существование столбца points_reason
    const [columns] = await pool.execute<TableColumn[]>(
      "DESCRIBE tournament_results"
    );

    console.log("📋 Текущие столбцы таблицы tournament_results:");
    columns.forEach((col) => {
      console.log(
        `  - ${col.Field}: ${col.Type} ${
          col.Null === "NO" ? "NOT NULL" : "NULL"
        }`
      );
    });

    const hasPointsReasonColumn = columns.some(
      (col) => col.Field === "points_reason"
    );

    if (!hasPointsReasonColumn) {
      console.log("❌ Столбец points_reason отсутствует. Добавляем...");

      // Добавляем столбец points_reason
      await pool.execute(`
        ALTER TABLE tournament_results
        ADD COLUMN points_reason ENUM('CUP_WINNER', 'CUP_RUNNER_UP', 'CUP_THIRD_PLACE', 'CUP_SEMI_FINAL', 'CUP_QUARTER_FINAL', 'QUALIFYING_HIGH', 'QUALIFYING_LOW') NOT NULL DEFAULT 'CUP_QUARTER_FINAL' AFTER player_id
      `);

      // Добавляем индекс для points_reason
      await pool.execute(`
        ALTER TABLE tournament_results
        ADD INDEX idx_points_reason (points_reason)
      `);

      console.log("✅ Столбец points_reason успешно добавлен");
    } else {
      console.log("✅ Столбец points_reason уже существует");
    }

    // Проверяем наличие столбца cup
    const hasCupColumn = columns.some((col) => col.Field === "cup");
    if (!hasCupColumn) {
      console.log("❌ Столбец cup отсутствует. Добавляем...");

      // Добавляем столбец cup
      await pool.execute(`
        ALTER TABLE tournament_results
        ADD COLUMN cup ENUM('A', 'B') NULL AFTER points_reason
      `);

      console.log("✅ Столбец cup успешно добавлен");
    } else {
      console.log("✅ Столбец cup уже существует");
    }

    // Проверяем наличие лишнего столбца position
    const hasPositionColumn = columns.some((col) => col.Field === "position");
    if (hasPositionColumn) {
      console.log("⚠️ Найден устаревший столбец position. Удаляем...");

      // Удаляем лишний столбец position
      await pool.execute(`
        ALTER TABLE tournament_results 
        DROP COLUMN position
      `);

      console.log("✅ Столбец position успешно удален");
    }

    // Проверяем окончательную структуру
    const [finalColumns] = await pool.execute<TableColumn[]>(
      "DESCRIBE tournament_results"
    );
    console.log("📋 Окончательная структура таблицы:");
    finalColumns.forEach((col) => {
      console.log(
        `  - ${col.Field}: ${col.Type} ${
          col.Null === "NO" ? "NOT NULL" : "NULL"
        }`
      );
    });

    // Проверяем данные в таблице
    const [results] = await pool.execute<RowDataPacket[]>(
      "SELECT COUNT(*) as count FROM tournament_results"
    );
    console.log(
      `📊 Количество записей в таблице tournament_results: ${results[0].count}`
    );
  } catch (error) {
    console.error(
      "❌ Ошибка при проверке/исправлении структуры таблицы:",
      error
    );
    throw error;
  }
};

// Запуск скрипта если вызван напрямую
if (require.main === module) {
  checkAndFixCupPositionColumn()
    .then(() => {
      console.log("✅ Проверка завершена успешно");
      process.exit(0);
    })
    .catch((error) => {
      console.error("❌ Ошибка:", error);
      process.exit(1);
    });
}

export { checkAndFixCupPositionColumn };
