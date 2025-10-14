import { Cup, CupPosition, TournamentCategoryEnum } from "../types";

// Структура для хранения очков за кубки согласно таблице РФП
// Ключ: "category-cup_type-teams_range"
// Значение: Map<позиция, очки>

type TeamsRange = "8-12" | "13-18" | "19-24" | "25-30" | "31-36" | "36+";
type CupPointsKey = `${TournamentCategoryEnum}-${string}-${TeamsRange}`;

export const CUP_POINTS: Map<CupPointsKey, Map<CupPosition, number>> = new Map([
  // ТУРНИРЫ 1 КАТЕГОРИИ

  // Кубок A, 8-12 команд
  [
    "1-A-8-12",
    new Map([
      [CupPosition.WINNER, 10], // П
      [CupPosition.RUNNER_UP, 8], // Ф
      [CupPosition.SEMI_FINAL, 6], // 1/2
      [CupPosition.QUARTER_FINAL, 5], // 1/4
    ]),
  ],

  // Кубок A, 13-18 команд
  [
    "1-A-13-18",
    new Map([
      [CupPosition.WINNER, 11], // П
      [CupPosition.RUNNER_UP, 9], // Ф
      [CupPosition.SEMI_FINAL, 7], // 1/2
      [CupPosition.QUARTER_FINAL, 6], // 1/4
    ]),
  ],

  // Кубок A, 19-24 команды
  [
    "1-A-19-24",
    new Map([
      [CupPosition.WINNER, 12], // П
      [CupPosition.RUNNER_UP, 10], // Ф
      [CupPosition.SEMI_FINAL, 8], // 1/2
      [CupPosition.QUARTER_FINAL, 7], // 1/4
    ]),
  ],

  // Кубок A, 25-30 команд
  [
    "1-A-25-30",
    new Map([
      [CupPosition.WINNER, 13], // П
      [CupPosition.RUNNER_UP, 11], // Ф
      [CupPosition.SEMI_FINAL, 9], // 1/2
      [CupPosition.QUARTER_FINAL, 8], // 1/4
    ]),
  ],

  // Кубок A, 31-36 команд
  [
    "1-A-31-36",
    new Map([
      [CupPosition.WINNER, 14], // П
      [CupPosition.RUNNER_UP, 12], // Ф
      [CupPosition.SEMI_FINAL, 10], // 1/2
      [CupPosition.QUARTER_FINAL, 9], // 1/4
    ]),
  ],

  // Кубок A, >36 команд
  [
    "1-A-36+",
    new Map([
      [CupPosition.WINNER, 16], // П
      [CupPosition.RUNNER_UP, 14], // Ф
      [CupPosition.SEMI_FINAL, 12], // 1/2
      [CupPosition.QUARTER_FINAL, 11], // 1/4
    ]),
  ],

  // Кубок Б, 13-18 команд (начинается с 13 команд)
  [
    "1-B-13-18",
    new Map([
      [CupPosition.WINNER, 5], // П
      [CupPosition.RUNNER_UP, 4], // Ф
    ]),
  ],

  // Кубок Б, 19-24 команды
  [
    "1-B-19-24",
    new Map([
      [CupPosition.WINNER, 6], // П
      [CupPosition.RUNNER_UP, 5], // Ф
      [CupPosition.SEMI_FINAL, 4], // 1/2
    ]),
  ],

  // Кубок Б, 25-30 команд
  [
    "1-B-25-30",
    new Map([
      [CupPosition.WINNER, 7], // П
      [CupPosition.RUNNER_UP, 6], // Ф
      [CupPosition.SEMI_FINAL, 5], // 1/2
      [CupPosition.QUARTER_FINAL, 4], // 1/4
    ]),
  ],

  // Кубок Б, 31-36 команд
  [
    "1-B-31-36",
    new Map([
      [CupPosition.WINNER, 8], // П
      [CupPosition.RUNNER_UP, 7], // Ф
      [CupPosition.SEMI_FINAL, 6], // 1/2
      [CupPosition.QUARTER_FINAL, 5], // 1/4
    ]),
  ],

  // Кубок Б, >36 команд
  [
    "1-B-36+",
    new Map([
      [CupPosition.WINNER, 9], // П
      [CupPosition.RUNNER_UP, 8], // Ф
      [CupPosition.SEMI_FINAL, 7], // 1/2
      [CupPosition.QUARTER_FINAL, 6], // 1/4
    ]),
  ],

  // ТУРНИРЫ 2 КАТЕГОРИИ

  // Кубок A, 8-12 команд
  [
    "2-A-8-12",
    new Map([
      [CupPosition.WINNER, 6], // П
      [CupPosition.RUNNER_UP, 5], // Ф
      [CupPosition.SEMI_FINAL, 4], // 1/2
      [CupPosition.QUARTER_FINAL, 3], // 1/4
    ]),
  ],

  // Кубок A, 13-18 команд
  [
    "2-A-13-18",
    new Map([
      [CupPosition.WINNER, 7], // П
      [CupPosition.RUNNER_UP, 6], // Ф
      [CupPosition.SEMI_FINAL, 5], // 1/2
      [CupPosition.QUARTER_FINAL, 4], // 1/4
    ]),
  ],

  // Кубок A, 19-24 команды
  [
    "2-A-19-24",
    new Map([
      [CupPosition.WINNER, 8], // П
      [CupPosition.RUNNER_UP, 7], // Ф
      [CupPosition.SEMI_FINAL, 6], // 1/2
      [CupPosition.QUARTER_FINAL, 5], // 1/4
    ]),
  ],

  // Кубок A, 25-30 команд
  [
    "2-A-25-30",
    new Map([
      [CupPosition.WINNER, 9], // П
      [CupPosition.RUNNER_UP, 8], // Ф
      [CupPosition.SEMI_FINAL, 7], // 1/2
      [CupPosition.QUARTER_FINAL, 6], // 1/4
    ]),
  ],

  // Кубок A, 31-36 команд
  [
    "2-A-31-36",
    new Map([
      [CupPosition.WINNER, 10], // П
      [CupPosition.RUNNER_UP, 9], // Ф
      [CupPosition.SEMI_FINAL, 8], // 1/2
      [CupPosition.QUARTER_FINAL, 7], // 1/4
    ]),
  ],

  // Кубок A, >36 команд
  [
    "2-A-36+",
    new Map([
      [CupPosition.WINNER, 12], // П
      [CupPosition.RUNNER_UP, 11], // Ф
      [CupPosition.SEMI_FINAL, 10], // 1/2
      [CupPosition.QUARTER_FINAL, 9], // 1/4
    ]),
  ],

  // Кубок Б, 13-18 команды (начинается с 13 для 2 категории)
  [
    "2-B-13-18",
    new Map([
      [CupPosition.WINNER, 4], // П
      [CupPosition.RUNNER_UP, 3], // Ф
    ]),
  ],

  // Кубок Б, 19-24 команды (начинается с 19 для 2 категории)
  [
    "2-B-19-24",
    new Map([
      [CupPosition.WINNER, 5], // П
      [CupPosition.RUNNER_UP, 4], // Ф
      [CupPosition.SEMI_FINAL, 3], // 1/2
    ]),
  ],

  // Кубок Б, 25-30 команд
  [
    "2-B-25-30",
    new Map([
      [CupPosition.WINNER, 6], // П
      [CupPosition.RUNNER_UP, 5], // Ф
      [CupPosition.SEMI_FINAL, 4], // 1/2
      [CupPosition.QUARTER_FINAL, 3], // 1/4
    ]),
  ],

  // Кубок Б, 31-36 команд
  [
    "2-B-31-36",
    new Map([
      [CupPosition.WINNER, 6], // П
      [CupPosition.RUNNER_UP, 5], // Ф
      [CupPosition.SEMI_FINAL, 4], // 1/2
      [CupPosition.QUARTER_FINAL, 3], // 1/4
    ]),
  ],

  // Кубок Б, >36 команд
  [
    "2-B-36+",
    new Map([
      [CupPosition.WINNER, 7], // П
      [CupPosition.RUNNER_UP, 6], // Ф
      [CupPosition.SEMI_FINAL, 5], // 1/2
      [CupPosition.QUARTER_FINAL, 4], // 1/4
    ]),
  ],
]);

/**
 * Получить очки за позицию в кубке
 * @param category - категория турнира (1 или 2)
 * @param cup - тип кубка (A, B, C)
 * @param position - позиция в кубке
 * @param totalTeams - общее количество команд в турнире
 * @param qualifyingRoundPoints - очки, заработанные в отборочном туре (только для кубка C)
 * @returns количество очков
 */
export function getPoints(
  category: TournamentCategoryEnum,
  cup: Cup | undefined,
  position: CupPosition | undefined,
  totalTeams: number,
  qualifyingWins: number = 0
): number {
  let qualifyingPoints: number;
  let points: number;

  // Очки за победы в квалификационном этапе
  if (qualifyingWins >= 3) {
    // Больше или равно трём победам
    qualifyingPoints = category === TournamentCategoryEnum.FEDERAL ? 3 : 2;
  } else if (qualifyingWins >= 1) {
    // 1-2 победы
    qualifyingPoints = category === TournamentCategoryEnum.FEDERAL ? 2 : 1;
  } else {
    qualifyingPoints = 0;
  }

  if (!cup) {
    return qualifyingPoints;
  } else {
    if (!position) {
      throw new Error(`Рассчет очков: Не задана позиция в кубке ${cup}`);
    }

    // В случае проведения утешительного турнира (Кубка С), финалисты этого турнира дополнительно к очкам, заработанным на квалификационном этапе, получают по 2 очка, полуфиналисты - по 1 очку.
    if (cup === "C") {
      if (
        position === CupPosition.WINNER ||
        position === CupPosition.RUNNER_UP
      ) {
        // Финалисты кубка С получают +2 очка
        return qualifyingPoints + 2;
      } else if (
        position === CupPosition.SEMI_FINAL ||
        position === CupPosition.THIRD_PLACE
      ) {
        // Полуфиналисты кубка С получают +1 очко
        return qualifyingPoints + 1;
      } else {
        return qualifyingPoints;
      }
    } else {
      // Кубки А и Б

      // Определяем диапазон команд
      let teamsRange: TeamsRange;
      if (totalTeams <= 12) {
        teamsRange = "8-12";
      } else if (totalTeams <= 18) {
        teamsRange = "13-18";
      } else if (totalTeams <= 24) {
        teamsRange = "19-24";
      } else if (totalTeams <= 30) {
        teamsRange = "25-30";
      } else if (totalTeams <= 36) {
        teamsRange = "31-36";
      } else {
        teamsRange = "36+";
      }

      const key: CupPointsKey = `${category}-${cup}-${teamsRange}`;
      console.log(`🔑 Ключ для поиска очков: "${key}"`);

      const cupPointsMap = CUP_POINTS.get(key);

      if (!cupPointsMap) {
        throw new Error(
          `Рассчет очков: ❌ Не найдена конфигурация очков для кубка ${cup} категории ${category} с ${totalTeams} командами (ключ: ${key})`
        );
      }

      // Специальная логика для 3 места в кубке A турниров 1 категории
      if (position === CupPosition.THIRD_PLACE) {
        const semiFinalPoints = cupPointsMap.get(CupPosition.SEMI_FINAL);
        if (semiFinalPoints === undefined) {
          throw new Error(
            `Рассчет очков: Не найдены очки за полуфинал для кубка ${cup}`
          );
        }
        if (category === TournamentCategoryEnum.FEDERAL && cup === "A") {
          return semiFinalPoints + 1;
        } else {
          return semiFinalPoints;
        }
      } else {
        const points = cupPointsMap.get(position);
        if (points === undefined) {
          throw new Error(
            `Рассчет очков: Не найдены очки для позиции ${position} в кубке ${cup}`
          );
        }
        return points;
      }
    }
  }
}

/**
 * Получить все доступные конфигурации очков для отладки
 */
export function getAllCupPointsConfig(): Record<
  string,
  Record<string, number>
> {
  const result: Record<string, Record<string, number>> = {};

  CUP_POINTS.forEach((pointsMap, key) => {
    result[key] = {};
    pointsMap.forEach((points, position) => {
      result[key][position] = points;
    });
  });

  return result;
}
