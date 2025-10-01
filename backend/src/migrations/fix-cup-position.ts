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

    // Проверяем существование столбца cup_position
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

    const hasCupPositionColumn = columns.some(
      (col) => col.Field === "cup_position"
    );

    if (!hasCupPositionColumn) {
      console.log("❌ Столбец cup_position отсутствует. Добавляем...");

      // Добавляем столбец cup_position
      await pool.execute(`
        ALTER TABLE tournament_results 
        ADD COLUMN cup_position VARCHAR(10) NOT NULL DEFAULT '0' AFTER player_id
      `);

      // Добавляем индекс для cup_position
      await pool.execute(`
        ALTER TABLE tournament_results 
        ADD INDEX idx_cup_position (cup_position)
      `);

      console.log("✅ Столбец cup_position успешно добавлен");
    } else {
      console.log("✅ Столбец cup_position уже существует");
    }

    // Проверяем наличие столбца cup
    const hasCupColumn = columns.some((col) => col.Field === "cup");
    if (!hasCupColumn) {
      console.log("❌ Столбец cup отсутствует. Добавляем...");

      // Добавляем столбец cup
      await pool.execute(`
        ALTER TABLE tournament_results 
        ADD COLUMN cup ENUM('A', 'B') NULL AFTER cup_position
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
