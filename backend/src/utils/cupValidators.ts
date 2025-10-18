import { Cup, CupPosition } from "../types";

/**
 * Проверяет и преобразует строковое значение кубка в тип Cup.
 * Поддерживает латиницу (A, B, C) и кириллицу (А, Б, С) в любом регистре.
 * @param value - строковое значение для проверки
 * @returns Cup ("A" | "B" | "C") или null, если значение не валидно
 */
export function parseCupValue(value: string): Cup | null {
  const normalized = value.trim().toUpperCase();

  // Проверка латиницы
  if (normalized === "A" || normalized === "B" || normalized === "C") {
    return normalized as Cup;
  }

  // Проверка кириллицы и преобразование в латиницу
  switch (normalized) {
    case "А": // Кириллица А
      return "A";
    case "Б": // Кириллица Б
    case "В": // Кириллица В
      return "B";
    case "С": // Кириллица С
      return "C";
    default:
      return null;
  }
}

/**
 * Проверяет и преобразует строковое значение позиции в кубке в тип CupPosition.
 * Поддерживает числовые позиции (1, 2, 3) и раунды (1/2, 1/4, 1/8).
 * @param value - строковое значение для проверки
 * @returns CupPosition или null, если значение не валидно
 */
export function parseCupPosition(value: string): CupPosition | null {
  const normalized = value.trim();

  // Проверка всех возможных значений из enum CupPosition
  switch (normalized) {
    case CupPosition.WINNER: // "1"
    case CupPosition.RUNNER_UP: // "2"
    case CupPosition.THIRD_PLACE: // "3"
    case CupPosition.ROUND_OF_4: // "1/2"
    case CupPosition.ROUND_OF_8: // "1/4"
    case CupPosition.ROUND_OF_16: // "1/8"
      return normalized as CupPosition;
    default:
      return null;
  }
}
