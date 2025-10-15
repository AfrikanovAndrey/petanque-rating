import { RowDataPacket } from "mysql2";
import { pool } from "../config/database";

/**
 * Миграция 006: Обновление enum cup_position
 *
 * Что делает:
 * 1. Добавляет новые значения cup_position: '1', '2', '3', '1/2', '1/4', '1/8'
 * 2. Добавляет поддержку для старых значений: 'ROUND_OF_4', 'ROUND_OF_8', 'ROUND_OF_16'
 * 3. Обновляет существующие записи со старых значений на новые
 *
 * Маппинг значений:
 * - WINNER -> 1
 * - RUNNER_UP -> 2
 * - THIRD_PLACE -> 3
 * - SEMI_FINAL -> 1/2
 * - QUARTER_FINAL -> 1/4
 */

export async function up(): Promise<void> {
  console.log("Запуск миграции 006: Обновление enum cup_position");

  try {
    // Шаг 1: Изменяем enum, добавляя новые значения (включая старые с префиксом CUP_)
    console.log("Добавление новых значений в enum cup_position...");
    await pool.execute(`
      ALTER TABLE tournament_results 
      MODIFY COLUMN cup_position ENUM(
        '1',
        '2', 
        '3',
        '1/2',
        '1/4',
        '1/8',
        'QUALIFYING_HIGH',
        'QUALIFYING_LOW',
        'QUALIFYING_ONLY',
        'WINNER',
        'RUNNER_UP',
        'THIRD_PLACE',
        'SEMI_FINAL',
        'QUARTER_FINAL',
        'ROUND_OF_4',
        'ROUND_OF_8',
        'ROUND_OF_16',
        'CUP_WINNER',
        'CUP_RUNNER_UP',
        'CUP_THIRD_PLACE',
        'CUP_SEMI_FINAL',
        'CUP_QUARTER_FINAL'
      ) DEFAULT NULL
    `);

    // Шаг 2: Обновляем существующие записи
    console.log("Обновление существующих записей...");

    // Проверяем, есть ли записи с старыми значениями
    const [rows] = await pool.execute<RowDataPacket[]>(
      `SELECT COUNT(*) as count FROM tournament_results 
       WHERE cup_position IN ('WINNER', 'RUNNER_UP', 'THIRD_PLACE', 'SEMI_FINAL', 'QUARTER_FINAL', 'ROUND_OF_4', 'ROUND_OF_8', 'ROUND_OF_16',
                              'CUP_WINNER', 'CUP_RUNNER_UP', 'CUP_THIRD_PLACE', 'CUP_SEMI_FINAL', 'CUP_QUARTER_FINAL')`
    );

    if (rows[0].count > 0) {
      console.log(`Найдено ${rows[0].count} записей для обновления`);

      // Обновляем записи (включая старые значения с префиксом CUP_)
      await pool.execute(
        `UPDATE tournament_results SET cup_position = '1' WHERE cup_position IN ('WINNER', 'CUP_WINNER')`
      );
      await pool.execute(
        `UPDATE tournament_results SET cup_position = '2' WHERE cup_position IN ('RUNNER_UP', 'CUP_RUNNER_UP')`
      );
      await pool.execute(
        `UPDATE tournament_results SET cup_position = '3' WHERE cup_position IN ('THIRD_PLACE', 'CUP_THIRD_PLACE')`
      );
      await pool.execute(
        `UPDATE tournament_results SET cup_position = '1/2' WHERE cup_position IN ('SEMI_FINAL', 'ROUND_OF_4', 'CUP_SEMI_FINAL')`
      );
      await pool.execute(
        `UPDATE tournament_results SET cup_position = '1/4' WHERE cup_position IN ('QUARTER_FINAL', 'ROUND_OF_8', 'CUP_QUARTER_FINAL')`
      );
      await pool.execute(
        `UPDATE tournament_results SET cup_position = '1/8' WHERE cup_position = 'ROUND_OF_16'`
      );

      console.log("Записи успешно обновлены");
    } else {
      console.log("Записи для обновления не найдены");
    }

    await pool.execute(`
        ALTER TABLE tournament_results 
        MODIFY COLUMN cup_position ENUM(
          '1',
          '2', 
          '3',
          '1/2',
          '1/4',
          '1/8'
        ) DEFAULT NULL
      `);

    console.log("✅ Миграция 006 успешно применена");
  } catch (error) {
    console.error("❌ Ошибка при выполнении миграции 006:", error);
    throw error;
  }
}

export async function down(): Promise<void> {
  console.log("Откат миграции 006: Обновление enum cup_position");

  try {
    // Откатываем значения обратно
    console.log("Откат значений cup_position к старым...");
    await pool.execute(
      `UPDATE tournament_results SET cup_position = 'WINNER' WHERE cup_position = '1'`
    );
    await pool.execute(
      `UPDATE tournament_results SET cup_position = 'RUNNER_UP' WHERE cup_position = '2'`
    );
    await pool.execute(
      `UPDATE tournament_results SET cup_position = 'THIRD_PLACE' WHERE cup_position = '3'`
    );
    await pool.execute(
      `UPDATE tournament_results SET cup_position = 'SEMI_FINAL' WHERE cup_position = '1/2'`
    );
    await pool.execute(
      `UPDATE tournament_results SET cup_position = 'QUARTER_FINAL' WHERE cup_position = '1/4'`
    );
    await pool.execute(
      `UPDATE tournament_results SET cup_position = 'QUARTER_FINAL' WHERE cup_position = '1/8'`
    ); // 1/8 -> QUARTER_FINAL (нет старого эквивалента)

    // Возвращаем старый enum
    console.log("Возврат к старому определению enum...");
    await pool.execute(`
      ALTER TABLE tournament_results 
      MODIFY COLUMN cup_position ENUM(
        'WINNER',
        'RUNNER_UP',
        'THIRD_PLACE',
        'SEMI_FINAL',
        'QUARTER_FINAL',
        'QUALIFYING_HIGH',
        'QUALIFYING_LOW',
        'QUALIFYING_ONLY'
      ) NOT NULL DEFAULT 'QUARTER_FINAL'
    `);

    console.log("✅ Откат миграции 006 успешно выполнен");
  } catch (error) {
    console.error("❌ Ошибка при откате миграции 006:", error);
    throw error;
  }
}
