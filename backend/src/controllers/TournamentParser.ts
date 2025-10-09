import * as XLSX from "xlsx";
import { PlayerModel } from "../models/PlayerModel";
import { Cup, CupPosition, Player, StageWithCells } from "../types";
import ExcelUtils from "../utils/excelUtils";

const COMMAND_HEADER = "Команда";
export const REGISTRATION_LIST = "Лист регистрации";
export const SWISS_RESULTS_LIST = "Итоги швейцарки";

// Нормализация имени игрока для сравнения
export function normalizeName(name: string): string {
  return name
    .toLowerCase()
    .replace(/,/g, "") // убираем запятые
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

export type TeamQualifyingResults = {
  wins: number;
  loses: number;
};

export class TournamentParser {
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
      `Команда игрока "${player.name}" (лист "${sheetName}") не найдена на Листе регистрации`
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

    const userDetectErrors = [];

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
    console.log(`🎯 Парсим результаты Кубка ${cup}`);

    let worksheet = ExcelUtils.findXlsSheet(workbook, getCupListName(cup));

    const cupTeamResults: Map<number, CupPosition> = new Map();

    if (!worksheet) {
      console.log(`❌  Лист с результатами кубка ${cup} не найден`);
      return new Map();
    }

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
            errors.push((error as Error).message);
          }
        }
      }
    }

    if (errors.length !== 0) {
      throw new Error(
        `#Ошибки парсинга данных на листе "Кубок ${cup}":\n${errors}`
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

    const errors = [];

    // Парсим данные из листа
    const swissSheet = ExcelUtils.findXlsSheet(workbook, SWISS_RESULTS_LIST);

    if (!swissSheet) {
      throw new Error(`Отсутствует лист: ${SWISS_RESULTS_LIST}`);
    }

    const teamResults = new Map<number, TeamQualifyingResults>();

    const teamNameColumnHeader = "Команда";
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
        console.log(`Название команды: "${teamCellText}"`);

        if (teamCellText === normalizeName("Свободен") || teamCellText === "") {
          break; //прекращаем разбор таблицы, когда в столбце "Команда" встречаем пустую строку или "Свободен"
        } else {
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

        const teamNameColumnHeader = "Команда";
        const teamWinsColumnHeader = "победы";

        const teamNameColumnCell = ExcelUtils.findCellByText(
          sheet,
          teamNameColumnHeader
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
      throw new Error(
        `Найдено несколько игроков по строке: "${teamName}" - ${foundedPlayers
          .map((x) => x.name)
          .join(",")}`
      );
    }
    return foundedPlayers[0];
  }
}
