import {
  calculateWins,
  calculateLoses,
  calculateWinsAndLoses,
} from "../winsLosesCalculator";
import { CupPosition } from "../../types";

describe("WinsLosesCalculator", () => {
  describe("calculateWins", () => {
    it("должен правильно рассчитывать победы для CUP_WINNER", () => {
      const qualifying_wins = 3;
      const cup_position = CupPosition.WINNER;

      const result = calculateWins(cup_position, qualifying_wins);

      // 3 квалификационные победы + 3 бонусные за победу в кубке = 6
      expect(result).toBe(6);
    });

    it("должен правильно рассчитывать победы для CUP_RUNNER_UP", () => {
      const qualifying_wins = 4;
      const cup_position = CupPosition.RUNNER_UP;

      const result = calculateWins(cup_position, qualifying_wins);

      // 4 квалификационные победы + 2 бонусные за финал = 6
      expect(result).toBe(6);
    });

    it("должен правильно рассчитывать победы для CUP_THIRD_PLACE", () => {
      const qualifying_wins = 2;
      const cup_position = CupPosition.THIRD_PLACE;

      const result = calculateWins(cup_position, qualifying_wins);

      // 2 квалификационные победы + 2 бонусные за 3 место = 4
      expect(result).toBe(4);
    });

    it("должен правильно рассчитывать победы для CUP_SEMI_FINAL", () => {
      const qualifying_wins = 3;
      const cup_position = CupPosition.SEMI_FINAL;

      const result = calculateWins(cup_position, qualifying_wins);

      // 3 квалификационные победы + 1 бонусная за полуфинал = 4
      expect(result).toBe(4);
    });

    it("должен правильно рассчитывать победы для CUP_QUARTER_FINAL", () => {
      const qualifying_wins = 3;
      const cup_position = CupPosition.QUARTER_FINAL;

      const result = calculateWins(cup_position, qualifying_wins);

      // 3 квалификационные победы + 0 бонусных за четвертьфинал = 3
      expect(result).toBe(3);
    });

    it("должен работать со строковыми значениями cup_position", () => {
      const qualifying_wins = 3;
      const cup_position = CupPosition.WINNER;

      const result = calculateWins(cup_position, qualifying_wins);

      expect(result).toBe(6);
    });

    it("должен обрабатывать нулевое количество qualifying_wins", () => {
      const qualifying_wins = 0;
      const cup_position = CupPosition.WINNER;

      const result = calculateWins(cup_position, qualifying_wins);

      // 0 квалификационных + 3 бонусные = 3
      expect(result).toBe(3);
    });
  });

  describe("calculateLoses", () => {
    it("должен правильно рассчитывать поражения для CUP_WINNER", () => {
      const qualifying_wins = 5;
      const cup_position = CupPosition.WINNER;

      const result = calculateLoses(cup_position, qualifying_wins);

      // max(0, 5-5) + 0 за победу в кубке = 0
      expect(result).toBe(0);
    });

    it("должен правильно рассчитывать поражения для CUP_RUNNER_UP", () => {
      const qualifying_wins = 4;
      const cup_position = CupPosition.RUNNER_UP;

      const result = calculateLoses(cup_position, qualifying_wins);

      // max(0, 5-4) + 1 за поражение в финале = 2
      expect(result).toBe(2);
    });

    it("должен правильно рассчитывать поражения для CUP_THIRD_PLACE", () => {
      const qualifying_wins = 3;
      const cup_position = CupPosition.THIRD_PLACE;

      const result = calculateLoses(cup_position, qualifying_wins);

      // max(0, 5-3) + 1 за поражение в полуфинале = 3
      expect(result).toBe(3);
    });

    it("должен правильно рассчитывать поражения для CUP_SEMI_FINAL", () => {
      const qualifying_wins = 3;
      const cup_position = CupPosition.SEMI_FINAL;

      const result = calculateLoses(cup_position, qualifying_wins);

      // max(0, 5-3) + 1 за поражение в полуфинале = 3
      expect(result).toBe(3);
    });

    it("должен правильно рассчитывать поражения для CUP_QUARTER_FINAL", () => {
      const qualifying_wins = 2;
      const cup_position = CupPosition.QUARTER_FINAL;

      const result = calculateLoses(cup_position, qualifying_wins);

      // max(0, 5-2) + 0 за четвертьфинал = 3
      expect(result).toBe(3);
    });

    it("должен обрабатывать случай с нулевыми квалификационными победами", () => {
      const qualifying_wins = 0;
      const cup_position = CupPosition.RUNNER_UP;

      const result = calculateLoses(cup_position, qualifying_wins);

      // max(0, 5-0) + 1 за поражение в финале = 6
      expect(result).toBe(6);
    });

    it("должен работать со строковыми значениями cup_position", () => {
      const qualifying_wins = 3;
      const cup_position = CupPosition.SEMI_FINAL;

      const result = calculateLoses(cup_position, qualifying_wins);

      expect(result).toBe(3);
    });
  });

  describe("calculateWinsAndLoses", () => {
    it("должен возвращать объект с правильными значениями wins и loses", () => {
      const qualifying_wins = 3;
      const cup_position = CupPosition.RUNNER_UP;

      const result = calculateWinsAndLoses(cup_position, qualifying_wins);

      expect(result).toEqual({
        wins: 5, // 3 + 2 за финал
        loses: 3, // max(0, 5-3) + 1 за поражение в финале = 3
      });
    });

    it("должен правильно рассчитывать для победителя кубка", () => {
      const qualifying_wins = 4;
      const cup_position = CupPosition.WINNER;

      const result = calculateWinsAndLoses(cup_position, qualifying_wins);

      expect(result).toEqual({
        wins: 7, // 4 + 3 за победу в кубке
        loses: 1, // max(0, 5-4) + 0 = 1
      });
    });
  });

  describe("Реальные сценарии турнира", () => {
    it("должен правильно рассчитывать для идеального победителя (5-0 в квалификации + победа в кубке)", () => {
      const qualifying_wins = 5;
      const cup_position = CupPosition.WINNER;

      const result = calculateWinsAndLoses(cup_position, qualifying_wins);

      expect(result).toEqual({
        wins: 8, // 5 + 3 = 8 побед
        loses: 0, // 0 поражений (идеальный результат)
      });
    });

    it("должен правильно рассчитывать для финалиста с хорошей квалификацией", () => {
      const qualifying_wins = 4;
      const cup_position = CupPosition.RUNNER_UP;

      const result = calculateWinsAndLoses(cup_position, qualifying_wins);

      expect(result).toEqual({
        wins: 6, // 4 + 2 = 6 побед
        loses: 2, // 1 в квалификации + 1 в финале = 2 поражения
      });
    });

    it("должен правильно рассчитывать для полуфиналиста", () => {
      const qualifying_wins = 3;
      const cup_position = CupPosition.SEMI_FINAL;

      const result = calculateWinsAndLoses(cup_position, qualifying_wins);

      expect(result).toEqual({
        wins: 4, // 3 + 1 = 4 победы
        loses: 3, // 2 в квалификации + 1 в полуфинале = 3 поражения
      });
    });
  });
});
