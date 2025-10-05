import * as XLSX from "xlsx";
import { PlayerModel } from "../models/PlayerModel";
import { Cup, CupPosition, Player, StageWithCells } from "../types";

type SheetCell = {
  column: string;
  rowIndex: number;
};

function parseCellAddress(address: string): SheetCell | null {
  const match = address.match(/^([A-Z]+)(\d+)$/i);
  if (!match) {
    return null; // если формат не совпадает с "буквы+числа"
  }
  const [, column, row] = match;
  return {
    column: column.toUpperCase(),
    rowIndex: parseInt(row, 10),
  };
}

function getCellText(cell: { v?: any }) {
  if (isCellEmpty(cell)) {
    return "";
  } else {
    return normalizeName(cell.v);
  }
}

function isCellEmpty(cell?: { v?: any }): boolean {
  if (!cell) return true; // ячейка отсутствует
  if (cell.v === undefined || cell.v === null) return true; // нет значения
  if (typeof cell.v === "string" && cell.v.trim() === "") return true; // пустая строка
  return false; // есть содержимое
}

type FoundedSheet = {
  sheet: XLSX.WorkSheet;
  name: string;
};

/**
 * Проверить игрока на наличие в составах команд с листа регистрации
 * @param player
 * @param teamsPlayers // информация с Листа решистрации
 * @returns порядковый номер команды с листа регистрации
 */
function detectPlayerTeamOrderNum(
  player: Player,
  teamsPlayers: TeamPlayers[]
): TeamPlayers | undefined {
  for (const team of teamsPlayers) {
    for (const teamPlayer of team.players) {
      if (teamPlayer.id === player.id) {
        return team;
      }
    }
  }
}

const COMMAND_HEADER = "Команда";
export const REGISTRATION_LIST = "Лист регистрации";
export const SWISS_RESULTS_LIST = "Итоги Швейцарки";

// Нормализация имени игрока для сравнения
export function normalizeName(name: string): string {
  return name
    .toLowerCase()
    .replace(/\s+/g, " ") // заменяем множественные пробелы на одинарные
    .replace(/[*.]/g, " ") // заменяем дефисы и точки на пробелы
    .trim();
}

export type TeamPlayers = {
  orderNum: number;
  teamId?: number;
  players: Player[];
};

export type TeamQualifyingResults = {
  wins: number;
  loses: number;
};

export class TournamentParser {
  /**
   * Парсит команды из листа регистрации
   * @param workbook
   * @returns
   *
   * Правила заполнения листа:
   * 1) Лист должен называться "Лист регистрации"
   * 2) Составы команд идут в столбце под ячейкой с текстом "Команда"
   * 3) Состав команды - это строка с перечислением игроков с запятой в качестве разделителя
   * 4) Каждый игрок должен однозначно идентифицироваться
   *
   */
  static async parseTeamsFromRegistrationSheet(
    workbook: XLSX.WorkBook
  ): Promise<TeamPlayers[]> {
    let registrationSheet = this.findXlsSheet(workbook, REGISTRATION_LIST);

    if (!registrationSheet) {
      throw new Error(`Не найден обязательный лист "${REGISTRATION_LIST}"`);
    }

    const userDetectErrors = [];

    let teamOrderNum = 0;
    const teams: TeamPlayers[] = [];

    // Ищем столбцец с заголовком "Команда"
    const teamNameColumnCell = this.findCellByText(
      registrationSheet,
      COMMAND_HEADER
    );

    if (!teamNameColumnCell) {
      throw new Error(
        `Ошибка структуры листа "${REGISTRATION_LIST}" : не найдена ячейка со значением "${COMMAND_HEADER}", являющаяся заголовком таблицы с участниками`
      );
    }

    // Проходим по столбцу "Команда" и разбираем игроков
    for (
      let rowIndex = teamNameColumnCell?.rowIndex + 1;
      rowIndex < 100;
      rowIndex++
    ) {
      let teamCell =
        registrationSheet[`${teamNameColumnCell.column}${rowIndex}`];

      if (isCellEmpty(teamCell)) {
        // Если нашли пустую ячейку - значит список игроков закончился
        break;
      } else {
        // Обработка ячейки со списком игроков
        const players: Player[] = [];

        const teamPlayersString = String(teamCell.v).trim();
        const rawTeamPlayers: string[] = teamPlayersString.split(",");

        for (const rawTeamPlayer of rawTeamPlayers) {
          try {
            const foundedPlayer = await this.detectPlayer(rawTeamPlayer);
            players.push(foundedPlayer);
          } catch (error) {
            userDetectErrors.push((error as Error).message);
          }
        }

        if (players.length > 0) {
          teams.push({
            orderNum: teamOrderNum,
            players: players,
          });
          teamOrderNum++;
        }
      }
    }

    // Укажите на листе регистрации полнную фамилию и имя игрока, либо создайте игрока в Админ панели
    if (userDetectErrors.length > 0) {
      throw new Error(`Критическая ошибка\n${userDetectErrors}`);
    }

    console.log(`Найдено команд: ${teams.length}`);
    return teams;
  }

  /**
   * Парсинг листа с результатами кубка
   * @param workbook
   * @param teams
   * @returns
   */
  static async parseCupResults(
    workbook: XLSX.WorkBook,
    cup: Cup,
    teams: TeamPlayers[]
  ): Promise<Map<number, CupPosition>> {
    let worksheet = this.findXlsSheet(workbook, `Кубок ${cup}`);

    const cupTeamResults: Map<number, CupPosition> = new Map();

    if (worksheet) {
      const stages = {
        quarterFinals: [
          {
            cells: ["B4", "B8", "B12", "B16", "B20", "B24", "B28", "B32"],
            position: CupPosition.QUARTER_FINAL,
          },
        ],
        semiFinals: [
          {
            cells: ["F6", "F14", "F22", "F30"],
            position: CupPosition.SEMI_FINAL,
          },
        ],
        thirdPlace: [{ cells: ["F38"], position: CupPosition.THIRD_PLACE }],
        finals: [{ cells: ["J10", "J26"], position: CupPosition.RUNNER_UP }],
        winner: [{ cells: ["N18"], position: CupPosition.WINNER }],
      } as Record<string, StageWithCells[]>;

      const errors: string[] = [];

      for (const stage of Object.values(stages)) {
        for (const stageInfo of stage) {
          for (const cellAddress of stageInfo.cells) {
            let player: Player;
            try {
              if (isCellEmpty(worksheet[cellAddress])) {
                // Игра за третье место может отсутствовать
                if (stageInfo.position == CupPosition.THIRD_PLACE) {
                  continue;
                } else {
                  throw new Error(
                    `Ячейка ${cellAddress} на листе "Кубок ${cup}" пустая или содержит некорректное значение`
                  );
                }
              } else {
                const playerName = getCellText(worksheet[cellAddress]);
                player = await this.detectPlayer(playerName);
                const team = detectPlayerTeamOrderNum(player, teams);

                if (!team) {
                  throw new Error(
                    `Игрок "${playerName}" с листа ${SWISS_RESULTS_LIST} не найден среди игроков команд на Листе регистрации`
                  );
                }
                cupTeamResults.set(team.orderNum, stageInfo.position);
              }
            } catch (error) {
              errors.push((error as Error).message);
            }
          }
        }
      }

      if (errors.length !== 0) {
        throw new Error(
          `Ошибки парсинга данных на листе "Кубок ${cup}":\n${errors}`
        );
      }

      console.log(`### Определены результаты кубка ${cup}`);
      for (const [teamOrderNum, results] of cupTeamResults) {
        console.log(
          `Team #${teamOrderNum} : ${JSON.stringify(results, null, 0)}`
        );
      }
    }

    return cupTeamResults;
  }

  /**
   * Поиск листа по названию
   */
  static findXlsSheet(
    workbook: XLSX.WorkBook,
    expectedListName: RegExp | string
  ): XLSX.WorkSheet | undefined {
    // Проверяем все возможные варианты названий
    for (const sheetName of workbook.SheetNames) {
      const pattern =
        expectedListName instanceof RegExp
          ? expectedListName
          : new RegExp(expectedListName);

      if (pattern.test(sheetName)) {
        return workbook.Sheets[sheetName];
      }
    }
  }

  /**
   * Парсинг листа "Итоги Швейцарки" для извлечения количества побед команд
   * @param workbook
   * @returns
   */
  static async parseSwissSystemResults(
    workbook: XLSX.WorkBook,
    teams: TeamPlayers[]
  ): Promise<Map<number, TeamQualifyingResults>> {
    console.log("🎯 Парсим результаты Швейарки");

    const errors = [];
    try {
      // Парсим данные из листа
      const swissSheet = TournamentParser.findXlsSheet(
        workbook,
        normalizeName(SWISS_RESULTS_LIST)
      );

      const swissData = XLSX.utils.sheet_to_json(swissSheet!.sheet, {
        header: 1,
      });

      const teamResults = new Map<number, TeamQualifyingResults>();

      // Начинаем обработку со строки 2 (индекс 1), так как в B2 начинаются команды
      // В таблице: A=Место, B=Имя, C=Результат(победы), D=Бхгц, E=Прогресс, F=Детал
      for (let rowIndex = 1; rowIndex < swissData.length; rowIndex++) {
        const row = swissData[rowIndex] as any[];

        if (!row || row.length < 3) continue;

        // Столбец B (индекс 1) - название команды
        // Столбец C (индекс 2) - количество побед (результат)
        const teamName =
          typeof row[1] === "string"
            ? row[1].replace(/,?$/, "").trim()
            : row[1];
        const winsValue = row[2];

        if (!teamName || teamName === "" || typeof teamName !== "string") {
          break; // Нашли пустуб строку - завершили парсинг результатов
        }

        // Парсим количество побед
        let qualifying_wins = 0;

        if (typeof winsValue === "number") {
          qualifying_wins = Math.floor(winsValue); // Округляем до целого числа
        } else if (typeof winsValue === "string") {
          const parsed = parseInt(winsValue, 10);
          qualifying_wins = isNaN(parsed) ? 0 : parsed;
        } else if (winsValue === undefined || winsValue === null) {
          qualifying_wins = 0;
        }

        let player: Player;
        try {
          player = await this.detectPlayer(teamName);
          const team = detectPlayerTeamOrderNum(player, teams);
          if (!team) {
            throw new Error(
              `Игрок "${teamName}" с листа ${SWISS_RESULTS_LIST} не найден среди игроков команд на Листе регистрации`
            );
          }

          teamResults.set(team.orderNum, {
            wins: qualifying_wins,
            loses: 5 - qualifying_wins,
          });
        } catch (error) {
          errors.push((error as Error).message);
        }
      }

      return teamResults;
    } catch (error) {
      console.error(`Ошибка при парсинге результатов Швейцарки`, error);
      return new Map(); // Возвращаем пустую карту при ошибке
    }
  }

  /**
   * Поиск ячейки по тексту (для поиска заголовков таблиц)
   * @param sheet
   * @param header
   * @returns
   */
  static findCellByText(
    sheet: XLSX.WorkSheet,
    textToFind: string
  ): SheetCell | null {
    for (const cellAddress in sheet) {
      if (cellAddress[0] === "!") continue; // пропускаем служебные поля
      const cell = sheet[cellAddress];
      if (cell && cell.v && cell.v === textToFind) {
        return parseCellAddress(cellAddress); // найден адрес ячейки
      }
    }
    return null;
  }

  /**
   * Парсинг листов групповых игр для извлечения количества побед команд на квалификационном этапе
   * @param workbook
   * @returns Map<playerId: number, {wins: number, loses: number}>
   */
  static async parseGroupResults(
    workbook: XLSX.WorkBook,
    teams: TeamPlayers[]
  ): Promise<Map<number, TeamQualifyingResults>> {
    console.log("🎯 Парсим результаты группового этапа");

    const teamResults = new Map<number, TeamQualifyingResults>();

    const errors: string[] = [];

    for (const sheetName of Object.values(workbook.SheetNames)) {
      if (sheetName.includes("Группа")) {
        // Парсим данные из листа

        console.log(`Парсим данные с листа: "${sheetName}"`);

        const sheet = workbook.Sheets[sheetName];

        const teamNameColumnHeader = "Команда";
        const teamWinsColumnHeader = "победы";

        const teamNameColumnCell = this.findCellByText(
          sheet,
          teamNameColumnHeader
        );

        const teamWinsColumnCell = this.findCellByText(
          sheet,
          teamWinsColumnHeader
        );

        let groupTeamCount = 0;

        console.log(
          `teamNameColumnCell = ${JSON.stringify(teamNameColumnCell, null, 2)}`
        );
        console.log(
          `teamWinsColumnCell = ${JSON.stringify(teamWinsColumnCell, null, 2)}`
        );

        const teamWins: Map<number, number> = new Map();
        let emptyRows = 0;

        if (teamNameColumnCell && teamWinsColumnCell) {
          for (
            let rowIndex = teamNameColumnCell?.rowIndex + 1;
            rowIndex < 30;
            rowIndex++
          ) {
            let teamCell = sheet[`${teamNameColumnCell.column}${rowIndex}`];

            if (isCellEmpty(teamCell)) {
              emptyRows++;
              if (emptyRows == 2) {
                break;
              }
            } else {
              emptyRows = 0;
              let player: Player;
              //try {
              const playerName = getCellText(teamCell);
              player = await this.detectPlayer(playerName);

              const team = detectPlayerTeamOrderNum(player, teams);
              if (!team) {
                throw new Error(
                  `Игрок "${playerName}" с листа "${sheetName}" не найден среди игроков на Листе регистрации`
                );
              }

              // Парсим количество побед
              const qualifying_wins = Number(
                sheet[`${teamWinsColumnCell.column}${rowIndex}`].v
              );

              teamWins.set(team.orderNum, qualifying_wins);
              //   } catch (error) {
              //     errors.push((error as Error).message);
              //   }

              //   if (typeof winsValue === "number") {
              //     qualifying_wins = Math.floor(winsValue); // Округляем до целого числа
              //   } else if (typeof winsValue === "string") {
              //     const parsed = parseInt(winsValue, 10);
              //     qualifying_wins = isNaN(parsed) ? 0 : parsed;
              //   } else if (winsValue === undefined || winsValue === null) {
              //     qualifying_wins = 0;
              //   }

              groupTeamCount++;
            }
          }
        }
        for (const [player, wins] of teamWins) {
          teamResults.set(player, { wins, loses: groupTeamCount - 1 - wins });
        }
      }
    }

    if (errors.length > 0) {
      throw new Error(`Критические ошибки\n${errors}`);
    }

    return teamResults;
  }

  /**
   * Определить пользователя по строке поиска
   * @param teamName : string
   * @returns
   */
  static async detectPlayer(teamName: string): Promise<Player> {
    const foundedPlayers = await PlayerModel.getPlayerByName(
      normalizeName(teamName)
    );
    if (!foundedPlayers || foundedPlayers.length === 0) {
      throw new Error(`Игрок "${teamName}" не найден в базе данных`);
    }
    if (foundedPlayers.length > 1) {
      throw new Error(`Найдено несколько игроков по строке: "${teamName}"`);
    }
    return foundedPlayers[0];
  }
}
