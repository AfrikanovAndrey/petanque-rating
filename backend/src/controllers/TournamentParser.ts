import * as XLSX from "xlsx";
import { PlayerModel } from "../models/PlayerModel";
import { Cup, CupPosition, Player, StageWithCells } from "../types";
import ExcelUtils from "../utils/excelUtils";
import { parseCupValue, parseCupPosition } from "../utils/cupValidators";

const COMMAND_HEADER = "Команда";
export const REGISTRATION_LIST = "Регистрация";
export const SWISS_RESULTS_LIST = "Итоги швейцарки";
export const GROUP_RESULTS_LIST_REGEXP = /группа [a-zа-я]/;
export const BUTTING_MATCH_LIST = "Стык AB";
export const BUTTING_MATCH_LIST_REGEXP = /стык [aа][bб]/;
export const MANUAL_INPUT_LIST = "Ручной ввод";

// Нормализация имени игрока для сравнения
export function normalizeName(name: string): string {
  return name
    .toLowerCase()
    .replace(/,/g, "") // убираем запятые
    .replace(/ё/g, "е") // меняем буквы ё на е
    .replace(/\s+/g, " ") // заменяем множественные пробелы на одинарные
    .replace(/[*.]/g, " ") // заменяем дефисы и точки на пробелы
    .replace(/\(.+\)/g, "") // убираем текст в скобках. Пример: (юн) / (юниор)
    .trim();
}

export function getCupListName(cup: Cup) {
  switch (cup) {
    case "A":
      return `^Кубок [AaАа]$`;
    case "B":
      return `^Кубок [BbБб]$`;
    case "C":
      return `^Кубок [CcСс]$`;
  }
}

export type TeamPlayers = {
  orderNum: number;
  teamId?: number;
  players: Player[];
};

export type ManualInputTeam = {
  orderNum: number;
  players: Player[];
  cup: string | null;
  position: string | null;
  points: number;
};

export function generateTeamDescription(team: TeamPlayers): string {
  return `Team #${team.orderNum + 1} (${team.players
    .map((player) => player.name)
    .join(", ")})`;
}

export type TeamQualifyingResults = {
  wins: number;
  loses: number;
};

export class TournamentParser {
  /**
   * Парсинг листа "Ручной ввод" с результатами турнира
   * @param workbook
   * @returns массив команд с результатами
   *
   * Структура листа:
   * Заголовки: Команда | Кубок | Позиция | Очки
   * Пример: Африканов, Лямунов | A | 1/4 | 15
   */
  static async parseManualInputSheet(
    workbook: XLSX.WorkBook
  ): Promise<ManualInputTeam[]> {
    console.log(`🖊️ Парсим лист "${MANUAL_INPUT_LIST}"`);

    const sheet = ExcelUtils.findXlsSheet(workbook, MANUAL_INPUT_LIST);

    if (!sheet) {
      throw new Error(`Лист "${MANUAL_INPUT_LIST}" не найден`);
    }

    const errors: string[] = [];
    const teams: ManualInputTeam[] = [];

    // Ищем заголовки столбцов
    const teamColumnCell = ExcelUtils.findCellByText(sheet, "Команда");
    const cupColumnCell = ExcelUtils.findCellByText(sheet, "Кубок");
    const positionColumnCell = ExcelUtils.findCellByText(sheet, "Позиция");
    const pointsColumnCell = ExcelUtils.findCellByText(sheet, "Очки");

    // Валидация заголовков
    if (!teamColumnCell) {
      errors.push('Не найден столбец "Команда"');
    }
    if (!cupColumnCell) {
      errors.push('Не найден столбец "Кубок"');
    }
    if (!positionColumnCell) {
      errors.push('Не найден столбец "Позиция"');
    }
    if (!pointsColumnCell) {
      errors.push('Не найден столбец "Очки"');
    }

    if (errors.length > 0) {
      throw new Error(
        `#Ошибки на листе "${MANUAL_INPUT_LIST}"\n${errors.join("\n")}`
      );
    }

    if (
      teamColumnCell &&
      cupColumnCell &&
      positionColumnCell &&
      pointsColumnCell
    ) {
      // Проходим по строкам с данными
      let teamOrderNum = 0;
      for (
        let rowIndex = teamColumnCell.rowIndex + 1;
        rowIndex < 1000;
        rowIndex++
      ) {
        const teamCell = sheet[`${teamColumnCell.column}${rowIndex}`];

        if (ExcelUtils.isCellEmpty(teamCell)) {
          break; // Конец данных
        }

        // Парсим команду (список игроков через запятую)
        const teamPlayersString = String(teamCell.v).trim();
        const rawTeamPlayers: string[] = teamPlayersString.split(",");

        const players: Player[] = [];
        for (const rawTeamPlayer of rawTeamPlayers) {
          const playerName = rawTeamPlayer.trim();
          if (normalizeName(playerName) !== "") {
            const foundedPlayer = await this.detectPlayer(playerName);
            players.push(foundedPlayer);
          }
        }

        if (players.length === 0) {
          continue; // Пропускаем пустые команды
        }

        // Парсим кубок
        const cupCell = sheet[`${cupColumnCell.column}${rowIndex}`];
        let cup: Cup | null = null;

        if (ExcelUtils.isCellEmpty(cupCell)) {
          cup = null;
        } else {
          const cupValue = String(cupCell.v);
          cup = parseCupValue(cupValue);
          if (cup === null) {
            errors.push(
              `Строка ${rowIndex}: некорректное значение кубка: "${cupValue.trim()}". Ожидается A, B, C (латиница) или А, Б, С (кириллица)`
            );
          }
        }

        // Парсим позицию
        const positionCell = sheet[`${positionColumnCell.column}${rowIndex}`];
        let position: CupPosition | null = null;
        if (ExcelUtils.isCellEmpty(positionCell)) {
          position = null;
        } else {
          const positionValue = String(positionCell.v);
          position = parseCupPosition(positionValue);
          if (position === null) {
            errors.push(
              `Строка ${rowIndex}: некорректное значение позиции: "${positionValue.trim()}". Ожидается: 1, 2, 3, 1/2, 1/4, 1/8`
            );
          }
        }

        if ((cup && !position) || (!cup && position)) {
          errors.push(
            `Строка ${rowIndex}: некорректное значение кубка или позиции для команды`
          );
          continue;
        }

        // Парсим очки
        const pointsCell = sheet[`${pointsColumnCell.column}${rowIndex}`];
        if (ExcelUtils.isCellEmpty(pointsCell)) {
          errors.push(`Строка ${rowIndex}: не указаны очки для команды`);
          continue;
        }
        const points = Number(pointsCell.v);

        if (points === null) {
          errors.push(`Строка ${rowIndex}: не указаны очки для команды`);
          continue;
        }

        // Создаем команду с результатами
        teams.push({
          orderNum: teamOrderNum,
          players: players,
          // Добавляем дополнительные поля для результатов (они будут использованы в TournamentController)
          cup: cup,
          position: position,
          points: points,
        });

        console.log(
          `✓ Команда #${teamOrderNum + 1}: [${players
            .map((p) => p.name)
            .join(", ")}], кубок: ${cup || "-"}, позиция: ${
            position || "-"
          }, очки: ${points}`
        );

        teamOrderNum++;
      }

      if (errors.length > 0) {
        throw new Error(
          `#Ошибки на листе "${MANUAL_INPUT_LIST}"\n${errors.join("\n")}`
        );
      }

      if (teams.length === 0) {
        throw new Error(
          `На листе "${MANUAL_INPUT_LIST}" не найдено ни одной команды`
        );
      }
    }

    console.log(
      `Найдено команд на листе "${MANUAL_INPUT_LIST}": ${teams.length}`
    );

    return teams;
  }

  /**
   * Проверить игрока на наличие в составах команд с листа регистрации
   * @param player
   * @param teamsPlayers // информация с Листа решистрации
   * @returns порядковый номер команды с листа регистрации
   */
  static detectPlayerTeamOrderNum(
    player: Player,
    teamsPlayers: TeamPlayers[],
    sheetName: string
  ): TeamPlayers {
    for (const team of teamsPlayers) {
      for (const teamPlayer of team.players) {
        if (teamPlayer.id === player.id) {
          return team;
        }
      }
    }

    throw new Error(
      `Команда игрока "${player.name}" (лист "${sheetName}") не найдена на листе регистрации`
    );
  }

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
    let registrationSheet = ExcelUtils.findXlsSheet(
      workbook,
      REGISTRATION_LIST
    );

    if (!registrationSheet) {
      throw new Error(`Не найден обязательный лист "${REGISTRATION_LIST}"`);
    }

    const userDetectErrors: string[] = [];

    let teamOrderNum = 0;
    const teams: TeamPlayers[] = [];

    // Ищем столбцец с заголовком "Команда"
    const teamNameColumnCell = ExcelUtils.findCellByText(
      registrationSheet,
      COMMAND_HEADER
    );

    if (!teamNameColumnCell) {
      throw new Error(
        `Ошибка структуры листа "${REGISTRATION_LIST}" : не найден столбец с заголовком "${COMMAND_HEADER}"`
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

      if (ExcelUtils.isCellEmpty(teamCell)) {
        // Если нашли пустую ячейку - значит список игроков закончился
        break;
      } else {
        // Обработка ячейки со списком игроков
        const players: Player[] = [];

        const teamPlayersString = String(teamCell.v).trim();
        const rawTeamPlayers: string[] = teamPlayersString.split(",");

        for (const rawTeamPlayer of rawTeamPlayers) {
          try {
            if (normalizeName(rawTeamPlayer) != "") {
              const foundedPlayer = await this.detectPlayer(rawTeamPlayer);
              players.push(foundedPlayer);
            }
          } catch (error) {
            userDetectErrors.push(
              `${REGISTRATION_LIST}: ${(error as Error).message}`
            );
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
      throw new Error(
        `#Ошибки на листе "${REGISTRATION_LIST}"\n${userDetectErrors.join(
          "\n"
        )}`
      );
    }

    console.log(`Найдено команд: ${teams.length}`);
    return teams;
  }

  /**
   * Проверить, содержит ли лист кубка сетку плей-офф на 16 команд
   * @param worksheet - лист Excel с результатами кубка
   * @returns true, если сетка на 16 команд
   */
  static isCup16Grid(worksheet: XLSX.WorkSheet): boolean {
    // Проверяем ключевые ячейки, которые должны быть заполнены для сетки 16 команд
    const isB4NotEmpty = !ExcelUtils.isCellEmpty(worksheet["B4"]);
    const isB64NotEmpty = !ExcelUtils.isCellEmpty(worksheet["B64"]);
    const isR34NotEmpty = !ExcelUtils.isCellEmpty(worksheet["R34"]);

    return isB4NotEmpty && isB64NotEmpty && isR34NotEmpty;
  }

  /**
   * Проверить, содержит ли лист кубка сетку плей-офф на 8 команд
   * @param worksheet - лист Excel с результатами кубка
   * @returns true, если сетка на 8 команд
   */
  static isCup8Grid(worksheet: XLSX.WorkSheet): boolean {
    // Проверяем ключевые ячейки, которые должны быть заполнены для сетки 8 команд
    const isB4NotEmpty = !ExcelUtils.isCellEmpty(worksheet["B4"]);
    const isB32NotEmpty = !ExcelUtils.isCellEmpty(worksheet["B32"]);
    const isN18NotEmpty = !ExcelUtils.isCellEmpty(worksheet["N18"]);

    return isB4NotEmpty && isB32NotEmpty && isN18NotEmpty;
  }

  /**
   * Проверить, содержит ли лист кубка сетку плей-офф на 4 команд
   * @param worksheet - лист Excel с результатами кубка
   * @returns true, если сетка на 4 команд
   */
  static isCup4Grid(worksheet: XLSX.WorkSheet): boolean {
    // Проверяем ключевые ячейки, которые должны быть заполнены для сетки 4 команд
    const isB4NotEmpty = !ExcelUtils.isCellEmpty(worksheet["B4"]);
    const isB16NotEmpty = !ExcelUtils.isCellEmpty(worksheet["B16"]);
    const isJ10NotEmpty = !ExcelUtils.isCellEmpty(worksheet["J10"]);

    return isB4NotEmpty && isB16NotEmpty && isJ10NotEmpty;
  }

  static async parseButtingMatchResults(
    worksheet: XLSX.WorkSheet,
    teams: TeamPlayers[],
    teamResults: Map<number, boolean>,
    errors: string[],
    cells: string[],
    result: boolean
  ) {
    let player: Player;

    // Парсим победителей
    for (const cellAddress of cells) {
      try {
        if (ExcelUtils.isCellEmpty(worksheet[cellAddress])) {
          errors.push(
            `Ячейка ${cellAddress} на листе "${BUTTING_MATCH_LIST}" пустая или содержит некорректное значение`
          );
        } else {
          const playerName = ExcelUtils.getCellText(worksheet[cellAddress]);
          player = await this.detectPlayer(playerName);
          const team = this.detectPlayerTeamOrderNum(
            player,
            teams,
            cellAddress
          );

          if (!team) {
            errors.push(
              `Игрок "${playerName}" с листа ${BUTTING_MATCH_LIST} не найден среди игроков команд на Листе регистрации`
            );
          } else {
            teamResults.set(team.orderNum, result);
          }
        }
      } catch (error) {
        errors.push(`${cellAddress}: ${(error as Error).message}`);
      }
    }

    return teamResults;
  }

  /**
   * Парсинг результатов стыковых игр для 16 команд на попадание в кубки: А / Б
   * @param workbook
   * @param teams
   * @returns
   */
  static async parseABButtingMatchResults(
    workbook: XLSX.WorkBook,
    teams: TeamPlayers[]
  ): Promise<Map<number, boolean>> {
    // true - команда выиграла, false - команда проиграла

    console.log(`🎯 Парсим результаты стыковых игр`);

    let worksheet = ExcelUtils.findXlsSheet(
      workbook,
      BUTTING_MATCH_LIST_REGEXP
    );

    if (!worksheet) {
      console.log(`❌  Лист с результатами стыковых игр не найден`);
    } else {
      const participants = [
        "B4",
        "B8",
        "B12",
        "B16",
        "B20",
        "B24",
        "B28",
        "B32",
        "B36",
        "B40",
        "B44",
        "B48",
        "B52",
        "B56",
        "B60",
        "B64",
      ];

      const winners = ["F6", "F14", "F22", "F30", "F38", "F46", "F54", "F62"];
      const errors: string[] = [];
      const teamResults = new Map<number, boolean>();

      await this.parseButtingMatchResults(
        worksheet,
        teams,
        teamResults,
        errors,
        participants,
        false
      );
      await this.parseButtingMatchResults(
        worksheet,
        teams,
        teamResults,
        errors,
        winners,
        true
      );

      if (errors.length !== 0) {
        throw new Error(
          `#Ошибки парсинга данных на листе "${BUTTING_MATCH_LIST}":\n${errors.join(
            "\n"
          )}`
        );
      }
      console.log(`### Определены результаты стыковых игр`);
      for (const [teamOrderNum, result] of teamResults) {
        console.log(
          `${generateTeamDescription(teams[teamOrderNum])} : ${
            result ? "Победа" : "Поражение"
          }`
        );
      }

      return teamResults;
    }

    return new Map();
  }

  /**
   * Парсинг результатов квалификационного этапа
   * @param workbook
   * @param teams
   * @returns
   */
  static async parseQualifyingResults(
    workbook: XLSX.WorkBook,
    teams: TeamPlayers[]
  ): Promise<Map<number, TeamQualifyingResults>> {
    let teamQualifyingResults = new Map<number, TeamQualifyingResults>();

    const swissSheet = ExcelUtils.findXlsSheet(
      workbook,
      normalizeName(SWISS_RESULTS_LIST)
    );
    const groupSheet = ExcelUtils.findXlsSheet(
      workbook,
      GROUP_RESULTS_LIST_REGEXP
    );

    // Либо находим результаты Швейцарки, либо групп
    if (swissSheet) {
      teamQualifyingResults = await TournamentParser.parseSwissSystemResults(
        workbook,
        teams
      );
    } else if (groupSheet) {
      teamQualifyingResults = await TournamentParser.parseGroupResults(
        workbook,
        teams
      );
    }

    if (teamQualifyingResults.size === 0) {
      throw new Error("Не определены результаты квалификационного этапа");
    }

    console.log(`### Результаты квалификационного этапа`);
    for (const [teamOrderNum, results] of teamQualifyingResults) {
      console.log(
        `${generateTeamDescription(teams[teamOrderNum])} : ${JSON.stringify(
          results,
          null,
          0
        )}`
      );
    }

    return teamQualifyingResults;
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
    let worksheet = ExcelUtils.findXlsSheet(workbook, getCupListName(cup));

    if (!worksheet) {
      if (cup === "A") {
        throw new Error(`❌  Лист с результатами кубка ${cup} не найден`);
      } else {
        console.log(`❌  Лист с результатами стыковочных игр не найден`);
        return new Map();
      }
    }

    if (this.isCup16Grid(worksheet)) {
      return this.parseCup16Results(workbook, cup, teams);
    } else if (this.isCup8Grid(worksheet)) {
      return this.parseCup8Results(workbook, cup, teams);
    } else if (this.isCup4Grid(worksheet)) {
      return this.parseCup4Results(workbook, cup, teams);
    } else {
      throw new Error(
        `❌  Лист с результатами кубка ${cup} не содержит корректную структуру`
      );
    }
  }

  /**
   * Парсинг листа с результатами кубка с сеткой на 4 команды
   * @param workbook
   * @param teams
   * @returns
   */
  static async parseCup4Results(
    workbook: XLSX.WorkBook,
    cup: Cup,
    teams: TeamPlayers[]
  ): Promise<Map<number, CupPosition>> {
    console.log(`🎯 Парсим результаты Кубка ${cup}`);

    let worksheet = ExcelUtils.findXlsSheet(workbook, getCupListName(cup));

    const cupTeamResults: Map<number, CupPosition> = new Map();

    if (!worksheet) {
      console.log(`❌  Лист с результатами кубка ${cup} не найден`);
      return new Map();
    }

    const stages = {
      semiFinals: [
        {
          cells: ["B4", "B8", "B12", "B16"],
          position: CupPosition.ROUND_OF_4,
        },
      ],
      thirdPlace: [{ cells: ["F22"], position: CupPosition.THIRD_PLACE }],
      finals: [{ cells: ["F6", "F14"], position: CupPosition.RUNNER_UP }],
      winner: [{ cells: ["J10"], position: CupPosition.WINNER }],
    } as Record<string, StageWithCells[]>;

    const errors: string[] = [];

    for (const stage of Object.values(stages)) {
      for (const stageInfo of stage) {
        for (const cellAddress of stageInfo.cells) {
          let player: Player;
          try {
            if (ExcelUtils.isCellEmpty(worksheet[cellAddress])) {
              // Игра за третье место может отсутствовать
              if (stageInfo.position == CupPosition.THIRD_PLACE) {
                continue;
              } else {
                errors.push(
                  `Ячейка ${cellAddress} на листе "Кубок ${cup}" пустая или содержит некорректное значение`
                );
              }
            } else {
              const playerName = ExcelUtils.getCellText(worksheet[cellAddress]);
              player = await this.detectPlayer(playerName);
              const team = this.detectPlayerTeamOrderNum(
                player,
                teams,
                `Кубок ${cup}`
              );

              if (!team) {
                errors.push(
                  `Игрок "${playerName}" с листа ${SWISS_RESULTS_LIST} не найден среди игроков команд на Листе регистрации`
                );
              } else {
                cupTeamResults.set(team.orderNum, stageInfo.position);
              }
            }
          } catch (error) {
            errors.push(`${cellAddress}: ${(error as Error).message}`);
          }
        }
      }
    }

    if (errors.length !== 0) {
      throw new Error(
        `#Ошибки парсинга данных на листе "Кубок ${cup}":\n${errors.join("\n")}`
      );
    }

    console.log(`### Определены результаты кубка ${cup}`);
    for (const [teamOrderNum, results] of cupTeamResults) {
      console.log(
        `Team #${teamOrderNum} : ${JSON.stringify(results, null, 0)}`
      );
    }

    return cupTeamResults;
  }

  /**
   * Парсинг листа с результатами кубка с сеткой на 8 команд
   * @param workbook
   * @param teams
   * @returns
   */
  static async parseCup8Results(
    workbook: XLSX.WorkBook,
    cup: Cup,
    teams: TeamPlayers[]
  ): Promise<Map<number, CupPosition>> {
    console.log(`🎯 Парсим результаты Кубка ${cup}`);

    let worksheet = ExcelUtils.findXlsSheet(workbook, getCupListName(cup));

    const cupTeamResults: Map<number, CupPosition> = new Map();

    if (!worksheet) {
      console.log(`❌  Лист с результатами кубка ${cup} не найден`);
      return new Map();
    }

    const stages = {
      round_of_8: [
        {
          cells: ["B4", "B8", "B12", "B16", "B20", "B24", "B28", "B32"],
          position: CupPosition.ROUND_OF_8,
        },
      ],
      semiFinals: [
        {
          cells: ["F6", "F14", "F22", "F30"],
          position: CupPosition.ROUND_OF_4,
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
            if (ExcelUtils.isCellEmpty(worksheet[cellAddress])) {
              // Игра за третье место может отсутствовать
              if (stageInfo.position == CupPosition.THIRD_PLACE) {
                continue;
              } else {
                errors.push(
                  `Ячейка ${cellAddress} на листе "Кубок ${cup}" пустая или содержит некорректное значение`
                );
              }
            } else {
              const playerName = ExcelUtils.getCellText(worksheet[cellAddress]);
              player = await this.detectPlayer(playerName);
              const team = this.detectPlayerTeamOrderNum(
                player,
                teams,
                `Кубок ${cup}`
              );

              if (!team) {
                errors.push(
                  `Игрок "${playerName}" с листа ${SWISS_RESULTS_LIST} не найден среди игроков команд на Листе регистрации`
                );
              } else {
                cupTeamResults.set(team.orderNum, stageInfo.position);
              }
            }
          } catch (error) {
            errors.push(`${cellAddress}: ${(error as Error).message}`);
          }
        }
      }
    }

    if (errors.length !== 0) {
      throw new Error(
        `#Ошибки парсинга данных на листе "Кубок ${cup}":\n${errors.join("\n")}`
      );
    }

    console.log(`### Определены результаты кубка ${cup}`);
    for (const [teamOrderNum, results] of cupTeamResults) {
      console.log(
        `Team #${teamOrderNum} : ${JSON.stringify(results, null, 0)}`
      );
    }

    return cupTeamResults;
  }

  /**
   * Парсинг листа с результатами кубка с сеткой на 16 команд
   * @param workbook
   * @param teams
   * @returns
   */
  static async parseCup16Results(
    workbook: XLSX.WorkBook,
    cup: Cup,
    teams: TeamPlayers[]
  ): Promise<Map<number, CupPosition>> {
    console.log(`🎯 Парсим результаты Кубка ${cup}`);

    let worksheet = ExcelUtils.findXlsSheet(workbook, getCupListName(cup));

    const cupTeamResults: Map<number, CupPosition> = new Map();

    if (!worksheet) {
      console.log(`❌  Лист с результатами кубка ${cup} не найден`);
      return new Map();
    }

    const stages = {
      round_of_16: [
        {
          cells: [
            "B4",
            "B8",
            "B12",
            "B16",
            "B20",
            "B24",
            "B28",
            "B32",
            "B36",
            "B40",
            "B44",
            "B48",
            "B52",
            "B56",
            "B60",
            "B64",
          ],
          position: CupPosition.ROUND_OF_16,
        },
      ],
      round_of_8: [
        {
          cells: ["F6", "F14", "F22", "F30", "F38", "F46", "F54", "F62"],
          position: CupPosition.ROUND_OF_8,
        },
      ],
      semiFinals: [
        {
          cells: ["J10", "J26", "J42", "J58"],
          position: CupPosition.ROUND_OF_4,
        },
      ],
      thirdPlace: [{ cells: ["F70"], position: CupPosition.THIRD_PLACE }],
      finals: [{ cells: ["N18", "N50"], position: CupPosition.RUNNER_UP }],
      winner: [{ cells: ["R34"], position: CupPosition.WINNER }],
    } as Record<string, StageWithCells[]>;

    const errors: string[] = [];

    for (const stage of Object.values(stages)) {
      for (const stageInfo of stage) {
        for (const cellAddress of stageInfo.cells) {
          let player: Player;
          try {
            if (ExcelUtils.isCellEmpty(worksheet[cellAddress])) {
              // Игра за третье место может отсутствовать
              if (stageInfo.position == CupPosition.THIRD_PLACE) {
                continue;
              } else {
                errors.push(
                  `Ячейка ${cellAddress} на листе "Кубок ${cup}" пустая или содержит некорректное значение`
                );
              }
            } else {
              const playerName = ExcelUtils.getCellText(worksheet[cellAddress]);
              player = await this.detectPlayer(playerName);
              const team = this.detectPlayerTeamOrderNum(
                player,
                teams,
                `Кубок ${cup}`
              );

              if (!team) {
                errors.push(
                  `Игрок "${playerName}" с листа ${SWISS_RESULTS_LIST} не найден среди игроков команд на Листе регистрации`
                );
              } else {
                cupTeamResults.set(team.orderNum, stageInfo.position);
              }
            }
          } catch (error) {
            errors.push(`${cellAddress}: ${(error as Error).message}`);
          }
        }
      }
    }

    if (errors.length !== 0) {
      throw new Error(
        `#Ошибки парсинга данных на листе "Кубок ${cup}":\n${errors.join("\n")}`
      );
    }

    console.log(`### Определены результаты кубка ${cup}`);
    for (const [teamOrderNum, results] of cupTeamResults) {
      console.log(
        `Team #${teamOrderNum} : ${JSON.stringify(results, null, 0)}`
      );
    }

    return cupTeamResults;
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
    console.log("🎯 Парсим результаты Швейцарки");

    const errors: string[] = [];

    // Парсим данные из листа
    const swissSheet = ExcelUtils.findXlsSheet(workbook, SWISS_RESULTS_LIST);

    if (!swissSheet) {
      throw new Error(`Отсутствует лист: ${SWISS_RESULTS_LIST}`);
    }

    const teamResults = new Map<number, TeamQualifyingResults>();

    const teamNameColumnHeader = COMMAND_HEADER;
    const teamWinsColumnHeader = "Результат";

    const teamNameColumnCell = ExcelUtils.findCellByText(
      swissSheet,
      teamNameColumnHeader
    );

    if (!teamNameColumnCell) {
      errors.push(`Не найден столбец с заголовком ${teamNameColumnHeader}`);
    }

    const teamWinsColumnCell = ExcelUtils.findCellByText(
      swissSheet,
      teamWinsColumnHeader
    );

    if (!teamWinsColumnCell) {
      errors.push(`Не найден столбец с заголовком ${teamWinsColumnHeader}`);
    }

    if (teamNameColumnCell && teamWinsColumnCell) {
      for (
        let rowIndex = teamNameColumnCell?.rowIndex + 1;
        rowIndex < 100;
        rowIndex++
      ) {
        let teamCell = swissSheet[`${teamNameColumnCell.column}${rowIndex}`];

        const teamCellText = ExcelUtils.getCellText(teamCell);

        if (teamCellText === normalizeName("Свободен") || teamCellText === "") {
          break; //прекращаем разбор таблицы, когда в столбце "Команда" встречаем пустую строку или "Свободен"
        } else {
          console.log(`Найдена команда: "${teamCellText}"`);
          let player: Player;
          try {
            const playerName = ExcelUtils.getCellText(teamCell);
            player = await this.detectPlayer(playerName);

            const team = this.detectPlayerTeamOrderNum(
              player,
              teams,
              SWISS_RESULTS_LIST
            );
            // Парсим количество побед
            const qualifying_wins = Number(
              swissSheet[`${teamWinsColumnCell.column}${rowIndex}`].v
            );

            teamResults.set(team.orderNum, {
              wins: qualifying_wins,
              loses: 5 - qualifying_wins,
            });
          } catch (error) {
            errors.push((error as Error).message);
          }
        }
      }

      if (teamResults.size == 0) {
        errors.push(
          "Не найдено ни одной строки с результатами Швейцарки. Проверьте что после строки заголовков нет пустой строки"
        );
      }
    }

    if (errors.length > 0) {
      throw new Error(
        `#Ошибки на листе "${SWISS_RESULTS_LIST}"\n` + errors.join("\n")
      );
    }
    return teamResults;
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

        const teamWinsColumnHeader = "победы";

        const teamNameColumnCell = ExcelUtils.findCellByText(
          sheet,
          COMMAND_HEADER
        );

        const teamWinsColumnCell = ExcelUtils.findCellByText(
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

            if (ExcelUtils.isCellEmpty(teamCell)) {
              emptyRows++;
              if (emptyRows == 2) {
                break;
              }
            } else {
              emptyRows = 0;
              let player: Player;
              //try {
              const playerName = ExcelUtils.getCellText(teamCell);
              player = await this.detectPlayer(playerName);

              const team = this.detectPlayerTeamOrderNum(
                player,
                teams,
                sheetName
              );
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
      throw new Error(
        `#Ошибки парсинга результатов групп\n` + errors.join(",")
      );
    }

    return teamResults;
  }

  /**
   * Определить пользователя по строке поиска
   * @param playerName : string
   * @returns
   */
  static async detectPlayer(playerName: string): Promise<Player> {
    const normalizedPlayerName = normalizeName(playerName);
    console.debug(`🔍 Ищем игрока: "${playerName}"`);
    const foundedPlayers = await PlayerModel.getPlayerByName(
      normalizedPlayerName
    );
    if (!foundedPlayers || foundedPlayers.length === 0) {
      throw new Error(
        `Игрок "${normalizedPlayerName}" не найден в базе данных`
      );
    }
    if (foundedPlayers.length > 1) {
      throw new Error(
        `Найдено несколько игроков по строке: "${normalizedPlayerName}" - ${foundedPlayers
          .map((x) => x.name)
          .join(",")}`
      );
    }
    return foundedPlayers[0];
  }
}
