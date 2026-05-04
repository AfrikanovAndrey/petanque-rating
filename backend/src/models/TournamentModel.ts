import { PoolConnection, ResultSetHeader, RowDataPacket } from "mysql2/promise";
import { getPoints } from "../config/cupPoints";
import { pool } from "../config/database";

import {
  Cup,
  CupPosition,
  Tournament,
  TournamentCategoryEnum,
  TournamentResult,
  TournamentStatus,
  TournamentType,
} from "../types";

export class TournamentModel {
  /**
   * Нормализовать дату к формату YYYY-MM-DD для SQL запросов
   */
  private static normalizeDateForSQL(date: string | Date): string {
    if (date instanceof Date) {
      // Преобразуем Date в строку YYYY-MM-DD
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, "0");
      const day = String(date.getDate()).padStart(2, "0");
      return `${year}-${month}-${day}`;
    }
    // Если уже строка, возвращаем как есть
    return date;
  }

  /**
   * Список турниров. Поле teams_count: для DRAFT / REGISTRATION / IN_PROGRESS — число
   * подтверждённых заявок (tournament_registrations.is_confirmed = 1);
   * для FINISHED — по tournament_results.
   */
  static async getAllTournaments(): Promise<Tournament[]> {
    const [rows] = await pool.execute<Tournament[] & RowDataPacket[]>(
      `SELECT
        t.*,
        CASE
          WHEN t.status IN ('DRAFT', 'REGISTRATION', 'IN_PROGRESS') THEN COALESCE(reg.cnt, 0)
          ELSE COALESCE(res.cnt, 0)
        END AS teams_count
      FROM tournaments t
      LEFT JOIN (
        SELECT tournament_id, COUNT(DISTINCT team_id) AS cnt
        FROM tournament_registrations
        WHERE is_confirmed = 1
        GROUP BY tournament_id
      ) reg ON reg.tournament_id = t.id
      LEFT JOIN (
        SELECT tournament_id, COUNT(DISTINCT team_id) AS cnt
        FROM tournament_results
        GROUP BY tournament_id
      ) res ON res.tournament_id = t.id
      ORDER BY t.date DESC`,
    );
    return rows;
  }

  static async getTournamentById(id: number): Promise<Tournament | null> {
    const [rows] = await pool.execute<Tournament[] & RowDataPacket[]>(
      "SELECT * FROM tournaments WHERE id = ?",
      [id],
    );
    return rows[0] || null;
  }

  static async getTournamentTeamsCount(tournamentId: number): Promise<number> {
    const [rows] = await pool.execute<RowDataPacket[]>(
      "SELECT COUNT(DISTINCT team_id) as teams_count FROM tournament_results WHERE tournament_id = ?",
      [tournamentId],
    );
    return (rows[0]?.teams_count as number) || 0;
  }

  static async createTournament(
    name: string,
    type: TournamentType,
    category: TournamentCategoryEnum,
    date: string,
    manual: boolean = false,
    connection?: PoolConnection,
    regulations: string | null = null,
    tournamentStatus: TournamentStatus = TournamentStatus.FINISHED,
  ): Promise<number> {
    const executor = connection || pool;
    const [result] = await executor.execute<ResultSetHeader>(
      "INSERT INTO tournaments (name, type, category, date, manual, status, regulations) VALUES (?, ?, ?, ?, ?, ?, ?)",
      [
        name,
        type,
        TournamentCategoryEnum[category],
        date,
        manual,
        tournamentStatus,
        regulations,
      ],
    );
    return result.insertId;
  }

  static async updateTournament(
    id: number,
    name?: string,
    type?: TournamentType,
    category?: TournamentCategoryEnum | string | number,
    date?: string,
    manual?: boolean,
    status?: TournamentStatus,
    regulations?: string | null,
  ): Promise<boolean> {
    const updates: string[] = [];
    const values: any[] = [];

    if (name !== undefined) {
      updates.push("name = ?");
      values.push(name);
    }
    if (type !== undefined) {
      updates.push("type = ?");
      values.push(type);
    }
    if (category !== undefined) {
      updates.push("category = ?");
      const raw = category as string | number;
      let member: TournamentCategoryEnum;
      if (raw === "1" || raw === 1 || raw === "FEDERAL") {
        member = TournamentCategoryEnum.FEDERAL;
      } else if (raw === "2" || raw === 2 || raw === "REGIONAL") {
        member = TournamentCategoryEnum.REGIONAL;
      } else {
        member = raw as TournamentCategoryEnum;
      }
      values.push(TournamentCategoryEnum[member]);
    }
    if (date !== undefined) {
      updates.push("date = ?");
      values.push(date);
    }
    if (manual !== undefined) {
      updates.push("manual = ?");
      values.push(manual);
    }
    if (status !== undefined) {
      updates.push("status = ?");
      values.push(status);
    }
    if (regulations !== undefined) {
      updates.push("regulations = ?");
      values.push(regulations);
    }

    if (updates.length === 0) {
      return false; // Нет данных для обновления
    }

    values.push(id);
    const [result] = await pool.execute<ResultSetHeader>(
      `UPDATE tournaments SET ${updates.join(", ")} WHERE id = ?`,
      values,
    );

    return result.affectedRows > 0;
  }

  static async deleteTournament(id: number): Promise<boolean> {
    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();

      // Удаляем все результаты турнира
      await connection.execute(
        "DELETE FROM tournament_results WHERE tournament_id = ?",
        [id],
      );

      // Удаляем сам турнир
      const [result] = await connection.execute<ResultSetHeader>(
        "DELETE FROM tournaments WHERE id = ?",
        [id],
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
    tournamentId: number,
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
      [tournamentId],
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
    points?: number,
    connection?: PoolConnection,
  ): Promise<number> {
    const executor = connection || pool;
    const [result] = await executor.execute<ResultSetHeader>(
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
      ],
    );
    return result.insertId;
  }

  static async deleteTournamentResult(id: number): Promise<boolean> {
    const [result] = await pool.execute<ResultSetHeader>(
      "DELETE FROM tournament_results WHERE id = ?",
      [id],
    );
    return result.affectedRows > 0;
  }

  /**
   * Пересчитать очки для конкретного турнира
   */
  static async recalculateTournamentPoints(
    tournamentId: number,
  ): Promise<void> {
    console.log(`🔄 Пересчитываю очки для турнира ID ${tournamentId}`);

    // Получаем информацию о турнире
    const tournament = await TournamentModel.getTournamentById(tournamentId);
    if (!tournament) {
      throw new Error(`Турнир с ID ${tournamentId} не найден`);
    }

    // Пропускаем турниры с ручным вводом данных
    if (tournament.manual) {
      console.log(
        `⏭️  Пропускаю турнир #${tournamentId} "${tournament.name}" - результаты введены вручную`,
      );
      return;
    }

    // Получаем все результаты турнира
    const [resultsRows] = await pool.execute<RowDataPacket[]>(
      `
      SELECT 
        tr.id, 
        tr.cup_position, 
        tr.cup, 
        tr.team_id, 
        tr.qualifying_wins,
        tr.points as old_points,
        (SELECT COUNT(*) FROM team_players tp WHERE tp.team_id = tr.team_id) AS team_player_count
      FROM tournament_results tr
      WHERE tr.tournament_id = ?
      `,
      [tournamentId],
    );

    const tournamentType: TournamentType =
      TournamentType[tournament.type as keyof typeof TournamentType];

    // Получаем эффективное количество команд
    // Нормализуем дату для корректного поиска парного турнира
    const normalizedDate = TournamentModel.normalizeDateForSQL(tournament.date);
    const totalTeams = await TournamentModel.getEffectiveTeamsCount(
      tournamentId,
      normalizedDate,
      tournament.type,
    );

    const categoryEnum =
      tournament.category === "FEDERAL"
        ? TournamentCategoryEnum.FEDERAL
        : TournamentCategoryEnum.REGIONAL;

    for (const result of resultsRows) {
      let newPoints = 0;

      let cupPosition: CupPosition | undefined;
      switch (result.cup_position) {
        case "1":
        case "WINNER":
          cupPosition = CupPosition.WINNER;
          break;
        case "2":
        case "RUNNER_UP":
          cupPosition = CupPosition.RUNNER_UP;
          break;
        case "3":
        case "THIRD_PLACE":
          cupPosition = CupPosition.THIRD_PLACE;
          break;
        case "1/2":
        case "SEMI_FINAL":
        case "ROUND_OF_4":
          cupPosition = CupPosition.ROUND_OF_4;
          break;
        case "1/4":
        case "QUARTER_FINAL":
        case "ROUND_OF_8":
          cupPosition = CupPosition.ROUND_OF_8;
          break;
        case "1/8":
        case "ROUND_OF_16":
          cupPosition = CupPosition.ROUND_OF_16;
          break;
        default:
          cupPosition = undefined;
      }

      newPoints = getPoints(
        tournamentType,
        categoryEnum,
        result.cup,
        cupPosition,
        totalTeams,
        result.qualifying_wins,
        Number(result.team_player_count),
      );

      // Обновляем очки в базе tournament_results
      await pool.execute(
        "UPDATE tournament_results SET points = ? WHERE id = ?",
        [newPoints, result.id],
      );
    }

    console.log(`✅ Очки для турнира ID ${tournamentId} пересчитаны`);
  }

  /**
   * Получить эффективное количество команд для расчёта очков
   * Если в один день прошли DOUBLETTE_MALE и DOUBLETTE_FEMALE, или TET_A_TET_MALE и TET_A_TET_FEMALE, суммируем команды
   */
  static async getEffectiveTeamsCount(
    tournamentId: number,
    tournamentDate: string,
    tournamentType: TournamentType,
  ): Promise<number> {
    // Получаем количество команд текущего турнира
    const currentTournamentTeams =
      await TournamentModel.getTournamentTeamsCount(tournamentId);

    // Проверяем, является ли турнир DOUBLETTE_MALE/FEMALE или TET_A_TET_MALE/FEMALE
    const isDoublette =
      tournamentType === TournamentType.DOUBLETTE_MALE ||
      tournamentType === TournamentType.DOUBLETTE_FEMALE;

    const isTetATet =
      tournamentType === TournamentType.TET_A_TET_MALE ||
      tournamentType === TournamentType.TET_A_TET_FEMALE;

    if (!isDoublette && !isTetATet) {
      // Для других типов турниров просто возвращаем количество команд
      return currentTournamentTeams;
    }

    // Определяем парный тип турнира
    let pairType: TournamentType;
    if (isDoublette) {
      pairType =
        tournamentType === TournamentType.DOUBLETTE_MALE
          ? TournamentType.DOUBLETTE_FEMALE
          : TournamentType.DOUBLETTE_MALE;
    } else {
      pairType =
        tournamentType === TournamentType.TET_A_TET_MALE
          ? TournamentType.TET_A_TET_FEMALE
          : TournamentType.TET_A_TET_MALE;
    }

    const [pairTournaments] = await pool.execute<RowDataPacket[]>(
      `SELECT id FROM tournaments 
       WHERE date = ? AND type = ? AND id != ?`,
      [tournamentDate, pairType, tournamentId],
    );

    if (pairTournaments.length > 0) {
      // Найден парный турнир, суммируем команды
      const pairTournamentId = pairTournaments[0].id;
      const pairTournamentTeams =
        await TournamentModel.getTournamentTeamsCount(pairTournamentId);
      const totalTeams = currentTournamentTeams + pairTournamentTeams;

      console.log(
        `   🔗 Найден парный турнир (${pairType}) в тот же день. Суммируем команды: ${currentTournamentTeams} + ${pairTournamentTeams} = ${totalTeams}`,
      );

      return totalTeams;
    }

    // Парный турнир не найден, возвращаем количество команд текущего турнира
    return currentTournamentTeams;
  }

  // Функция для пересчета очков всех турниров текущего календарного года
  static async recalculatePoints(): Promise<void> {
    const currentYear = new Date().getFullYear();
    console.log(`🔄 Начинаю пересчет очков для турниров ${currentYear} года`);

    // Получаем только турниры текущего календарного года
    const [tournamentRows] = await pool.execute<RowDataPacket[]>(
      "SELECT id, name, manual FROM tournaments WHERE YEAR(date) = ? ORDER BY id",
      [currentYear],
    );

    console.log(
      `📊 Найдено ${tournamentRows.length} турниров ${currentYear} года для пересчета`,
    );

    let skippedCount = 0;
    let processedCount = 0;

    for (const tournamentRow of tournamentRows) {
      const tournament = tournamentRow as {
        id: number;
        name: string;
        manual: boolean;
      };

      console.log(
        `\n📝 Обрабатываю турнир ID ${tournament.id}: "${tournament.name}"`,
      );

      // Пропускаем турниры с ручным вводом
      if (tournament.manual) {
        console.log(
          `   ⏭️  Пропускаю турнир "${tournament.name}" - результаты введены вручную`,
        );
        skippedCount++;
        continue;
      }

      // Используем централизованную функцию пересчёта для каждого турнира
      await TournamentModel.recalculateTournamentPoints(tournament.id);
      processedCount++;

      console.log(
        `   ✅ Пересчет очков для турнира "${tournament.name}" завершен`,
      );
    }

    console.log(
      `\n🎉 Пересчет очков за ${currentYear} год завершен! Обработано: ${processedCount}, пропущено: ${skippedCount}`,
    );
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
      `,
    );
    return rows;
  }

  static async getCupResultsByTournament(
    tournamentId: number,
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
      [tournamentId],
    );
    return rows;
  }

  static async getCupResultsByCup(
    tournamentId: number,
    cup: string,
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
      [tournamentId, cup],
    );
    return rows;
  }
}
