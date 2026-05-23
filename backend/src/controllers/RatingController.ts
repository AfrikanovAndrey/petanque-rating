import { Request, Response } from "express";
import { pool } from "../config/database";
import { RowDataPacket } from "mysql2";
import { LicensedPlayerModel } from "../models/LicensedPlayerModel";
import { PlayerModel } from "../models/PlayerModel";
import { RatingTableRow } from "../types";

type RatingDateContext = {
  refDateStr: string;
  minDateStr: string;
  refYear: number;
};

export class RatingController {
  private static todayDateStr(): string {
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, "0");
    const d = String(now.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  }

  private static subtractDaysFromDateStr(
    dateStr: string,
    days: number
  ): string {
    const [y, m, d] = dateStr.split("-").map(Number);
    const date = new Date(Date.UTC(y, m - 1, d));
    date.setUTCDate(date.getUTCDate() - days);
    return date.toISOString().slice(0, 10);
  }

  /** Параметр query `date` (YYYY-MM-DD): дата расчёта рейтинга; окно турниров — 365 дней до неё включительно */
  private static parseRatingDateContext(
    req: Request
  ): { ok: true; ctx: RatingDateContext } | { ok: false; message: string } {
    const raw = (req.query.date as string | undefined)?.trim();
    const refDateStr = raw && raw.length > 0 ? raw : RatingController.todayDateStr();

    if (!/^\d{4}-\d{2}-\d{2}$/.test(refDateStr)) {
      return {
        ok: false,
        message: "Неверный формат даты. Используйте YYYY-MM-DD",
      };
    }

    const [y, m, d] = refDateStr.split("-").map(Number);
    const parsed = new Date(Date.UTC(y, m - 1, d));
    if (
      parsed.getUTCFullYear() !== y ||
      parsed.getUTCMonth() !== m - 1 ||
      parsed.getUTCDate() !== d
    ) {
      return { ok: false, message: "Некорректная дата" };
    }

    const todayStr = RatingController.todayDateStr();
    if (refDateStr > todayStr) {
      return {
        ok: false,
        message: "Дата расчёта рейтинга не может быть в будущем",
      };
    }

    return {
      ok: true,
      ctx: {
        refDateStr,
        minDateStr: RatingController.subtractDaysFromDateStr(refDateStr, 365),
        refYear: y,
      },
    };
  }

  // Получить количество лучших результатов для расчёта суммы рейтинга
  private static async getBestResultsCount(
    refYear: number,
    asOfDateStr: string
  ): Promise<number> {
    const [tournamentsRows] = await pool.execute<RowDataPacket[]>(
      "SELECT COUNT(*) as count FROM tournaments WHERE YEAR(date) = ? AND date <= ?",
      [refYear, asOfDateStr]
    );
    const hasTournamentsThisYear = (tournamentsRows[0] as any).count > 0;

    const yearToUse = hasTournamentsThisYear ? refYear : refYear - 1;

    const [settingsRows] = await pool.execute<RowDataPacket[]>(
      'SELECT setting_value FROM rating_settings WHERE setting_name = "best_results_count" AND year = ?',
      [yearToUse]
    );
    return parseInt(settingsRows[0]?.setting_value || "8");
  }

  // Получить таблицу рейтинга (публичный доступ) по tournament_results, агрегируя по игрокам через их команды
  static async getRatingTable(req: Request, res: Response): Promise<void> {
    try {
      const asOfDateStr = RatingController.todayDateStr();
      const currentYear = new Date().getFullYear();
      const bestResultsCount = await RatingController.getBestResultsCount(
        currentYear,
        asOfDateStr
      );

      const [playersRows] = await pool.execute<RowDataPacket[]>(
        `SELECT DISTINCT p.id as player_id, p.name as player_name, p.gender
         FROM players p
         JOIN licensed_players lp ON lp.player_id = p.id AND lp.year IN (?, ?)
         ORDER BY p.name`,
        [currentYear, currentYear - 1]
      );

      // Вычисляем дату 365 дней назад от текущей даты
      const currentDate = new Date();
      const minDate = new Date(currentDate);
      minDate.setDate(minDate.getDate() - 365);
      const minDateStr = minDate.toISOString().split("T")[0];

      // Для каждого игрока собираем его командные результаты и считаем сумму лучших N
      const ratingTable: RatingTableRow[] = [];
      for (const row of playersRows as any[]) {
        const playerId = row.player_id;
        const playerName = row.player_name;

        // Получаем лицензии игрока за текущий и прошлый год
        const [licensesRows] = await pool.execute<RowDataPacket[]>(
          `SELECT year, license_date FROM licensed_players WHERE player_id = ? AND year IN (?, ?)`,
          [playerId, currentYear, currentYear - 1]
        );

        // Создаем условие для SQL: турнир должен быть после даты лицензии соответствующего года
        const licenseConditions = (licensesRows as any[])
          .map(
            (lic: any) =>
              `(YEAR(t.date) = ${lic.year} AND t.date >= '${
                new Date(lic.license_date).toISOString().split("T")[0]
              }')`
          )
          .join(" OR ");

        const whereClause = licenseConditions
          ? `tp.player_id = ? AND tr.points > 0 AND t.date >= ? AND (${licenseConditions})`
          : `tp.player_id = ? AND tr.points > 0 AND t.date >= ?`;

        const [results] = await pool.execute<RowDataPacket[]>(
          `SELECT 
              tr.id,
              tr.points,
              t.date as tournament_date
           FROM tournament_results tr
           JOIN teams tm ON tr.team_id = tm.id
           JOIN team_players tp ON tm.id = tp.team_id
           JOIN tournaments t ON tr.tournament_id = t.id
           WHERE ${whereClause} AND t.results_validated_at IS NOT NULL
           ORDER BY tr.points DESC, t.date DESC`,
          [playerId, minDateStr]
        );

        const best = (results as any[]).slice(0, bestResultsCount);
        const totalPoints = best.reduce((s, r) => s + (r.points || 0), 0);

        ratingTable.push({
          rank: 0,
          player_id: playerId,
          player_name: playerName,
          total_points: totalPoints,
        });
      }

      ratingTable.sort((a, b) => b.total_points - a.total_points);
      ratingTable.forEach((r, i) => (r.rank = i + 1));

      res.json({ success: true, data: ratingTable });
    } catch (error) {
      console.error("Ошибка получения рейтинга:", error);
      res
        .status(500)
        .json({ success: false, message: "Ошибка получения рейтинга" });
    }
  }

  // Получить полную таблицу рейтинга с детальными данными (публичный доступ)
  static async getFullRatingTable(req: Request, res: Response): Promise<void> {
    try {
      const asOfDateStr = RatingController.todayDateStr();
      const currentYear = new Date().getFullYear();
      const bestResultsCount = await RatingController.getBestResultsCount(
        currentYear,
        asOfDateStr
      );

      // Берем всех игроков с лицензией за текущий или прошлый год
      const [playersRows] = await pool.execute<RowDataPacket[]>(
        `SELECT DISTINCT p.id as player_id, p.name as player_name
         FROM players p
         JOIN licensed_players lp ON lp.player_id = p.id AND lp.year IN (?, ?)
         ORDER BY p.name`,
        [currentYear, currentYear - 1]
      );

      // Вычисляем дату 365 дней назад от текущей даты
      const currentDate = new Date();
      const minDate = new Date(currentDate);
      minDate.setDate(minDate.getDate() - 365);
      const minDateStr = minDate.toISOString().split("T")[0];

      const result: any[] = [];
      for (const row of playersRows as any[]) {
        const playerId = row.player_id;
        const playerName = row.player_name;

        // Получаем лицензии игрока за текущий и прошлый год
        const [licensesRows] = await pool.execute<RowDataPacket[]>(
          `SELECT year, license_date FROM licensed_players WHERE player_id = ? AND year IN (?, ?)`,
          [playerId, currentYear, currentYear - 1]
        );

        // Создаем условие для SQL: турнир должен быть после даты лицензии соответствующего года
        const licenseConditions = (licensesRows as any[])
          .map(
            (lic: any) =>
              `(YEAR(t.date) = ${lic.year} AND t.date >= '${
                new Date(lic.license_date).toISOString().split("T")[0]
              }')`
          )
          .join(" OR ");

        const additionalWhere = licenseConditions
          ? ` AND (${licenseConditions})`
          : "";

        const [results] = await pool.execute<RowDataPacket[]>(
          `SELECT 
              tr.id, tr.tournament_id, tr.team_id, tr.cup_position, tr.points, tr.cup, tr.qualifying_wins, tr.wins, tr.loses,
              t.name as tournament_name, t.date as tournament_date, t.manual as tournament_manual,
              GROUP_CONCAT(p2.name ORDER BY p2.name SEPARATOR ', ') as team_players
           FROM tournament_results tr
           JOIN teams tm ON tr.team_id = tm.id
           JOIN team_players tp ON tm.id = tp.team_id
           JOIN players p2 ON tp.player_id = p2.id
           JOIN tournaments t ON tr.tournament_id = t.id
           WHERE EXISTS (
             SELECT 1 FROM team_players tp2 WHERE tp2.team_id = tr.team_id AND tp2.player_id = ?
           ) AND tr.points > 0 AND t.date >= ? AND t.results_validated_at IS NOT NULL${additionalWhere}
           GROUP BY tr.id
           ORDER BY tr.points DESC, t.date DESC`,
          [playerId, minDateStr]
        );

        const allResults = (results as any[]).map((r, idx) => ({
          ...r,
          is_counted: idx < bestResultsCount,
        }));
        const best = allResults.slice(0, bestResultsCount);
        const totalPoints = best.reduce((s, r) => s + (r.points || 0), 0);

        result.push({
          rank: 0,
          player_id: playerId,
          player_name: playerName,
          total_points: totalPoints,
          best_results: best,
          all_results: allResults,
        });
      }

      result.sort((a, b) => b.total_points - a.total_points);
      result.forEach((r, i) => (r.rank = i + 1));

      res.json({ success: true, data: result });
    } catch (error) {
      console.error("Ошибка получения полного рейтинга:", error);
      res
        .status(500)
        .json({ success: false, message: "Ошибка получения полного рейтинга" });
    }
  }

  // Получить детальную информацию о рейтинге игрока (публичный доступ)
  static async getPlayerDetails(req: Request, res: Response): Promise<void> {
    try {
      const playerId = parseInt(req.params.playerId);

      if (isNaN(playerId)) {
        res.status(400).json({
          success: false,
          message: "Неверный ID игрока",
        });
        return;
      }

      const asOfDateStr = RatingController.todayDateStr();
      const currentYear = new Date().getFullYear();
      const bestResultsCount = await RatingController.getBestResultsCount(
        currentYear,
        asOfDateStr
      );

      const [playerRows] = await pool.execute<RowDataPacket[]>(
        "SELECT * FROM players WHERE id = ?",
        [playerId]
      );
      if (playerRows.length === 0) {
        res.status(404).json({ success: false, message: "Игрок не найден" });
        return;
      }

      // Вычисляем дату 365 дней назад от текущей даты
      const currentDate = new Date();
      const minDate = new Date(currentDate);
      minDate.setDate(minDate.getDate() - 365);
      const minDateStr = minDate.toISOString().split("T")[0];

      // Получаем лицензии игрока за текущий и прошлый год
      const [licensesRows] = await pool.execute<RowDataPacket[]>(
        `SELECT year, license_date FROM licensed_players WHERE player_id = ? AND year IN (?, ?)`,
        [playerId, currentYear, currentYear - 1]
      );

      // Создаем условие для SQL: турнир должен быть после даты лицензии соответствующего года
      const licenseConditions = (licensesRows as any[])
        .map(
          (lic: any) =>
            `(YEAR(t.date) = ${lic.year} AND t.date >= '${
              new Date(lic.license_date).toISOString().split("T")[0]
            }')`
        )
        .join(" OR ");

      const additionalWhere = licenseConditions
        ? ` AND (${licenseConditions})`
        : "";

      const [results] = await pool.execute<RowDataPacket[]>(
        `SELECT 
            tr.id, tr.tournament_id, tr.team_id, tr.cup_position, tr.points, tr.cup, tr.qualifying_wins, tr.wins, tr.loses,
            t.name as tournament_name, t.date as tournament_date, t.manual as tournament_manual,
            GROUP_CONCAT(p2.name ORDER BY p2.name SEPARATOR ', ') as team_players
         FROM tournament_results tr
         JOIN teams tm ON tr.team_id = tm.id
         JOIN team_players tp ON tm.id = tp.team_id
         JOIN players p2 ON tp.player_id = p2.id
         JOIN tournaments t ON tr.tournament_id = t.id
         WHERE EXISTS (
           SELECT 1 FROM team_players tp2 WHERE tp2.team_id = tr.team_id AND tp2.player_id = ?
         ) AND tr.points > 0 AND t.date >= ? AND t.results_validated_at IS NOT NULL${additionalWhere}
         GROUP BY tr.id
         ORDER BY tr.points DESC, t.date DESC`,
        [playerId, minDateStr]
      );

      const allResults = (results as any[]).map((r, idx) => ({
        ...r,
        is_counted: idx < bestResultsCount,
      }));
      const best = allResults.slice(0, bestResultsCount);
      const totalPoints = best.reduce((s, r) => s + (r.points || 0), 0);

      const playerRating = {
        player_id: playerId,
        player_name: (playerRows[0] as any).name,
        total_points: totalPoints,
        best_results: best,
        all_results: allResults,
      } as any;

      res.json({ success: true, data: playerRating });
    } catch (error) {
      console.error("Ошибка получения данных игрока:", error);
      res
        .status(500)
        .json({ success: false, message: "Ошибка получения данных игрока" });
    }
  }

  private static async buildGenderRatingTable(
    req: Request,
    res: Response,
    gender: "male" | "female"
  ): Promise<void> {
    const dateParse = RatingController.parseRatingDateContext(req);
    if (!dateParse.ok) {
      res.status(400).json({ success: false, message: dateParse.message });
      return;
    }

    const { refDateStr, minDateStr, refYear } = dateParse.ctx;
    const currentYear = refYear;
    const bestResultsCount = await RatingController.getBestResultsCount(
      refYear,
      refDateStr
    );

    const [playersRows] = await pool.execute<RowDataPacket[]>(
      `SELECT DISTINCT p.id as player_id, p.name as player_name
       FROM players p
       JOIN licensed_players lp ON lp.player_id = p.id AND lp.year IN (?, ?)
       WHERE p.gender = ?
       ORDER BY p.name`,
      [currentYear, currentYear - 1, gender]
    );

    const playerRatings: any[] = [];
    for (const row of playersRows as any[]) {
      const playerId = row.player_id;
      const playerName = row.player_name;

      const [licensesRows] = await pool.execute<RowDataPacket[]>(
        `SELECT year, license_date FROM licensed_players WHERE player_id = ? AND year IN (?, ?)`,
        [playerId, currentYear, currentYear - 1]
      );

      const licenseConditions = (licensesRows as any[])
        .map(
          (lic: any) =>
            `(YEAR(t.date) = ${lic.year} AND t.date >= '${
              new Date(lic.license_date).toISOString().split("T")[0]
            }')`
        )
        .join(" OR ");

      const additionalWhere = licenseConditions
        ? ` AND (${licenseConditions})`
        : "";

      const [results] = await pool.execute<RowDataPacket[]>(
        `SELECT 
           tr.id, tr.tournament_id, tr.team_id, tr.cup_position, tr.points, tr.cup, tr.qualifying_wins, tr.wins, tr.loses,
           t.name as tournament_name, t.date as tournament_date, t.type as tournament_type, t.manual as tournament_manual,
           GROUP_CONCAT(p2.name ORDER BY p2.name SEPARATOR ', ') as team_players
         FROM tournament_results tr
         JOIN teams tm ON tr.team_id = tm.id
         JOIN team_players tp ON tm.id = tp.team_id
         JOIN players p2 ON tp.player_id = p2.id
         JOIN tournaments t ON tr.tournament_id = t.id
         WHERE EXISTS (
           SELECT 1 FROM team_players tp2 WHERE tp2.team_id = tr.team_id AND tp2.player_id = ?
         ) AND tr.points > 0 AND t.date >= ? AND t.date <= ? AND t.results_validated_at IS NOT NULL${additionalWhere}
         GROUP BY tr.id
         ORDER BY tr.points DESC, t.date DESC`,
        [playerId, minDateStr, refDateStr]
      );
      const allResults = (results as any[]).map((r, idx) => ({
        ...r,
        is_counted: idx < bestResultsCount,
      }));
      const best = allResults.slice(0, bestResultsCount);
      const totalPoints = best.reduce((s, r) => s + (r.points || 0), 0);
      playerRatings.push({
        rank: 0,
        player_id: playerId,
        player_name: playerName,
        total_points: totalPoints,
        best_results: best,
        all_results: allResults,
      });
    }

    playerRatings.sort((a, b) => b.total_points - a.total_points);
    playerRatings.forEach((r, i) => (r.rank = i + 1));
    res.json({
      success: true,
      data: playerRatings,
      gender,
      count: playerRatings.length,
      rating_date: refDateStr,
    });
  }

  // Получить мужской рейтинг (публичный доступ)
  static async getMaleRatingTable(req: Request, res: Response): Promise<void> {
    try {
      await RatingController.buildGenderRatingTable(req, res, "male");
    } catch (error) {
      console.error("Ошибка получения мужского рейтинга:", error);
      res.status(500).json({
        success: false,
        message: "Ошибка получения мужского рейтинга",
      });
    }
  }

  // Получить женский рейтинг (публичный доступ)
  static async getFemaleRatingTable(
    req: Request,
    res: Response
  ): Promise<void> {
    try {
      await RatingController.buildGenderRatingTable(req, res, "female");
    } catch (error) {
      console.error("Ошибка получения женского рейтинга:", error);
      res.status(500).json({
        success: false,
        message: "Ошибка получения женского рейтинга",
      });
    }
  }

  // Получить рейтинги разделенные по полу (публичный доступ)
  static async getRatingsByGender(req: Request, res: Response): Promise<void> {
    try {
      const gender = req.query.gender as string;

      const validGenders = ["male", "female"];
      if (gender && !validGenders.includes(gender)) {
        res.status(400).json({
          success: false,
          message: `Неверный параметр пола. Допустимые значения: ${validGenders}`,
        });
        return;
      }

      // По умолчанию отдаем мужской рейтинг (обратная совместимость)
      if (!gender || gender === "male") {
        return await RatingController.getMaleRatingTable(req, res);
      }

      return await RatingController.getFemaleRatingTable(req, res);
    } catch (error) {
      console.error("Ошибка получения рейтингов по полу:", error);
      res.status(500).json({
        success: false,
        message: "Ошибка получения рейтингов по полу",
      });
    }
  }

  // GET /api/rating/licenses — действующие лицензии на текущий календарный год (публичный доступ)
  static async getActiveLicenses(req: Request, res: Response): Promise<void> {
    try {
      const year = new Date().getFullYear();
      const players = await LicensedPlayerModel.getActiveLicensedPlayers(year);
      res.json({
        success: true,
        data: players.map((p) => ({
          player_name: p.player_name,
          license_date: p.license_date,
          license_number: p.license_number,
          city: p.city,
        })),
      });
    } catch (error) {
      console.error("Ошибка получения действующих лицензий:", error);
      res.status(500).json({
        success: false,
        message: "Ошибка получения списка лицензий",
      });
    }
  }

  /** GET /api/rating/players/search — публичный поиск игроков по имени (автодополнение) */
  static async searchPlayers(req: Request, res: Response): Promise<void> {
    try {
      const q = String(req.query.q ?? "").trim();
      const limitRaw = parseInt(String(req.query.limit ?? "20"), 10);
      const limit = Number.isFinite(limitRaw)
        ? Math.min(Math.max(limitRaw, 1), 50)
        : 20;
      const genderRaw = req.query.gender;
      if (
        genderRaw !== undefined &&
        genderRaw !== "" &&
        genderRaw !== "male" &&
        genderRaw !== "female"
      ) {
        res.status(400).json({
          success: false,
          message: "Параметр gender должен быть male или female",
        });
        return;
      }
      const gender =
        genderRaw === "male" || genderRaw === "female" ? genderRaw : undefined;
      if (q.length < 2) {
        res.json({ success: true, data: [] });
        return;
      }
      const data = await PlayerModel.searchPlayersForAutocomplete(
        q,
        limit,
        gender
      );
      res.json({ success: true, data });
    } catch (error) {
      console.error("Ошибка поиска игроков:", error);
      res.status(500).json({
        success: false,
        message: "Ошибка поиска игроков",
      });
    }
  }
}
