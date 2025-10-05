import { CupPosition, PointsReason } from "../types";

/**
 * Рассчитывает общее количество побед на основе квалификационных побед и позиции в кубке
 *
 * Логика расчёта:
 * - Базовое значение = qualifying_wins (количество побед в квалификации)
 * - Бонусы за позицию в кубке:
 *   - CUP_WINNER: +3 победы
 *   - CUP_RUNNER_UP: +2 победы
 *   - CUP_THIRD_PLACE: +2 победы
 *   - CUP_SEMI_FINAL: +1 победа
 *   - CUP_QUARTER_FINAL: +0 побед
 *   - Другие: +0 побед
 *
 * @param cup_position - причина получения очков (позиция в турнире)
 * @param qualifying_wins - количество побед в квалификационной части
 * @returns общее количество побед
 */
export function calculateWins(
  cup_position: CupPosition,
  qualifying_wins: number
): number {
  let totalWins = qualifying_wins;

  // Добавляем победы за позицию в кубке
  switch (cup_position) {
    case CupPosition.WINNER:
      totalWins += 3;
      break;
    case CupPosition.RUNNER_UP:
      totalWins += 2;
      break;
    case CupPosition.THIRD_PLACE:
      totalWins += 2;
      break;
    case CupPosition.SEMI_FINAL:
      totalWins += 1;
      break;
    case CupPosition.QUARTER_FINAL:
      // Четвертьфинал не добавляет победы
      break;
    default:
      // Другие позиции (QUALIFYING_HIGH, QUALIFYING_LOW) не добавляют победы
      break;
  }

  return totalWins;
}

/**
 * Рассчитывает общее количество поражений на основе квалификационных побед и позиции в кубке
 *
 * Логика расчёта:
 * - Базовое значение = max(0, 5 - qualifying_wins) (в швейцарке 5 туров)
 * - Штрафы за позицию в кубке:
 *   - CUP_SEMI_FINAL: +1 поражение (проиграл в полуфинале)
 *   - CUP_THIRD_PLACE: +1 поражение (проиграл в полуфинале, потом матч за 3 место)
 *   - CUP_RUNNER_UP: +1 поражение (проиграл финал)
 *   - CUP_WINNER: +0 поражений
 *   - Другие: +0 поражений
 *
 * @param cup_position - причина получения очков (позиция в турнире)
 * @param qualifying_wins - количество побед в квалификационной части
 * @returns общее количество поражений
 */
export function calculateLoses(
  cup_position: CupPosition,
  qualifying_wins: number
): number {
  // Базовое количество поражений в швейцарке (5 игр всего)
  let totalLoses = Math.max(0, 5 - qualifying_wins);

  // Добавляем поражения за позицию в кубке
  switch (cup_position) {
    case CupPosition.SEMI_FINAL:
      totalLoses += 1; // Проиграл в полуфинале
      break;
    case CupPosition.THIRD_PLACE:
      totalLoses += 1; // Проиграл в полуфинале, потом играл за 3 место
      break;
    case CupPosition.RUNNER_UP:
      totalLoses += 1; // Проиграл финал
      break;
    case CupPosition.WINNER:
      // Победитель не получает дополнительных поражений
      break;
    case CupPosition.QUARTER_FINAL:
      // Четвертьфинал - проиграл в четвертьфинале, но это уже учтено в швейцарке
      break;
    default:
      // Другие позиции (QUALIFYING_HIGH, QUALIFYING_LOW) не добавляют поражений
      break;
  }

  return totalLoses;
}

/**
 * Рассчитывает оба показателя одновременно для эффективности
 * @param cup_position - причина получения очков
 * @param qualifying_wins - количество побед в квалификации
 * @returns объект с количеством побед и поражений
 */
export function calculateWinsAndLoses(
  cup_position: CupPosition,
  qualifying_wins: number
): {
  wins: number;
  loses: number;
} {
  return {
    wins: calculateWins(cup_position, qualifying_wins),
    loses: calculateLoses(cup_position, qualifying_wins),
  };
}
