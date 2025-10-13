import { ResultSetHeader, RowDataPacket } from "mysql2";
import { pool } from "../config/database";
import { LicensedPlayer, LicensedPlayerUploadData } from "../types";

export class LicensedPlayerModel {
  // Получить всех лицензионных игроков с именами игроков
  static async getAllLicensedPlayers(
    year?: number
  ): Promise<(LicensedPlayer & { player_name: string })[]> {
    const query = year
      ? `SELECT lp.*, p.name as player_name 
         FROM licensed_players lp 
         LEFT JOIN players p ON lp.player_id = p.id 
         WHERE lp.year = ? 
         ORDER BY p.name`
      : `SELECT lp.*, p.name as player_name 
         FROM licensed_players lp 
         LEFT JOIN players p ON lp.player_id = p.id 
         ORDER BY lp.year DESC, p.name`;
    const params = year ? [year] : [];

    const [rows] = await pool.execute<
      (LicensedPlayer & { player_name: string })[] & RowDataPacket[]
    >(query, params);
    return rows;
  }

  // Получить активных лицензионных игроков текущего года
  static async getActiveLicensedPlayers(
    year: number = new Date().getFullYear()
  ): Promise<(LicensedPlayer & { player_name: string })[]> {
    const [rows] = await pool.execute<
      (LicensedPlayer & { player_name: string })[] & RowDataPacket[]
    >(
      `SELECT lp.*, p.name as player_name 
       FROM licensed_players lp 
       LEFT JOIN players p ON lp.player_id = p.id 
       WHERE lp.year = ? AND lp.is_active = TRUE 
       ORDER BY p.name`,
      [year]
    );
    return rows;
  }

  // Получить лицензионного игрока по ID
  static async getLicensedPlayerById(
    id: number
  ): Promise<(LicensedPlayer & { player_name: string }) | null> {
    const [rows] = await pool.execute<
      (LicensedPlayer & { player_name: string })[] & RowDataPacket[]
    >(
      `SELECT lp.*, p.name as player_name 
       FROM licensed_players lp 
       LEFT JOIN players p ON lp.player_id = p.id 
       WHERE lp.id = ?`,
      [id]
    );
    return rows[0] || null;
  }

  // Добавить нового лицензионного игрока
  static async addLicensedPlayer(
    playerData: LicensedPlayerUploadData
  ): Promise<number> {
    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();

      // 1. Создаем или находим игрока в таблице players
      let playerId: number;

      const [existingPlayer] = await connection.execute<RowDataPacket[]>(
        "SELECT id FROM players WHERE LOWER(TRIM(name)) = LOWER(TRIM(?))",
        [playerData.player_name]
      );

      if (existingPlayer.length > 0) {
        playerId = existingPlayer[0].id;
        // Обновляем город игрока
        await connection.execute("UPDATE players SET city = ? WHERE id = ?", [
          playerData.city,
          playerId,
        ]);
      } else {
        const [insertResult] = await connection.execute<ResultSetHeader>(
          "INSERT INTO players (name, city) VALUES (?, ?)",
          [playerData.player_name, playerData.city]
        );
        playerId = insertResult.insertId;
      }

      // 2. Добавляем лицензионного игрока
      const [result] = await connection.execute<ResultSetHeader>(
        `INSERT INTO licensed_players (player_id, license_number, city, license_date, year, is_active) 
         VALUES (?, ?, ?, ?, ?, ?)`,
        [
          playerId,
          playerData.license_number,
          playerData.city,
          playerData.license_date,
          playerData.year,
          true,
        ]
      );

      await connection.commit();
      return result.insertId;
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }

  // Обновить лицензионного игрока
  static async updateLicensedPlayer(
    id: number,
    playerData: Partial<LicensedPlayerUploadData>
  ): Promise<boolean> {
    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();

      let playerId: number | undefined;

      // Если обновляется имя игрока, работаем с таблицей players
      if (playerData.player_name !== undefined) {
        // Получаем текущий player_id
        const [currentRecord] = await connection.execute<RowDataPacket[]>(
          "SELECT player_id FROM licensed_players WHERE id = ?",
          [id]
        );

        if (currentRecord.length === 0) {
          throw new Error("Лицензионный игрок не найден");
        }

        const currentPlayerId = currentRecord[0].player_id;

        // Проверяем, есть ли игрок с новым именем
        const [existingPlayer] = await connection.execute<RowDataPacket[]>(
          "SELECT id FROM players WHERE LOWER(TRIM(name)) = LOWER(TRIM(?))",
          [playerData.player_name]
        );

        if (existingPlayer.length > 0) {
          playerId = existingPlayer[0].id;
        } else {
          // Обновляем имя существующего игрока или создаем нового
          // Проверяем, не используется ли текущий player_id в других местах
          const [playerUsage] = await connection.execute<RowDataPacket[]>(
            `SELECT COUNT(*) as count FROM (
              SELECT player_id FROM licensed_players WHERE player_id = ? AND id != ?
              UNION ALL
              SELECT player_id FROM team_players WHERE player_id = ?
            ) as usage_count`,
            [currentPlayerId, id, currentPlayerId]
          );

          if (playerUsage[0].count === 0) {
            // Можно обновить существующего игрока
            await connection.execute(
              "UPDATE players SET name = ?, city = ? WHERE id = ?",
              [playerData.player_name, playerData.city || null, currentPlayerId]
            );
            playerId = currentPlayerId;
          } else {
            // Нужно создать нового игрока
            const [insertResult] = await connection.execute<ResultSetHeader>(
              "INSERT INTO players (name, city) VALUES (?, ?)",
              [playerData.player_name, playerData.city || null]
            );
            playerId = insertResult.insertId;
          }
        }
      }

      // Обновляем запись в licensed_players
      const fields: string[] = [];
      const values: any[] = [];

      if (playerId !== undefined) {
        fields.push("player_id = ?");
        values.push(playerId);
      }
      if (playerData.license_number !== undefined) {
        fields.push("license_number = ?");
        values.push(playerData.license_number);
      }
      if (playerData.city !== undefined) {
        fields.push("city = ?");
        values.push(playerData.city);
      }
      if (playerData.license_date !== undefined) {
        fields.push("license_date = ?");
        values.push(playerData.license_date);
      }
      if (playerData.year !== undefined) {
        fields.push("year = ?");
        values.push(playerData.year);
      }

      if (fields.length > 0) {
        values.push(id);
        const [result] = await connection.execute<ResultSetHeader>(
          `UPDATE licensed_players SET ${fields.join(", ")} WHERE id = ?`,
          values
        );

        await connection.commit();
        return result.affectedRows > 0;
      }

      await connection.commit();
      return false;
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }

  // Удалить лицензионного игрока
  static async deleteLicensedPlayer(id: number): Promise<boolean> {
    const [result] = await pool.execute<ResultSetHeader>(
      "DELETE FROM licensed_players WHERE id = ?",
      [id]
    );
    return result.affectedRows > 0;
  }

  // Загрузить лицензионных игроков массово
  static async uploadLicensedPlayers(
    playersData: LicensedPlayerUploadData[],
    replaceExisting: boolean = false
  ): Promise<{
    success: number;
    created: number;
    updated: number;
    errors: Array<{ player: LicensedPlayerUploadData; error: string }>;
  }> {
    const connection = await pool.getConnection();
    let success = 0;
    let created = 0;
    let updated = 0;
    const errors: Array<{ player: LicensedPlayerUploadData; error: string }> =
      [];

    try {
      await connection.beginTransaction();

      for (const player of playersData) {
        try {
          // Проверяем обязательные поля
          if (
            !player.license_number ||
            !player.player_name ||
            !player.city ||
            !player.license_date ||
            !player.year
          ) {
            errors.push({
              player,
              error: "Отсутствуют обязательные поля",
            });
            continue;
          }

          // Создаем или находим игрока
          let playerId: number;

          const [existingPlayer] = await connection.execute<RowDataPacket[]>(
            "SELECT id FROM players WHERE LOWER(TRIM(name)) = LOWER(TRIM(?))",
            [player.player_name]
          );

          if (existingPlayer.length > 0) {
            playerId = existingPlayer[0].id;
            // Обновляем город игрока при массовой загрузке
            await connection.execute(
              "UPDATE players SET city = ? WHERE id = ?",
              [player.city, playerId]
            );
          } else {
            const [insertResult] = await connection.execute<ResultSetHeader>(
              "INSERT INTO players (name, city) VALUES (?, ?)",
              [player.player_name, player.city]
            );
            playerId = insertResult.insertId;
          }

          // Проверяем, не существует ли уже такая лицензия
          const [existingLicense] = await connection.execute<RowDataPacket[]>(
            "SELECT id FROM licensed_players WHERE license_number = ?",
            [player.license_number]
          );

          if (existingLicense.length > 0) {
            if (replaceExisting) {
              // Обновляем существующую лицензию
              await connection.execute(
                `UPDATE licensed_players 
                 SET player_id = ?, city = ?, license_date = ?, year = ?, is_active = TRUE, updated_at = CURRENT_TIMESTAMP
                 WHERE license_number = ?`,
                [
                  playerId,
                  player.city,
                  player.license_date,
                  player.year,
                  player.license_number,
                ]
              );
              updated++;
              success++;
            } else {
              errors.push({
                player,
                error: `Лицензия ${player.license_number} уже существует`,
              });
              continue;
            }
          } else {
            // Добавляем нового лицензионного игрока
            await connection.execute(
              `INSERT INTO licensed_players (player_id, license_number, city, license_date, year, is_active) 
               VALUES (?, ?, ?, ?, ?, TRUE)`,
              [
                playerId,
                player.license_number,
                player.city,
                player.license_date,
                player.year,
              ]
            );
            created++;
            success++;
          }
        } catch (error: any) {
          console.error(
            `Ошибка при обработке игрока "${player.player_name}" (строка ${
              playersData.indexOf(player) + 1
            }):`,
            error
          );
          errors.push({
            player,
            error: error.message || "Неизвестная ошибка",
          });
        }
      }

      await connection.commit();
      console.log(
        `✅ Загружено ${success} игроков (создано: ${created}, обновлено: ${updated}), ошибок: ${errors.length}`
      );

      return { success, created, updated, errors };
    } catch (error) {
      await connection.rollback();
      console.error("❌ Ошибка при загрузке лицензионных игроков:", error);
      throw error;
    } finally {
      connection.release();
    }
  }

  // Получить лицензионного игрока по номеру лицензии
  static async getLicensedPlayerByLicenseNumber(
    licenseNumber: string
  ): Promise<LicensedPlayer | null> {
    const [rows] = await pool.execute<LicensedPlayer[] & RowDataPacket[]>(
      "SELECT * FROM licensed_players WHERE license_number = ?",
      [licenseNumber]
    );
    return rows[0] || null;
  }

  // Получить годы для которых есть лицензионные игроки
  static async getAvailableYears(): Promise<number[]> {
    const [rows] = await pool.execute<RowDataPacket[]>(
      "SELECT DISTINCT year FROM licensed_players ORDER BY year DESC"
    );
    return rows.map((row: any) => row.year);
  }

  // Получить статистику по лицензионным игрокам
  static async getStatistics(year: number = new Date().getFullYear()): Promise<{
    total: number;
    active: number;
    cities: { city: string; count: number }[];
  }> {
    const [totalRows] = await pool.execute<RowDataPacket[]>(
      "SELECT COUNT(*) as count FROM licensed_players WHERE year = ?",
      [year]
    );

    const [activeRows] = await pool.execute<RowDataPacket[]>(
      "SELECT COUNT(*) as count FROM licensed_players WHERE year = ? AND is_active = TRUE",
      [year]
    );

    const [citiesRows] = await pool.execute<RowDataPacket[]>(
      `SELECT city, COUNT(*) as count 
       FROM licensed_players 
       WHERE year = ? AND is_active = TRUE 
       GROUP BY city 
       ORDER BY count DESC`,
      [year]
    );

    return {
      total: (totalRows[0] as any).count,
      active: (activeRows[0] as any).count,
      cities: citiesRows as { city: string; count: number }[],
    };
  }
}
