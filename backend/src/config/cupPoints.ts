import { CupPosition } from "../types";
import { calculateWins, calculateLoses } from "../services/winsLosesCalculator";

// Структура для хранения очков за кубки согласно таблице РФП
// Ключ: "category-cup_type-teams_range"
// Значение: Map<позиция, очки>

type TeamsRange = "8-12" | "13-18" | "19-24" | "25-30" | "31-36" | "36+";
type TournamentCategory = "1" | "2"; // 1 - высшая категория, 2 - вторая категория
type CupPointsKey = `${TournamentCategory}-${string}-${TeamsRange}`;

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
export function getCupPoints(
  category: "1" | "2",
  cup: "A" | "B" | "C",
  position: CupPosition,
  totalTeams: number,
  qualifyingRoundPoints: number = 0
): number {
  console.log(`🔍 getCupPoints вызвана с параметрами:`, {
    category,
    cup,
    position,
    totalTeams,
    qualifyingRoundPoints,
  });

  // Специальная обработка для кубка C
  if (cup === "C") {
    let additionalPoints = 0;

    if (position === CupPosition.WINNER || position === CupPosition.RUNNER_UP) {
      // Финалисты кубка С получают +2 очка
      additionalPoints = 2;
    } else if (position === CupPosition.SEMI_FINAL) {
      // Полуфиналисты кубка С получают +1 очко
      additionalPoints = 1;
    }

    const totalPoints = qualifyingRoundPoints + additionalPoints;

    console.log(
      `✅ Кубок C: ${qualifyingRoundPoints} (отборочный) + ${additionalPoints} (дополнительные) = ${totalPoints} очков`
    );

    return totalPoints;
  }

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
    console.warn(
      `❌ Не найдена конфигурация очков для кубка ${cup} категории ${category} с ${totalTeams} командами (ключ: ${key})`
    );
    console.log("🗂️ Доступные ключи:", Array.from(CUP_POINTS.keys()));
    return 0;
  }

  // Специальная логика для 3 места
  if (position === CupPosition.THIRD_PLACE) {
    // За 3 место даётся столько же очков, сколько за полуфинал
    const semiFinalPoints = cupPointsMap.get(CupPosition.SEMI_FINAL);
    if (semiFinalPoints === undefined) {
      console.warn(`Не найдены очки за полуфинал для кубка ${cup}`);
      return 0;
    }

    // Для кубка A турниров 1 категории добавляется +1 очко за игру за 3 место
    const bonusPoint = category === "1" && cup === "A" ? 1 : 0;
    const totalPoints = semiFinalPoints + bonusPoint;

    console.log(
      `✅ Очки за 3 место в кубке ${cup} категории ${category}: полуфинал ${semiFinalPoints} + бонус ${bonusPoint} = ${totalPoints}`
    );

    return totalPoints;
  }

  const points = cupPointsMap.get(position);
  if (points === undefined) {
    console.warn(`❌ Не найдены очки для позиции ${position} в кубке ${cup}`);
    console.log("🗂️ Доступные позиции:", Array.from(cupPointsMap.keys()));
    return 0;
  }

  console.log(
    `✅ Найдены очки: ${points} для позиции ${position} в кубке ${cup}`
  );
  return points;
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

/**
 * Получить пример расчета очков для демонстрации
 */
/**
 * Получить очки за количество побед команды
 * @param category - категория турнира (1 или 2)
 * @param qualifying_wins - количество побед команды
 * @returns количество очков за победы
 */
export function getPointsByQualifyingStage(
  category: "1" | "2",
  qualifying_wins: number
): number {
  console.log(`🏆 getWinsPoints вызвана с параметрами:`, {
    category,
    qualifying_wins,
  });

  if (qualifying_wins === 0) {
    console.log(`✅ 0 побед = 0 очков`);
    return 0;
  }

  let points: number;

  if (qualifying_wins >= 3) {
    // Больше или равно трём победам
    points = category === "1" ? 3 : 2;
    console.log(
      `✅ ${qualifying_wins} побед (≥3) в категории ${category} = ${points} очков`
    );
  } else if (qualifying_wins >= 1) {
    // 1-2 победы
    points = category === "1" ? 2 : 1;
    console.log(
      `✅ ${qualifying_wins} побед (1-2) в категории ${category} = ${points} очков`
    );
  } else {
    points = 0;
    console.log(`✅ ${qualifying_wins} побед = 0 очков`);
  }

  return points;
}

export function getPointsExample(): Record<string, any> {
  return {
    description:
      "Примеры начисления очков согласно таблице РФП и системе побед",
    cupExamples: [
      {
        scenario: "16 команд, турнир 1 категории, Кубок А, победитель",
        teams: 16,
        category: "1",
        cup: "A",
        position: "1",
        points: getCupPoints("1", "A", CupPosition.WINNER, 16),
      },
      {
        scenario: "24 команды, турнир 1 категории, Кубок Б, полуфинал",
        teams: 24,
        category: "1",
        cup: "B",
        position: "1/2",
        points: getCupPoints("1", "B", CupPosition.SEMI_FINAL, 24),
      },
      {
        scenario: "40 команд, турнир 2 категории, Кубок А, финалист",
        teams: 40,
        category: "2",
        cup: "A",
        position: "2",
        points: getCupPoints("2", "A", CupPosition.RUNNER_UP, 40),
      },
      {
        scenario:
          "20 команд, турнир 1 категории, Кубок А, 3 место (полуфинал + 1 бонус)",
        teams: 20,
        category: "1",
        cup: "A",
        position: "3",
        points: getCupPoints("1", "A", CupPosition.THIRD_PLACE, 20),
        explanation:
          "3 место = полуфинал (8 очков) + бонус за игру за 3 место (1 очко) = 9 очков",
      },
      {
        scenario:
          "20 команд, турнир 1 категории, Кубок Б, 3 место (только полуфинал)",
        teams: 20,
        category: "1",
        cup: "B",
        position: "3",
        points: getCupPoints("1", "B", CupPosition.THIRD_PLACE, 20),
        explanation: "3 место = полуфинал (4 очка), бонус только для кубка А",
      },
      {
        scenario:
          "20 команд, турнир 2 категории, Кубок А, 3 место (только полуфинал)",
        teams: 20,
        category: "2",
        cup: "A",
        position: "3",
        points: getCupPoints("2", "A", CupPosition.THIRD_PLACE, 20),
        explanation:
          "3 место = полуфинал (6 очков), бонус только для 1 категории",
      },
      {
        scenario: "20 команд, кубок С, финалист (5 очков в отборочном туре)",
        qualifyingRoundPoints: 5,
        cup: "C",
        position: "финалист",
        points: getCupPoints("1", "C", CupPosition.RUNNER_UP, 20, 5),
        explanation:
          "Кубок С: 5 (отборочный тур) + 2 (бонус за финал) = 7 очков",
      },
      {
        scenario: "30 команд, кубок С, полуфиналист (3 очка в отборочном туре)",
        qualifyingRoundPoints: 3,
        cup: "C",
        position: "полуфинал",
        points: getCupPoints("2", "C", CupPosition.SEMI_FINAL, 30, 3),
        explanation:
          "Кубок С: 3 (отборочный тур) + 1 (бонус за полуфинал) = 4 очка",
      },
      {
        scenario:
          "25 команд, кубок С, четвертьфиналист (2 очка в отборочном туре)",
        qualifyingRoundPoints: 2,
        cup: "C",
        position: "четвертьфинал",
        points: getCupPoints("1", "C", CupPosition.QUARTER_FINAL, 25, 2),
        explanation: "Кубок С: 2 (отборочный тур) + 0 (нет бонуса) = 2 очка",
      },
    ],
    winsExamples: [
      {
        scenario: "Турнир 1 категории, команда с 5 победами",
        category: "1",
        qualifying_wins: 5,
        wins: calculateWins("QUALIFYING_HIGH", 5),
        loses: calculateLoses("QUALIFYING_HIGH", 5),
        points: getPointsByQualifyingStage("1", 5),
        explanation: "≥3 побед в 1 категории = 3 очка",
      },
      {
        scenario: "Турнир 1 категории, команда с 2 победами",
        category: "1",
        qualifying_wins: 2,
        wins: calculateWins("QUALIFYING_LOW", 2),
        loses: calculateLoses("QUALIFYING_LOW", 2),
        points: getPointsByQualifyingStage("1", 2),
        explanation: "1-2 победы в 1 категории = 2 очка",
      },
      {
        scenario: "Турнир 2 категории, команда с 4 победами",
        category: "2",
        qualifying_wins: 4,
        wins: calculateWins("QUALIFYING_HIGH", 4),
        loses: calculateLoses("QUALIFYING_HIGH", 4),
        points: getPointsByQualifyingStage("2", 4),
        explanation: "≥3 побед во 2 категории = 2 очка",
      },
      {
        scenario: "Турнир 2 категории, команда с 1 победой",
        category: "2",
        qualifying_wins: 1,
        wins: calculateWins("QUALIFYING_LOW", 1),
        loses: calculateLoses("QUALIFYING_LOW", 1),
        points: getPointsByQualifyingStage("2", 1),
        explanation: "1-2 победы во 2 категории = 1 очко",
      },
      {
        scenario: "Команда без побед",
        category: "1",
        qualifying_wins: 0,
        wins: calculateWins("QUALIFYING_LOW", 0),
        loses: calculateLoses("QUALIFYING_LOW", 0),
        points: getPointsByQualifyingStage("1", 0),
        explanation: "0 побед = 0 очков",
      },
    ],
    ranges: {
      "8-12": "8-12 команд",
      "13-18": "13-18 команд",
      "19-24": "19-24 команды",
      "25-30": "25-30 команд",
      "31-36": "31-36 команд",
      "36+": "более 36 команд",
    },
    categories: {
      "1": "Турниры 1 категории (высшая)",
      "2": "Турниры 2 категории",
    },
  };
}
