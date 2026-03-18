import {
  Cup,
  CupPosition,
  TournamentCategoryEnum,
  TournamentType,
} from "../types";

// Структура для хранения очков за кубки согласно таблице РФП
// Ключ: "category-cup_type-teams_range"
// Значение: Map<позиция, очки>

type PlayersRange = "36-60" | "61-84" | "85-108" | "109+";
type CupPointsKey = `${TournamentCategoryEnum}-${string}-${PlayersRange}`;

export const CUP_POINTS: Map<CupPointsKey, Map<CupPosition, number>> = new Map([
  // ТУРНИРЫ 1 КАТЕГОРИИ

  // Кубок A, 61-84 участников
  [
    "1-A-61-84",
    new Map([
      [CupPosition.WINNER, 13], // П
      [CupPosition.RUNNER_UP, 11], // Ф
      [CupPosition.ROUND_OF_4, 10], // 1/2
      [CupPosition.ROUND_OF_8, 9], // 1/4
    ]),
  ],

  // Кубок A, 85-108 участников
  [
    "1-A-85-108",
    new Map([
      [CupPosition.WINNER, 15], // П
      [CupPosition.RUNNER_UP, 13], // Ф
      [CupPosition.ROUND_OF_4, 11], // 1/2
      [CupPosition.ROUND_OF_8, 10], // 1/4
      [CupPosition.ROUND_OF_16, 9], // 1/8
    ]),
  ],

  // Кубок A, > 109 участников
  [
    "1-A-109+",
    new Map([
      [CupPosition.WINNER, 17], // П
      [CupPosition.RUNNER_UP, 15], // Ф
      [CupPosition.ROUND_OF_4, 13], // 1/2
      [CupPosition.ROUND_OF_8, 11], // 1/4
      [CupPosition.ROUND_OF_16, 10], // 1/8
    ]),
  ],

  // Кубок Б
  [
    "1-B-61-84",
    new Map([
      [CupPosition.WINNER, 9], // П
      [CupPosition.RUNNER_UP, 8], // Ф
      [CupPosition.ROUND_OF_4, 7], // 1/2
      [CupPosition.ROUND_OF_8, 6], // 1/4
    ]),
  ],

  // Кубок Б, 19-24 команды
  [
    "1-B-85-108",
    new Map([
      [CupPosition.WINNER, 10], // П
      [CupPosition.RUNNER_UP, 9], // Ф
      [CupPosition.ROUND_OF_4, 8], // 1/2
      [CupPosition.ROUND_OF_8, 7], // 1/4
      [CupPosition.ROUND_OF_16, 6], // 1/8
    ]),
  ],

  // Кубок Б
  [
    "1-B-109+",
    new Map([
      [CupPosition.WINNER, 11], // П
      [CupPosition.RUNNER_UP, 10], // Ф
      [CupPosition.ROUND_OF_4, 9], // 1/2
      [CupPosition.ROUND_OF_8, 8], // 1/4
      [CupPosition.ROUND_OF_16, 7], // 1/8
    ]),
  ],

  // ##### ТУРНИРЫ 2 КАТЕГОРИИ #####

  [
    "2-A-36-60",
    new Map([
      [CupPosition.WINNER, 9], // П
      [CupPosition.RUNNER_UP, 7], // Ф
      [CupPosition.ROUND_OF_4, 6], // 1/2
    ]),
  ],
  [
    "2-A-61-84",
    new Map([
      [CupPosition.WINNER, 11], // П
      [CupPosition.RUNNER_UP, 9], // Ф
      [CupPosition.ROUND_OF_4, 8], // 1/2
      [CupPosition.ROUND_OF_8, 7], // 1/4
    ]),
  ],
  [
    "2-A-85-108",
    new Map([
      [CupPosition.WINNER, 13], // П
      [CupPosition.RUNNER_UP, 11], // Ф
      [CupPosition.ROUND_OF_4, 10], // 1/2
      [CupPosition.ROUND_OF_8, 9], // 1/4
      [CupPosition.ROUND_OF_16, 8], // 1/8
    ]),
  ],

  // Кубок A, > 109 участников
  [
    "2-A-109+",
    new Map([
      [CupPosition.WINNER, 15], // П
      [CupPosition.RUNNER_UP, 13], // Ф
      [CupPosition.ROUND_OF_4, 11], // 1/2
      [CupPosition.ROUND_OF_8, 10], // 1/4
      [CupPosition.ROUND_OF_16, 9], // 1/8
    ]),
  ],

  // Кубок Б
  [
    "2-B-36-60",
    new Map([
      [CupPosition.WINNER, 5], // П
      [CupPosition.RUNNER_UP, 4], // Ф
    ]),
  ],
  [
    "2-B-61-84",
    new Map([
      [CupPosition.WINNER, 7], // П
      [CupPosition.RUNNER_UP, 6], // Ф
      [CupPosition.ROUND_OF_4, 5], // 1/2
    ]),
  ],
  [
    "2-B-85-108",
    new Map([
      [CupPosition.WINNER, 9], // П
      [CupPosition.RUNNER_UP, 8], // Ф
      [CupPosition.ROUND_OF_4, 7], // 1/2
      [CupPosition.ROUND_OF_8, 6], // 1/4
    ]),
  ],
  [
    "2-B-109+",
    new Map([
      [CupPosition.WINNER, 1101], // П
      [CupPosition.RUNNER_UP, 9], // Ф
      [CupPosition.ROUND_OF_4, 8], // 1/2
      [CupPosition.ROUND_OF_8, 7], // 1/4
      [CupPosition.ROUND_OF_16, 6], // 1/8
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
  tournamentType: TournamentType,
  category: TournamentCategoryEnum,
  cup: Cup | undefined,
  position: CupPosition | undefined,
  totalTeams: number,
  qualifyingWins: number = 0,
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
    tournamentType,
    category,
    cup,
    position,
    totalTeams,
    qualifyingPoints,
  );
}

/**
 * Расчет очков за квалификационный этап
 * ПРАВИЛО 1
 */
function calculateQualifyingPoints(
  category: TournamentCategoryEnum,
  qualifyingWins: number,
): number {
  if (qualifyingWins >= 3) {
    // 3 и более побед
    return category === TournamentCategoryEnum.FEDERAL ? 4 : 3;
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
  position: CupPosition,
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
  tournamentType: TournamentType,
  category: TournamentCategoryEnum,
  cup: Cup,
  position: CupPosition,
  totalTeams: number,
  qualifyingPoints: number,
): number {
  // Определяем диапазон количества команд для выбора таблицы
  const teamsRange = getPlayersRange(totalTeams, tournamentType);
  const key: CupPointsKey = `${category}-${cup}-${teamsRange}`;

  const cupPointsMap = CUP_POINTS.get(key);

  if (!cupPointsMap) {
    throw new Error(
      `Рассчет очков: ❌ Не найдена конфигурация очков для кубка ${cup} категории ${category} с ${totalTeams} командами (ключ: ${key})`,
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
 * Определяет диапазон количества игроков для выбора таблицы очков
 */
function getPlayersRange(
  totalTeams: number,
  tournamentType: TournamentType,
): PlayersRange {
  let playersCount = totalTeams;

  if (
    tournamentType === TournamentType.DOUBLETTE_MALE ||
    tournamentType === TournamentType.DOUBLETTE_FEMALE ||
    tournamentType === TournamentType.DOUBLETTE_MIXT
  ) {
    playersCount = totalTeams * 2;
  } else if (tournamentType === TournamentType.TRIPLETTE) {
    playersCount = totalTeams * 3;
  }

  if (playersCount <= 60) {
    return "36-60";
  } else if (playersCount <= 84) {
    return "61-84";
  } else if (playersCount <= 108) {
    return "85-108";
  } else {
    return "109+";
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
