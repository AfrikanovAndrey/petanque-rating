import { pool } from "../config/database";
import {
  Tournament,
  TournamentResult,
  TournamentUploadData,
  TournamentTeamUploadData,
  CupPosition,
  TeamWithMembers,
} from "../types";
import { ResultSetHeader, RowDataPacket } from "mysql2";
import { PlayerModel } from "./PlayerModel";
import { TeamModel } from "./TeamModel";
import { SettingsModel } from "./SettingsModel";
import { getCupPoints, getWinsPoints } from "../config/cupPoints";
import { calculateWinsAndLoses } from "../services/winsLosesCalculator";

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

  static async createTournament(name: string, date: string): Promise<number> {
    const [result] = await pool.execute<ResultSetHeader>(
      "INSERT INTO tournaments (name, date) VALUES (?, ?)",
      [name, date]
    );
    return result.insertId;
  }

  static async updateTournament(
    id: number,
    name: string,
    date: string
  ): Promise<boolean> {
    const [result] = await pool.execute<ResultSetHeader>(
      "UPDATE tournaments SET name = ?, date = ? WHERE id = ?",
      [name, date, id]
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
      ORDER BY tr.points_reason ASC
    `,
      [tournamentId]
    );
    return rows;
  }

  static async addTournamentResult(
    tournamentId: number,
    teamId: number,
    pointsReason: string,
    cup?: "A" | "B" | null,
    qualifying_wins?: number
  ): Promise<number> {
    // Рассчитываем wins и loses на основе данных
    const winsLoses = calculateWinsAndLoses(pointsReason, qualifying_wins || 0);

    const [result] = await pool.execute<ResultSetHeader>(
      "INSERT INTO tournament_results (tournament_id, team_id, points_reason, cup, qualifying_wins, wins, loses) VALUES (?, ?, ?, ?, ?, ?, ?)",
      [
        tournamentId,
        teamId,
        pointsReason,
        cup || null,
        qualifying_wins || 0,
        winsLoses.wins,
        winsLoses.loses,
      ]
    );
    return result.insertId;
  }

  static async updateTournamentResult(
    id: number,
    pointsReason: string,
    cup?: "A" | "B" | null,
    qualifying_wins?: number
  ): Promise<boolean> {
    // Рассчитываем wins и loses на основе данных
    const winsLoses = calculateWinsAndLoses(pointsReason, qualifying_wins || 0);

    const [result] = await pool.execute<ResultSetHeader>(
      "UPDATE tournament_results SET points_reason = ?, cup = ?, qualifying_wins = ?, wins = ?, loses = ? WHERE id = ?",
      [
        pointsReason,
        cup || null,
        qualifying_wins || 0,
        winsLoses.wins,
        winsLoses.loses,
        id,
      ]
    );
    return result.affectedRows > 0;
  }

  static async deleteTournamentResult(id: number): Promise<boolean> {
    const [result] = await pool.execute<ResultSetHeader>(
      "DELETE FROM tournament_results WHERE id = ?",
      [id]
    );
    return result.affectedRows > 0;
  }

  static async uploadTournamentTeamData(
    data: TournamentTeamUploadData
  ): Promise<number> {
    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();

      // 1. Создаем турнир
      const [tournamentResult] = await connection.execute<ResultSetHeader>(
        "INSERT INTO tournaments (name, date) VALUES (?, ?)",
        [data.tournament_name, data.tournament_date]
      );
      const tournamentId = tournamentResult.insertId;

      // 2. Обрабатываем результаты команд
      for (const result of data.results) {
        // Создаем или находим игроков команды
        const playerIds: number[] = [];

        for (const playerName of result.team_players) {
          let playerId: number;
          let player = await PlayerModel.getPlayerByName(playerName);
          if (!player) {
            playerId = await PlayerModel.createPlayer(playerName);
          } else {
            playerId = player.id;
          }
          playerIds.push(playerId);
        }

        // Создаем команду или находим существующую
        let existingTeam = await TeamModel.findExistingTeam(playerIds);
        let teamId: number;

        if (existingTeam) {
          teamId = existingTeam.id;
        } else {
          teamId = await TeamModel.createTeam(playerIds);
        }

        // Проверяем лицензии всех игроков команды
        let hasLicensedPlayer = false;
        const currentYear = new Date().getFullYear();

        for (const playerName of result.team_players) {
          const playerNameParts = playerName.trim().split(/\s+/);
          const playerFirstName = playerNameParts[0]?.toLowerCase() || "";
          const playerLastName = playerNameParts[1]?.toLowerCase() || "";

          const [licenseCheck] = await connection.execute<RowDataPacket[]>(
            `SELECT COUNT(*) as count FROM licensed_players 
             WHERE year = ? AND is_active = TRUE AND (
               -- Точное совпадение полного имени
               LOWER(TRIM(full_name)) = LOWER(TRIM(?)) OR
               -- Совпадение фамилии И имени (прямой порядок)
               (? != '' AND ? != '' AND 
                LOWER(SUBSTRING_INDEX(full_name, ' ', 1)) = LOWER(?) AND
                LOWER(SUBSTRING_INDEX(full_name, ' ', -1)) = LOWER(?)) OR
               -- Совпадение фамилии И имени (обратный порядок)
               (? != '' AND ? != '' AND 
                LOWER(SUBSTRING_INDEX(full_name, ' ', 1)) = LOWER(?) AND
                LOWER(SUBSTRING_INDEX(full_name, ' ', -1)) = LOWER(?)) OR
               -- Совпадение фамилии + частичное совпадение имени
               (? != '' AND ? != '' AND 
                LOWER(SUBSTRING_INDEX(full_name, ' ', -1)) = LOWER(?) AND
                LOWER(full_name) REGEXP LOWER(CONCAT('\\\\b', ?, '\\\\b')))
             )`,
            [
              currentYear,
              playerName, // Полное имя для точного совпадения
              playerFirstName,
              playerLastName, // Проверка что оба части не пустые
              playerFirstName,
              playerLastName, // Прямой порядок: Имя Фамилия
              playerFirstName,
              playerLastName, // Проверка что оба части не пустые для обратного
              playerLastName,
              playerFirstName, // Обратный порядок: Фамилия Имя
              playerFirstName,
              playerLastName, // Проверка что оба части не пустые для частичного
              playerLastName,
              playerFirstName, // Фамилия + частичное имя
            ]
          );

          if ((licenseCheck[0] as any).count > 0) {
            hasLicensedPlayer = true;
            console.log(
              `✓ В команде "${result.team_name}" найден лицензированный игрок: "${playerName}"`
            );
            break; // Достаточно одного лицензированного игрока в команде
          }
        }

        // Получаем очки за позицию или за победы
        let points = 0;
        const totalTeams = data.total_teams || 16;
        const category = data.tournament_category || "1";
        const pointsReason = result.points_reason;

        // Преобразуем points_reason в CupPosition для функции getCupPoints
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

        if (hasLicensedPlayer) {
          if (result.cup) {
            // Лицензированные команды в кубках получают очки за место в кубке
            points = getCupPoints(
              category,
              result.cup,
              cupPosition,
              totalTeams
            );
          } else {
            // Лицензированные команды НЕ в кубках получают очки за победы в швейцарке
            // TODO: Извлечь количество побед команды из данных турнира
            const qualifying_wins = 0; // Пока нет данных о победах в этом методе
            points = getWinsPoints(category, qualifying_wins);
          }
        } else {
          // Нелицензированные команды не получают очки
          points = 0;
        }

        // Добавляем результат команды
        // Рассчитываем wins и loses на основе данных
        const winsLoses = calculateWinsAndLoses(pointsReason, 0);

        await connection.execute(
          "INSERT INTO tournament_results (tournament_id, team_id, points_reason, cup, qualifying_wins, wins, loses) VALUES (?, ?, ?, ?, ?, ?, ?)",
          [
            tournamentId,
            teamId,
            pointsReason,
            result.cup || null,
            0, // qualifying_wins - по умолчанию 0, будет обновлено из швейцарской системы если доступно
            winsLoses.wins,
            winsLoses.loses,
          ]
        );
      }

      await connection.commit();
      return tournamentId;
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }

  static async uploadTournamentData(
    data: TournamentUploadData
  ): Promise<number> {
    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();

      // 1. Создаем турнир
      const [tournamentResult] = await connection.execute<ResultSetHeader>(
        "INSERT INTO tournaments (name, date) VALUES (?, ?)",
        [data.tournament_name, data.tournament_date]
      );
      const tournamentId = tournamentResult.insertId;

      // 2. Обрабатываем результаты
      for (const result of data.results) {
        let playerId: number;

        // Проверяем, существует ли игрок
        let player = await PlayerModel.getPlayerByName(result.player_name);
        if (!player) {
          // Создаем нового игрока
          playerId = await PlayerModel.createPlayer(result.player_name);
        } else {
          playerId = player.id;
        }

        // Проверяем, является ли игрок лицензированным в текущем году
        // Улучшенная логика сопоставления по фамилии и имени
        const currentYear = new Date().getFullYear();
        const playerNameParts = result.player_name.trim().split(/\s+/);
        const playerFirstName = playerNameParts[0]?.toLowerCase() || "";
        const playerLastName = playerNameParts[1]?.toLowerCase() || "";

        console.log(
          `Проверяем лицензию для игрока: "${result.player_name}" (имя: "${playerFirstName}", фамилия: "${playerLastName}")`
        );

        // Улучшенная логика сопоставления с лицензированными игроками
        // Приоритеты: точное совпадение > совпадение имени+фамилии > совпадение фамилии+частичное имя
        const [licenseCheck] = await connection.execute<RowDataPacket[]>(
          `SELECT COUNT(*) as count, 
                  GROUP_CONCAT(full_name) as matched_names 
           FROM licensed_players 
           WHERE year = ? AND is_active = TRUE AND (
             -- Точное совпадение полного имени
             LOWER(TRIM(full_name)) = LOWER(TRIM(?)) OR
             -- Совпадение фамилии И имени (прямой порядок)
             (? != '' AND ? != '' AND 
              LOWER(SUBSTRING_INDEX(full_name, ' ', 1)) = LOWER(?) AND
              LOWER(SUBSTRING_INDEX(full_name, ' ', -1)) = LOWER(?)) OR
             -- Совпадение фамилии И имени (обратный порядок)
             (? != '' AND ? != '' AND 
              LOWER(SUBSTRING_INDEX(full_name, ' ', 1)) = LOWER(?) AND
              LOWER(SUBSTRING_INDEX(full_name, ' ', -1)) = LOWER(?)) OR
             -- Совпадение фамилии + частичное совпадение имени
             (? != '' AND ? != '' AND 
              LOWER(SUBSTRING_INDEX(full_name, ' ', -1)) = LOWER(?) AND
              LOWER(full_name) REGEXP LOWER(CONCAT('\\\\b', ?, '\\\\b')))
           )`,
          [
            currentYear,
            result.player_name, // Полное имя для точного совпадения
            playerFirstName,
            playerLastName, // Проверка что оба части не пустые
            playerFirstName,
            playerLastName, // Прямой порядок: Имя Фамилия
            playerFirstName,
            playerLastName, // Проверка что оба части не пустые для обратного
            playerLastName,
            playerFirstName, // Обратный порядок: Фамилия Имя
            playerFirstName,
            playerLastName, // Проверка что оба части не пустые для частичного
            playerLastName,
            playerFirstName, // Фамилия + частичное имя
          ]
        );

        const licenseResult = licenseCheck[0] as any;
        const isLicensed = licenseResult.count > 0;

        if (isLicensed) {
          console.log(
            `✓ Игрок "${result.player_name}" найден в базе лицензированных игроков: ${licenseResult.matched_names}`
          );
        } else {
          console.log(
            `✗ Игрок "${result.player_name}" НЕ найден в базе лицензированных игроков`
          );
        }

        // Получаем очки за позицию
        let points = 0;
        if (result.cup && isLicensed) {
          // Только лицензированные участники кубков А и Б получают очки
          const totalTeams = data.total_teams || 16; // По умолчанию 16 команд если не указано
          const category = data.tournament_category || "1"; // По умолчанию 1 категория
          const pointsReason = result.points_reason;

          // Преобразуем points_reason в CupPosition для функции getCupPoints
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

          console.log(`🔍 Расчет очков для игрока "${result.player_name}":`, {
            cup: result.cup,
            position: cupPosition,
            category,
            totalTeams,
            isLicensed,
          });

          points = getCupPoints(category, result.cup, cupPosition, totalTeams);

          console.log(`📊 Результат расчета очков: ${points}`);
        } else {
          // Нелицензированные игроки или участники, не попавшие в кубки А и Б, не получают очков
          points = 0;
          console.log(`⚠️ Игрок "${result.player_name}" не получает очки:`, {
            hasCup: !!result.cup,
            isLicensed,
            cup: result.cup,
          });
        }

        // Создаем команду из одного игрока
        // Сначала проверяем, существует ли уже такая команда
        let existingTeam = await TeamModel.findExistingTeam([playerId]);
        let teamId: number;

        if (existingTeam) {
          teamId = existingTeam.id;
        } else {
          teamId = await TeamModel.createTeam([playerId]);
        }

        // Добавляем результат команды
        const pointsReason = result.points_reason;
        // Рассчитываем wins и loses на основе данных
        const winsLoses = calculateWinsAndLoses(pointsReason, 0);

        await connection.execute(
          "INSERT INTO tournament_results (tournament_id, team_id, points_reason, cup, qualifying_wins, wins, loses) VALUES (?, ?, ?, ?, ?, ?, ?)",
          [
            tournamentId,
            teamId,
            pointsReason,
            result.cup || null,
            0, // qualifying_wins - по умолчанию 0, будет обновлено из швейцарской системы если доступно
            winsLoses.wins,
            winsLoses.loses,
          ]
        );
      }

      await connection.commit();
      return tournamentId;
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
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
      SELECT ptp.id, ptp.points_reason, ptp.cup, ptp.team_id, ptp.points as old_points,
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
        const pointsReason = result.points_reason;

        // Преобразуем points_reason в CupPosition для функции getCupPoints
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

            newPoints = getWinsPoints(category, qualifying_wins);
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
      ORDER BY t.date DESC, tr.cup, tr.points_reason
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
      ORDER BY tr.cup, tr.points_reason
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
      ORDER BY tr.points_reason
      `,
      [tournamentId, cup]
    );
    return rows;
  }

  static async deleteCupResultsByTournament(
    tournamentId: number
  ): Promise<boolean> {
    const [result] = await pool.execute<ResultSetHeader>(
      "DELETE FROM tournament_results WHERE tournament_id = ? AND cup IS NOT NULL",
      [tournamentId]
    );
    return result.affectedRows > 0;
  }
}
