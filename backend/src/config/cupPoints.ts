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
      [CupPosition.ROUND_OF_4, 6], // 1/2
      [CupPosition.ROUND_OF_8, 5], // 1/4
    ]),
  ],

  // Кубок A, 13-18 команд
  [
    "1-A-13-18",
    new Map([
      [CupPosition.WINNER, 11], // П
      [CupPosition.RUNNER_UP, 9], // Ф
      [CupPosition.ROUND_OF_4, 7], // 1/2
      [CupPosition.ROUND_OF_8, 6], // 1/4
    ]),
  ],

  // Кубок A, 19-24 команды
  [
    "1-A-19-24",
    new Map([
      [CupPosition.WINNER, 12], // П
      [CupPosition.RUNNER_UP, 10], // Ф
      [CupPosition.ROUND_OF_4, 8], // 1/2
      [CupPosition.ROUND_OF_8, 7], // 1/4
    ]),
  ],

  // Кубок A, 25-30 команд
  [
    "1-A-25-30",
    new Map([
      [CupPosition.WINNER, 13], // П
      [CupPosition.RUNNER_UP, 11], // Ф
      [CupPosition.ROUND_OF_4, 9], // 1/2
      [CupPosition.ROUND_OF_8, 8], // 1/4
    ]),
  ],

  // Кубок A, 31-36 команд
  [
    "1-A-31-36",
    new Map([
      [CupPosition.WINNER, 14], // П
      [CupPosition.RUNNER_UP, 12], // Ф
      [CupPosition.ROUND_OF_4, 10], // 1/2
      [CupPosition.ROUND_OF_8, 9], // 1/4
    ]),
  ],

  // Кубок A, >36 команд
  [
    "1-A-36+",
    new Map([
      [CupPosition.WINNER, 16], // П
      [CupPosition.RUNNER_UP, 14], // Ф
      [CupPosition.ROUND_OF_4, 12], // 1/2
      [CupPosition.ROUND_OF_8, 11], // 1/4
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
      [CupPosition.ROUND_OF_4, 4], // 1/2
    ]),
  ],

  // Кубок Б, 25-30 команд
  [
    "1-B-25-30",
    new Map([
      [CupPosition.WINNER, 7], // П
      [CupPosition.RUNNER_UP, 6], // Ф
      [CupPosition.ROUND_OF_4, 5], // 1/2
      [CupPosition.ROUND_OF_8, 4], // 1/4
    ]),
  ],

  // Кубок Б, 31-36 команд
  [
    "1-B-31-36",
    new Map([
      [CupPosition.WINNER, 8], // П
      [CupPosition.RUNNER_UP, 7], // Ф
      [CupPosition.ROUND_OF_4, 6], // 1/2
      [CupPosition.ROUND_OF_8, 5], // 1/4
    ]),
  ],

  // Кубок Б, >36 команд
  [
    "1-B-36+",
    new Map([
      [CupPosition.WINNER, 9], // П
      [CupPosition.RUNNER_UP, 8], // Ф
      [CupPosition.ROUND_OF_4, 7], // 1/2
      [CupPosition.ROUND_OF_8, 6], // 1/4
    ]),
  ],

  // ТУРНИРЫ 2 КАТЕГОРИИ

  // Кубок A, 8-12 команд
  [
    "2-A-8-12",
    new Map([
      [CupPosition.WINNER, 6], // П
      [CupPosition.RUNNER_UP, 5], // Ф
      [CupPosition.ROUND_OF_4, 4], // 1/2
      [CupPosition.ROUND_OF_8, 3], // 1/4
    ]),
  ],

  // Кубок A, 13-18 команд
  [
    "2-A-13-18",
    new Map([
      [CupPosition.WINNER, 7], // П
      [CupPosition.RUNNER_UP, 6], // Ф
      [CupPosition.ROUND_OF_4, 5], // 1/2
      [CupPosition.ROUND_OF_8, 4], // 1/4
    ]),
  ],

  // Кубок A, 19-24 команды
  [
    "2-A-19-24",
    new Map([
      [CupPosition.WINNER, 8], // П
      [CupPosition.RUNNER_UP, 7], // Ф
      [CupPosition.ROUND_OF_4, 6], // 1/2
      [CupPosition.ROUND_OF_8, 5], // 1/4
    ]),
  ],

  // Кубок A, 25-30 команд
  [
    "2-A-25-30",
    new Map([
      [CupPosition.WINNER, 9], // П
      [CupPosition.RUNNER_UP, 8], // Ф
      [CupPosition.ROUND_OF_4, 7], // 1/2
      [CupPosition.ROUND_OF_8, 6], // 1/4
    ]),
  ],

  // Кубок A, 31-36 команд
  [
    "2-A-31-36",
    new Map([
      [CupPosition.WINNER, 10], // П
      [CupPosition.RUNNER_UP, 9], // Ф
      [CupPosition.ROUND_OF_4, 8], // 1/2
      [CupPosition.ROUND_OF_8, 7], // 1/4
    ]),
  ],

  // Кубок A, >36 команд
  [
    "2-A-36+",
    new Map([
      [CupPosition.WINNER, 12], // П
      [CupPosition.RUNNER_UP, 11], // Ф
      [CupPosition.ROUND_OF_4, 10], // 1/2
      [CupPosition.ROUND_OF_8, 9], // 1/4
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
      [CupPosition.ROUND_OF_4, 3], // 1/2
    ]),
  ],

  // Кубок Б, 25-30 команд
  [
    "2-B-25-30",
    new Map([
      [CupPosition.WINNER, 6], // П
      [CupPosition.RUNNER_UP, 5], // Ф
      [CupPosition.ROUND_OF_4, 4], // 1/2
      [CupPosition.ROUND_OF_8, 3], // 1/4
    ]),
  ],

  // Кубок Б, 31-36 команд
  [
    "2-B-31-36",
    new Map([
      [CupPosition.WINNER, 6], // П
      [CupPosition.RUNNER_UP, 5], // Ф
      [CupPosition.ROUND_OF_4, 4], // 1/2
      [CupPosition.ROUND_OF_8, 3], // 1/4
    ]),
  ],

  // Кубок Б, >36 команд
  [
    "2-B-36+",
    new Map([
      [CupPosition.WINNER, 7], // П
      [CupPosition.RUNNER_UP, 6], // Ф
      [CupPosition.ROUND_OF_4, 5], // 1/2
      [CupPosition.ROUND_OF_8, 4], // 1/4
    ]),
  ],
]);

/**
 * Получить очки за позицию в кубке
 *
 * ПРАВИЛА НАЧИСЛЕНИЯ ОЧКОВ:
 *
 * 1) Рейтинговые очки игрокам, не вышедшим в плей-офф, начисляются
 *    в зависимости от числа побед в квалификационном этапе:
 *    - FEDERAL (1 категория): 3+ побед = 3 очка, 1-2 победы = 2 очка, иначе 0
 *    - REGIONAL (2 категория): 3+ побед = 2 очка, 1-2 победы = 1 очко, иначе 0
 *
 * 2) В Кубках А турниров 1 категории победитель игры за третье место
 *    (в том случае, когда она проводится) дополнительно получает 1 очко
 *    относительно очков участника полуфинала
 *
 * 3) В случае проведения утешительного турнира (Кубка С), финалисты этого турнира
 *    дополнительно к очкам, заработанным на квалификационном этапе, получают
 *    по 2 очка, полуфиналисты - по 1 очку
 *
 * 4) Участники кубков A и B получают очки в соответствии с таблицами
 *    (иногда очков за место в кубке может не быть)
 *
 * @param category - категория турнира (FEDERAL=1 или REGIONAL=2)
 * @param cup - тип кубка (A, B, C) или undefined если не вышел в плей-офф
 * @param position - позиция в кубке
 * @param totalTeams - общее количество команд в турнире
 * @param qualifyingWins - количество побед в квалификационном этапе
 * @returns количество рейтинговых очков
 */
export function getPoints(
  category: TournamentCategoryEnum,
  cup: Cup | undefined,
  position: CupPosition | undefined,
  totalTeams: number,
  qualifyingWins: number = 0
): number {
  // ПРАВИЛО 1: Расчет очков за квалификационный этап
  // (для игроков, не вышедших в плей-офф)
  const qualifyingPoints = calculateQualifyingPoints(category, qualifyingWins);

  // Если игрок не вышел в плей-офф (нет кубка), возвращаем только квалификационные очки
  if (!cup) {
    return qualifyingPoints;
  }

  // Игрок вышел в плей-офф, проверяем наличие позиции
  if (!position) {
    throw new Error(`Рассчет очков: Не задана позиция в кубке ${cup}`);
  }

  // ПРАВИЛО 3: Кубок С (утешительный турнир)
  // Игроки получают квалификационные очки + бонус за позицию
  if (cup === "C") {
    return calculateCupCPoints(qualifyingPoints, position);
  }

  // ПРАВИЛА 2 и 4: Кубки А и Б
  // Игроки получают очки по таблице, но если их нет - квалификационные очки
  return calculateCupABPoints(
    category,
    cup,
    position,
    totalTeams,
    qualifyingPoints
  );
}

/**
 * Расчет очков за квалификационный этап
 * ПРАВИЛО 1
 */
function calculateQualifyingPoints(
  category: TournamentCategoryEnum,
  qualifyingWins: number
): number {
  if (qualifyingWins >= 3) {
    // 3 и более побед
    return category === TournamentCategoryEnum.FEDERAL ? 3 : 2;
  } else if (qualifyingWins >= 1) {
    // 1-2 победы
    return category === TournamentCategoryEnum.FEDERAL ? 2 : 1;
  } else {
    // 0 побед
    return 0;
  }
}

/**
 * Расчет очков для Кубка С (утешительный турнир)
 * ПРАВИЛО 3: квалификационные очки + бонус за позицию
 */
function calculateCupCPoints(
  qualifyingPoints: number,
  position: CupPosition
): number {
  if (position === CupPosition.WINNER || position === CupPosition.RUNNER_UP) {
    // Финалисты кубка С: +2 очка к квалификационным
    return qualifyingPoints + 2;
  } else if (
    position === CupPosition.ROUND_OF_4 ||
    position === CupPosition.THIRD_PLACE
  ) {
    // Полуфиналисты кубка С: +1 очко к квалификационным
    return qualifyingPoints + 1;
  } else {
    // Остальные позиции: только квалификационные очки
    return qualifyingPoints;
  }
}

/**
 * Расчет очков для Кубков А и Б по таблицам
 * ПРАВИЛА 2 и 4
 *
 * Если для позиции нет очков в таблице, возвращаются квалификационные очки
 */
function calculateCupABPoints(
  category: TournamentCategoryEnum,
  cup: Cup,
  position: CupPosition,
  totalTeams: number,
  qualifyingPoints: number
): number {
  // Определяем диапазон количества команд для выбора таблицы
  const teamsRange = getTeamsRange(totalTeams);
  const key: CupPointsKey = `${category}-${cup}-${teamsRange}`;

  const cupPointsMap = CUP_POINTS.get(key);

  if (!cupPointsMap) {
    throw new Error(
      `Рассчет очков: ❌ Не найдена конфигурация очков для кубка ${cup} категории ${category} с ${totalTeams} командами (ключ: ${key})`
    );
  }

  // ПРАВИЛО 2: Специальная логика для 3 места в кубке A турниров 1 категории
  if (position === CupPosition.THIRD_PLACE) {
    const semiFinalPoints = cupPointsMap.get(CupPosition.ROUND_OF_4);
    if (semiFinalPoints === undefined) {
      // Если нет очков за полуфинал в таблице, возвращаем квалификационные
      return qualifyingPoints;
    }
    if (category === TournamentCategoryEnum.FEDERAL && cup === "A") {
      // В кубке A категории 1: победитель за 3 место получает очки полуфинала +1
      return semiFinalPoints + 1;
    } else {
      // В остальных случаях: очки полуфинала
      return semiFinalPoints;
    }
  }

  // ПРАВИЛО 4: Получаем очки из таблицы для данной позиции
  const points = cupPointsMap.get(position);
  if (points === undefined) {
    // Если для позиции нет очков в таблице, возвращаем квалификационные
    return qualifyingPoints;
  }
  return points;
}

/**
 * Определяет диапазон количества команд для выбора таблицы очков
 */
function getTeamsRange(totalTeams: number): TeamsRange {
  if (totalTeams <= 12) {
    return "8-12";
  } else if (totalTeams <= 18) {
    return "13-18";
  } else if (totalTeams <= 24) {
    return "19-24";
  } else if (totalTeams <= 30) {
    return "25-30";
  } else if (totalTeams <= 36) {
    return "31-36";
  } else {
    return "36+";
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
