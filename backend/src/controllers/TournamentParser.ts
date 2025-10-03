import * as XLSX from "xlsx";
import {
  CupPosition,
  CupTeamResult,
  PlayersTeam,
  StageInfo,
  Team,
} from "../types";
import { PlayerModel } from "../models/PlayerModel";

type SheetCell = {
  columnIndex: number;
  rowIndex: number;
};

type FoundedSheet = {
  sheet: XLSX.WorkSheet;
  name: string;
};

export const swissResultsSheetName = "Итоги Швейцарки";

// Нормализация имени игрока для сравнения
export function normalizeName(name: string): string {
  return name
    .toLowerCase()
    .replace(/\s+/g, " ") // заменяем множественные пробелы на одинарные
    .replace(/[-.]/g, " ") // заменяем дефисы и точки на пробелы
    .trim();
}

export class TournamentParser {
  /**
   * Парсит команды из листа регистрации
   * @param workbook
   * @returns
   */
  static async parseTeamsFromRegistrationSheet(
    workbook: XLSX.WorkBook
  ): Promise<Team[]> {
    const possibleRegistrationSheetNames = [
      "Лист регистрации",
      "Лист Регистрации",
    ];

    let registrationSheet: XLSX.WorkSheet | null = null;
    let foundSheetName: string | null = null;

    for (const possibleName of possibleRegistrationSheetNames) {
      if (workbook.Sheets[possibleName]) {
        registrationSheet = workbook.Sheets[possibleName];
        foundSheetName = possibleName;
        break;
      }
    }

    if (!registrationSheet && workbook.SheetNames.length > 0) {
      const firstSheetName = workbook.SheetNames[0];
      registrationSheet = workbook.Sheets[firstSheetName];
      foundSheetName = firstSheetName;
      console.log(
        `Не найден лист регистрации с ожидаемым названием. Используется первый лист: "${firstSheetName}"`
      );
    }

    if (!registrationSheet) {
      const availableSheets = workbook.SheetNames.join(", ");
      throw new Error(
        `Не найден лист регистрации команд. Проверенные варианты: ${possibleRegistrationSheetNames.join(
          ", "
        )}. Доступные листы в файле: ${availableSheets}`
      );
    }

    console.log(`Найден лист регистрации: "${foundSheetName}"`);

    const teams: Team[] = [];

    const registrationData = XLSX.utils.sheet_to_json(registrationSheet, {
      header: 1,
    });

    if (registrationData.length === 0) {
      throw new Error(
        `Лист "${foundSheetName}" пуст или не содержит данных для парсинга`
      );
    }

    console.log(
      `Найдено строк в листе регистрации: ${registrationData.length}`
    );

    for (let i = 0; i < registrationData.length; i++) {
      const row = registrationData[i] as any[];
      if (row && row.length >= 2) {
        const colA = String(row[0] || "").toLowerCase();
        const colB = String(row[1] || "").toLowerCase();
        if (colA.includes("№") && colB.includes("команда")) {
          continue;
        }
        const teamNumber = parseInt(String(row[0]));
        if (!isNaN(teamNumber)) {
          const players: string[] = [];
          const playersString = String(row[1] || "").trim();
          if (playersString) {
            const parsedPlayers = playersString
              .split(",")
              .map((player) => normalizeName(player))
              .filter((player) => player && player !== "undefined");

            for (const rawPlayerName of parsedPlayers) {
              const foundedPlayer = await PlayerModel.getPlayerByName(
                rawPlayerName
              );
              console.log(`Найденный игрок: ${foundedPlayer}`);

              if (foundedPlayer) {
                players.push(foundedPlayer.name);
              } else {
                throw new Error(
                  `Игрок с листа регистрации: "${rawPlayerName}" не найден в базе данных.\nУкажите на листе регистрации полнную фамилию и имя игрока, либо создайте игрока в Админ панели`
                );
              }
            }
          }

          if (players.length > 0) {
            teams.push({
              number: teamNumber,
              players: players,
            });
          }
        }
      }
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
  static parseCupResults(
    workbook: XLSX.WorkBook,
    teams: Team[]
  ): CupTeamResult[] {
    const playerToTeam = new Map<string, Team>();
    teams.forEach((team) => {
      team.players.forEach((player) => {
        playerToTeam.set(player.toLowerCase(), team);
      });
    });

    const cupResults: CupTeamResult[] = [];
    const cupNames = ["A", "B", "C"] as const;

    for (const cupName of cupNames) {
      const possibleSheetNames = [
        `Кубок ${cupName}`,
        `Кубок${cupName}`,
        `КУБОК ${cupName}`,
        cupName === "A" ? "Кубок А" : "Кубок Б",
      ];

      let worksheet: XLSX.WorkSheet | null = null;
      let foundSheetName: string | null = null;

      for (const possibleName of possibleSheetNames) {
        if (workbook.Sheets[possibleName]) {
          worksheet = workbook.Sheets[possibleName];
          foundSheetName = possibleName;
          break;
        }
      }

      if (!worksheet) {
        console.log(
          `Лист для кубка ${cupName} не найден, пропускаем. Проверены варианты: ${possibleSheetNames.join(
            ", "
          )}`
        );
        continue;
      }

      console.log(`Найден лист кубка ${cupName}: "${foundSheetName}"`);

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
        finals: [{ cells: ["J10", "J26"], position: CupPosition.RUNNER_UP }],
        thirdPlace: [{ range: "F38", position: CupPosition.THIRD_PLACE }],
      } as Record<string, StageInfo[]>;

      const cupTeamResults: Array<{ team: Team; position: CupPosition }> = [];

      const positionPriority: { [key: string]: number } = {
        [CupPosition.WINNER]: 5,
        [CupPosition.RUNNER_UP]: 4,
        [CupPosition.THIRD_PLACE]: 3,
        [CupPosition.SEMI_FINAL]: 2,
        [CupPosition.QUARTER_FINAL]: 1,
      };

      Object.values(stages).forEach((stageRanges) => {
        stageRanges.forEach((stageInfo: StageInfo) => {
          const cellsToProcess: string[] = [];
          if ("cells" in stageInfo) {
            cellsToProcess.push(...stageInfo.cells);
          } else if ("range" in stageInfo) {
            const range = XLSX.utils.decode_range(stageInfo.range);
            for (let row = range.s.r; row <= range.e.r; row++) {
              for (let col = range.s.c; col <= range.e.c; col++) {
                const cellAddress = XLSX.utils.encode_cell({ r: row, c: col });
                cellsToProcess.push(cellAddress);
              }
            }
          }

          cellsToProcess.forEach((cellAddress: string) => {
            const cell = (worksheet as XLSX.WorkSheet)[cellAddress];

            if (cell && cell.v && typeof cell.v === "string" && cell.v.trim()) {
              const playerName = cell.v.trim();
              const team = playerToTeam.get(playerName.toLowerCase());

              if (team) {
                const existingResultIndex = cupTeamResults.findIndex(
                  (r) => r.team.number === team.number
                );

                if (existingResultIndex !== -1) {
                  const existingPriority =
                    positionPriority[
                      cupTeamResults[existingResultIndex].position
                    ] || 0;
                  const newPriority = positionPriority[stageInfo.position] || 0;
                  if (newPriority > existingPriority) {
                    cupTeamResults[existingResultIndex].position =
                      stageInfo.position;
                  }
                } else {
                  cupTeamResults.push({ team, position: stageInfo.position });
                }
              } else {
                console.log(`Игрок "${playerName}" не найден в командах`);
              }
            }
          });
        });
      });

      try {
        const winnerCell = (worksheet as XLSX.WorkSheet)["N18"];
        if (
          winnerCell &&
          winnerCell.v &&
          typeof winnerCell.v === "string" &&
          winnerCell.v.trim()
        ) {
          const winnerPlayerName = winnerCell.v.trim();
          const winnerTeam = playerToTeam.get(winnerPlayerName.toLowerCase());
          if (winnerTeam) {
            const winnerTeamIndex = cupTeamResults.findIndex(
              (r) => r.team.number === winnerTeam.number
            );
            if (winnerTeamIndex !== -1) {
              cupTeamResults[winnerTeamIndex].position = CupPosition.WINNER;
              console.log(
                `Победитель кубка ${cupName}: команда ${winnerTeam.number} (${winnerPlayerName})`
              );
            } else {
              cupTeamResults.push({
                team: winnerTeam,
                position: CupPosition.WINNER,
              });
              console.log(
                `Добавлен победитель кубка ${cupName}: команда ${winnerTeam.number} (${winnerPlayerName})`
              );
            }
          } else {
            console.warn(
              `Команда игрока-победителя "${winnerPlayerName}" не найдена в ячейке N18 кубка ${cupName}`
            );
          }
        } else {
          console.warn(
            `Ячейка N18 пуста или не содержит данных о победителе в кубке ${cupName}`
          );
        }
      } catch (error) {
        console.error(
          `Ошибка при чтении победителя из ячейки N18 в кубке ${cupName}:`,
          error
        );
      }

      cupTeamResults.forEach((result) => {
        cupResults.push({
          team: result.team,
          cup: cupName,
          points_reason: result.position,
        });
      });
    }

    return cupResults;
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
      //const pattern = /^Группа \w+$/; // Регулярное выражение для "Группа [X]"

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
  static parseSwissSystemResults(swissSheet: XLSX.Sheet): Map<string, number> {
    try {
      // Парсим данные из листа
      const swissData = XLSX.utils.sheet_to_json(swissSheet.sheet, {
        header: 1,
      });

      const teamWins = new Map<string, number>();

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
          continue; // Пропускаем пустые строки
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

        teamWins.set(normalizeName(normalizeName(teamName)), qualifying_wins);
        console.log(
          `Найдена команда "${teamName}" с ${qualifying_wins} побед(ами)`
        );
      }

      return teamWins;
    } catch (error) {
      console.error(`Ошибка при парсинге результатов Швейцарки`, error);
      return new Map(); // Возвращаем пустую карту при ошибке
    }
  }

  /**
   * Поиск столбца с заголовком
   * @param sheet
   * @param header
   * @returns
   */
  static findCellByText(
    sheet: XLSX.WorkSheet,
    textToFind: string
  ): SheetCell | null {
    for (let row = 0; row < sheet.length; row++) {
      for (let col = 0; col < sheet[row].length; col++) {
        if (sheet[row][col] === textToFind) {
          return { columnIndex: col, rowIndex: row + 1 };
        }
      }
    }
    return null; // Если не найдена
  }

  /**
   * Парсинг листов групповых игр для извлечения количества побед команд
   * @param workbook
   * @returns
   */
  static parseGroupResults(workbook: XLSX.WorkBook): Map<string, number> {
    const teamWins = new Map<string, number>();

    for (const sheet of Object.values(workbook.Sheets)) {
      if (sheet.sheetName.includes("Группа")) {
        // Парсим данные из листа

        console.log(`Парсим данные с листа: "${sheet.sheetName}"`);

        const swissData = XLSX.utils.sheet_to_json(sheet, { header: 1 });

        const teamNameColumnHeader = "Команда";
        const teamWinsColumnHeader = "Победы";

        const teamNameColumnCell = this.findCellByText(
          sheet,
          teamNameColumnHeader
        );

        const teamWinsColumnCell = this.findCellByText(
          sheet,
          teamWinsColumnHeader
        );

        if (teamNameColumnCell && teamWinsColumnCell) {
          for (
            let rowIndex = teamNameColumnCell?.rowIndex + 1;
            rowIndex < swissData.length;
            rowIndex++
          ) {
            const row = swissData[rowIndex] as any[];

            const teamNameColumnIndex = teamNameColumnCell.columnIndex;
            const teamWinsColumnIndex = teamWinsColumnCell.columnIndex;

            let teamName = row[teamNameColumnIndex];

            if (!teamName || teamName === "" || typeof teamName !== "string") {
              break;
            }

            teamName = teamName.replace(/,?$/, "").trim();
            // Парсим количество побед
            let qualifying_wins = 0;

            const winsValue = row[teamWinsColumnIndex];

            if (typeof winsValue === "number") {
              qualifying_wins = Math.floor(winsValue); // Округляем до целого числа
            } else if (typeof winsValue === "string") {
              const parsed = parseInt(winsValue, 10);
              qualifying_wins = isNaN(parsed) ? 0 : parsed;
            } else if (winsValue === undefined || winsValue === null) {
              qualifying_wins = 0;
            }

            teamWins.set(
              normalizeName(normalizeName(teamName)),
              qualifying_wins
            );
            console.log(
              `Найдена команда "${teamName}" с ${qualifying_wins} побед(ами)`
            );
          }
        }
      }
    }

    return teamWins;
  }
}
