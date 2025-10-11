import { pool } from "../config/database";
import { LicensedPlayer, LicensedPlayerUploadData } from "../types";
import { ResultSetHeader, RowDataPacket } from "mysql2";

export class LicensedPlayerModel {
  // Получить всех лицензионных игроков
  static async getAllLicensedPlayers(year?: number): Promise<LicensedPlayer[]> {
    const query = year
      ? "SELECT * FROM licensed_players WHERE year = ? ORDER BY full_name"
      : "SELECT * FROM licensed_players ORDER BY year DESC, full_name";
    const params = year ? [year] : [];

    const [rows] = await pool.execute<LicensedPlayer[] & RowDataPacket[]>(
      query,
      params
    );
    return rows;
  }

  // Получить активных лицензионных игроков текущего года
  static async getActiveLicensedPlayers(
    year: number = new Date().getFullYear()
  ): Promise<LicensedPlayer[]> {
    const [rows] = await pool.execute<LicensedPlayer[] & RowDataPacket[]>(
      "SELECT * FROM licensed_players WHERE year = ? AND is_active = TRUE ORDER BY full_name",
      [year]
    );
    return rows;
  }

  // Получить лицензионного игрока по ID
  static async getLicensedPlayerById(
    id: number
  ): Promise<LicensedPlayer | null> {
    const [rows] = await pool.execute<LicensedPlayer[] & RowDataPacket[]>(
      "SELECT * FROM licensed_players WHERE id = ?",
      [id]
    );
    return rows[0] || null;
  }

  // Проверить является ли игрок лицензированным (по имени)
  static async isPlayerLicensed(
    playerName: string,
    year: number = new Date().getFullYear()
  ): Promise<boolean> {
    const [rows] = await pool.execute<RowDataPacket[]>(
      "SELECT COUNT(*) as count FROM licensed_players WHERE full_name = ? AND year = ? AND is_active = TRUE",
      [playerName, year]
    );
    return (rows[0] as any).count > 0;
  }

  // Создать лицензионного игрока
  static async createLicensedPlayer(
    playerData: LicensedPlayerUploadData
  ): Promise<number> {
    const [result] = await pool.execute<ResultSetHeader>(
      `INSERT INTO licensed_players (license_number, full_name, city, license_date, year, is_active) 
       VALUES (?, ?, ?, ?, ?, TRUE)`,
      [
        playerData.license_number,
        playerData.full_name,
        playerData.city,
        playerData.license_date,
        playerData.year,
      ]
    );
    return result.insertId;
  }

  // Обновить лицензионного игрока
  static async updateLicensedPlayer(
    id: number,
    playerData: Partial<LicensedPlayerUploadData & { is_active: boolean }>
  ): Promise<boolean> {
    const fields = [];
    const values = [];

    if (playerData.license_number !== undefined) {
      fields.push("license_number = ?");
      values.push(playerData.license_number);
    }
    if (playerData.full_name !== undefined) {
      fields.push("full_name = ?");
      values.push(playerData.full_name);
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
    if (playerData.is_active !== undefined) {
      fields.push("is_active = ?");
      values.push(playerData.is_active);
    }

    if (fields.length === 0) {
      return false;
    }

    values.push(id);

    const [result] = await pool.execute<ResultSetHeader>(
      `UPDATE licensed_players SET ${fields.join(", ")} WHERE id = ?`,
      values
    );
    return result.affectedRows > 0;
  }

  // Удалить лицензионного игрока
  static async deleteLicensedPlayer(id: number): Promise<boolean> {
    const [result] = await pool.execute<ResultSetHeader>(
      "DELETE FROM licensed_players WHERE id = ?",
      [id]
    );
    return result.affectedRows > 0;
  }

  // Деактивировать всех игроков определенного года
  static async deactivatePlayersForYear(year: number): Promise<void> {
    await pool.execute(
      "UPDATE licensed_players SET is_active = FALSE WHERE year = ?",
      [year]
    );
  }

  // Загрузка списка лицензионных игроков
  static async uploadLicensedPlayers(
    players: LicensedPlayerUploadData[],
    replaceExisting: boolean = false
  ): Promise<{ created: number; updated: number; errors: string[] }> {
    const results = {
      created: 0,
      updated: 0,
      errors: [] as string[],
    };

    if (replaceExisting && players.length > 0) {
      // Деактивируем всех игроков этого года
      await this.deactivatePlayersForYear(players[0].year);
    }

    for (let i = 0; i < players.length; i++) {
      const player = players[i];
      try {
        // Проверяем существует ли игрок с таким номером лицензии
        const existing = await this.getLicensedPlayerByLicenseNumber(
          player.license_number
        );

        if (existing) {
          // Обновляем существующего
          const updated = await this.updateLicensedPlayer(existing.id, {
            ...player,
            is_active: true,
          });
          if (updated) {
            results.updated++;
          }
        } else {
          // Создаем нового
          await this.createLicensedPlayer(player);
          results.created++;
        }
      } catch (error) {
        results.errors.push(
          `Ошибка при обработке игрока "${player.full_name}" (строка ${
            i + 1
          }): ${error instanceof Error ? error.message : "Неизвестная ошибка"}`
        );
      }
    }

    return results;
  }
}
