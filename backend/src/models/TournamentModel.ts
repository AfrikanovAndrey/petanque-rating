import { ResultSetHeader, RowDataPacket } from "mysql2";
import { getCupPoints, getPointsByQualifyingStage } from "../config/cupPoints";
import { pool } from "../config/database";
import { calculateWinsAndLoses } from "../services/winsLosesCalculator";
import {
  Cup,
  CupPosition,
  Tournament,
  TournamentCategoryEnum,
  TournamentResult,
  TournamentType,
  TournamentUploadData,
} from "../types";
import { PlayerModel } from "./PlayerModel";
import { TeamModel } from "./TeamModel";

export class TournamentModel {
  static async getAllTournaments(): Promise<Tournament[]> {
    const [rows] = await pool.execute<Tournament[] & RowDataPacket[]>(
      "SELECT * FROM tournaments ORDER BY date DESC"
    );
    return rows;
  }

  static async getTournamentById(id: number): Promise<Tournament | null> {
    const [rows] = await pool.execute<Tournament[] & RowDataPacket[]>(
      "SELECT * FROM tournaments WHERE id = ?",
      [id]
    );
    return rows[0] || null;
  }

  static async createTournament(
    name: string,
    type: TournamentType,
    category: TournamentCategoryEnum,
    teamsCount: number,
    date: string
  ): Promise<number> {
    const [result] = await pool.execute<ResultSetHeader>(
      "INSERT INTO tournaments (name, type, category, teams_count, date) VALUES (?, ?, ?, ?, ?)",
      [name, type, TournamentCategoryEnum[category], teamsCount, date]
    );
    return result.insertId;
  }

  static async deleteTournament(id: number): Promise<boolean> {
    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();

      // Удаляем все результаты турнира
      await connection.execute(
        "DELETE FROM tournament_results WHERE tournament_id = ?",
        [id]
      );

      // Удаляем сам турнир
      const [result] = await connection.execute<ResultSetHeader>(
        "DELETE FROM tournaments WHERE id = ?",
        [id]
      );

      await connection.commit();
      return result.affectedRows > 0;
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }

  static async getTournamentResults(
    tournamentId: number
  ): Promise<TournamentResult[]> {
    const [rows] = await pool.execute<TournamentResult[] & RowDataPacket[]>(
      `
      SELECT 
        tr.*,
        GROUP_CONCAT(p.name ORDER BY p.name SEPARATOR ', ') as team_name,
        t.name as tournament_name,
        t.date as tournament_date,
        GROUP_CONCAT(p.name ORDER BY p.name SEPARATOR ', ') as team_players
      FROM tournament_results tr
      JOIN teams tm ON tr.team_id = tm.id
      JOIN tournaments t ON tr.tournament_id = t.id
      JOIN team_players tp ON tm.id = tp.team_id
      JOIN players p ON tp.player_id = p.id
      WHERE tr.tournament_id = ?
      GROUP BY tr.id, t.name, t.date
      ORDER BY tr.cup_position ASC
    `,
      [tournamentId]
    );
    return rows;
  }

  static ensureValue<T>(value: T | undefined | null, defaultValue: T) {
    return value === undefined || value === null ? defaultValue : value;
  }

  static async addTournamentResult(
    tournamentId: number,
    teamId: number,
    wins: number,
    loses: number,
    cupPosition?: CupPosition,
    cup?: Cup,
    qualifying_wins?: number,
    points?: number
  ): Promise<number> {
    const [result] = await pool.execute<ResultSetHeader>(
      "INSERT INTO tournament_results (tournament_id, team_id, cup, cup_position, qualifying_wins, wins, loses, points) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
      [
        TournamentModel.ensureValue(tournamentId, 0),
        TournamentModel.ensureValue(teamId, 0),
        TournamentModel.ensureValue(cup, null),
        TournamentModel.ensureValue(cupPosition, null),
        TournamentModel.ensureValue(qualifying_wins, 0),
        TournamentModel.ensureValue(wins, 0),
        TournamentModel.ensureValue(loses, 0),
        TournamentModel.ensureValue(points, 0),
      ]
    );
    return result.insertId;
  }

  static async deleteTournamentResult(id: number): Promise<boolean> {
    const [result] = await pool.execute<ResultSetHeader>(
      "DELETE FROM tournament_results WHERE id = ?",
      [id]
    );
    return result.affectedRows > 0;
  }

  // Функция для пересчета очков существующего турнира
  static async recalculatePoints(tournamentId: number): Promise<void> {
    console.log(`🔄 Начинаю пересчет очков для турнира ID: ${tournamentId}`);

    // Получаем информацию о турнире
    const [tournamentRows] = await pool.execute<RowDataPacket[]>(
      "SELECT * FROM tournaments WHERE id = ?",
      [tournamentId]
    );

    if (tournamentRows.length === 0) {
      throw new Error(`Турнир с ID ${tournamentId} не найден`);
    }

    const tournament = tournamentRows[0] as Tournament;
    console.log(`📝 Турнир: "${tournament.name}"`);

    // Получаем все результаты турнира из player_tournament_points
    const [resultsRows] = await pool.execute<RowDataPacket[]>(
      `
      SELECT ptp.id, ptp.cup_position, ptp.cup, ptp.team_id, ptp.points as old_points,
             p.name as player_name, p.id as player_id
      FROM player_tournament_points ptp
      JOIN players p ON ptp.player_id = p.id
      WHERE ptp.tournament_id = ?
      `,
      [tournamentId]
    );

    console.log(`📊 Найдено ${resultsRows.length} результатов для пересчета`);

    for (const result of resultsRows) {
      console.log(
        `\n🔍 Обрабатываем результат ID ${result.id} для игрока "${result.player_name}"`
      );

      // Проверяем, является ли игрок лицензированным
      const [licenseRows] = await pool.execute<RowDataPacket[]>(
        `
        SELECT COUNT(*) as count, GROUP_CONCAT(DISTINCT lp.full_name SEPARATOR ', ') as matched_names
        FROM licensed_players lp
        WHERE lp.year = YEAR(CURDATE()) 
          AND lp.is_active = TRUE 
          AND (
            LOWER(lp.full_name) REGEXP LOWER(CONCAT('\\\\b', SUBSTRING_INDEX(?, ' ', 1), '\\\\b')) OR
            LOWER(lp.full_name) REGEXP LOWER(CONCAT('\\\\b', SUBSTRING_INDEX(?, ' ', -1), '\\\\b'))
          )
        `,
        [result.player_name, result.player_name]
      );

      const isLicensed = licenseRows[0].count > 0;

      let newPoints = 0;

      if (result.cup && isLicensed) {
        const totalTeams = 16; // Используем значение по умолчанию
        const category = "1" as "1" | "2"; // Используем 1 категорию по умолчанию
        const categoryEnum =
          category === "1"
            ? TournamentCategoryEnum.FEDERAL
            : TournamentCategoryEnum.REGIONAL;
        const pointsReason = result.cup_position;

        // Преобразуем cup_position в CupPosition для функции getCupPoints
        let cupPosition: CupPosition;
        switch (pointsReason) {
          case "CUP_WINNER":
            cupPosition = CupPosition.WINNER;
            break;
          case "CUP_RUNNER_UP":
            cupPosition = CupPosition.RUNNER_UP;
            break;
          case "CUP_THIRD_PLACE":
            cupPosition = CupPosition.THIRD_PLACE;
            break;
          case "CUP_SEMI_FINAL":
            cupPosition = CupPosition.SEMI_FINAL;
            break;
          case "CUP_QUARTER_FINAL":
            cupPosition = CupPosition.QUARTER_FINAL;
            break;
          default:
            cupPosition = CupPosition.QUARTER_FINAL;
        }

        console.log(`🎯 Рассчитываем очки:`, {
          cup: result.cup,
          position: cupPosition,
          category,
          totalTeams,
          isLicensed,
        });

        if (isLicensed) {
          if (result.cup) {
            // Лицензированная команда в кубке получает очки за место в кубке
            newPoints = getCupPoints(
              category,
              result.cup,
              cupPosition,
              totalTeams
            );
          } else {
            // Лицензированная команда НЕ в кубке получает очки за победы в швейцарке
            let qualifying_wins = 0;
            try {
              const [winsRow] = await pool.execute<RowDataPacket[]>(
                "SELECT qualifying_wins FROM tournament_results WHERE id = ?",
                [result.id]
              );

              if (winsRow && winsRow.length > 0) {
                qualifying_wins = winsRow[0].qualifying_wins || 0;
              }
            } catch (error) {
              console.warn(
                `Ошибка при получении побед для результата ${result.id}:`,
                error
              );
              qualifying_wins = 0; // Используем 0 при ошибке
            }

            newPoints = getPointsByQualifyingStage(
              categoryEnum,
              qualifying_wins
            );
          }
        } else {
          // Нелицензированная команда не получает очки
          newPoints = 0;
        }

        console.log(
          `📈 Старые очки: ${result.old_points}, новые очки: ${newPoints}`
        );
      } else {
        console.log(`⚠️ Игрок "${result.player_name}" не получает очки:`, {
          hasCup: !!result.cup,
          isLicensed,
          cup: result.cup,
        });
      }

      // Обновляем очки в базе player_tournament_points
      await pool.execute(
        "UPDATE player_tournament_points SET points = ? WHERE id = ?",
        [newPoints, result.id]
      );
    }

    console.log(`✅ Пересчет очков для турнира "${tournament.name}" завершен`);
  }

  static async getTournamentWithResults(id: number): Promise<{
    tournament: Tournament;
    results: TournamentResult[];
  } | null> {
    const tournament = await this.getTournamentById(id);
    if (!tournament) return null;

    const results = await this.getTournamentResults(id);
    return { tournament, results };
  }

  // Методы для работы с кубками

  static async getCupResults(): Promise<TournamentResult[]> {
    const [rows] = await pool.execute<TournamentResult[] & RowDataPacket[]>(
      `
      SELECT 
        tr.*,
        GROUP_CONCAT(p.name ORDER BY p.name SEPARATOR ', ') as team_name,
        t.name as tournament_name,
        t.date as tournament_date,
        GROUP_CONCAT(p.name ORDER BY p.name SEPARATOR ', ') as team_players
      FROM tournament_results tr
      JOIN teams tm ON tr.team_id = tm.id
      JOIN tournaments t ON tr.tournament_id = t.id
      JOIN team_players tp ON tm.id = tp.team_id
      JOIN players p ON tp.player_id = p.id
      WHERE tr.cup IS NOT NULL
      GROUP BY tr.id, t.name, t.date
      ORDER BY t.date DESC, tr.cup, tr.cup_position
      `
    );
    return rows;
  }

  static async getCupResultsByTournament(
    tournamentId: number
  ): Promise<TournamentResult[]> {
    const [rows] = await pool.execute<TournamentResult[] & RowDataPacket[]>(
      `
      SELECT 
        tr.*,
        GROUP_CONCAT(p.name ORDER BY p.name SEPARATOR ', ') as team_name,
        t.name as tournament_name,
        t.date as tournament_date,
        GROUP_CONCAT(p.name ORDER BY p.name SEPARATOR ', ') as team_players
      FROM tournament_results tr
      JOIN teams tm ON tr.team_id = tm.id
      JOIN tournaments t ON tr.tournament_id = t.id
      JOIN team_players tp ON tm.id = tp.team_id
      JOIN players p ON tp.player_id = p.id
      WHERE tr.tournament_id = ? AND tr.cup IS NOT NULL
      GROUP BY tr.id, t.name, t.date
      ORDER BY tr.cup, tr.cup_position
      `,
      [tournamentId]
    );
    return rows;
  }

  static async getCupResultsByCup(
    tournamentId: number,
    cup: string
  ): Promise<TournamentResult[]> {
    const [rows] = await pool.execute<TournamentResult[] & RowDataPacket[]>(
      `
      SELECT 
        tr.*,
        GROUP_CONCAT(p.name ORDER BY p.name SEPARATOR ', ') as team_name,
        GROUP_CONCAT(p.name ORDER BY p.name SEPARATOR ', ') as team_players
      FROM tournament_results tr
      JOIN teams tm ON tr.team_id = tm.id
      JOIN team_players tp ON tm.id = tp.team_id
      JOIN players p ON tp.player_id = p.id
      WHERE tr.tournament_id = ? AND tr.cup = ?
      GROUP BY tr.id
      ORDER BY tr.cup_position
      `,
      [tournamentId, cup]
    );
    return rows;
  }
}
