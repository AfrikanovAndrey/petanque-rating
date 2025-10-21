import { parseCupValue, parseCupPosition } from "../../utils/cupValidators";
import { CupPosition } from "../../types";

describe("parseCupValue", () => {
  describe("Латинские буквы", () => {
    test("должна вернуть 'A' для латинской 'A' в верхнем регистре", () => {
      expect(parseCupValue("A")).toBe("A");
    });

    test("должна вернуть 'A' для латинской 'a' в нижнем регистре", () => {
      expect(parseCupValue("a")).toBe("A");
    });

    test("должна вернуть 'B' для латинской 'B' в верхнем регистре", () => {
      expect(parseCupValue("B")).toBe("B");
    });

    test("должна вернуть 'B' для латинской 'b' в нижнем регистре", () => {
      expect(parseCupValue("b")).toBe("B");
    });

    test("должна вернуть 'C' для латинской 'C' в верхнем регистре", () => {
      expect(parseCupValue("C")).toBe("C");
    });

    test("должна вернуть 'C' для латинской 'c' в нижнем регистре", () => {
      expect(parseCupValue("c")).toBe("C");
    });
  });

  describe("Кириллические буквы", () => {
    test("должна вернуть 'A' для кириллической 'А' в верхнем регистре", () => {
      expect(parseCupValue("А")).toBe("A");
    });

    test("должна вернуть 'A' для кириллической 'а' в нижнем регистре", () => {
      expect(parseCupValue("а")).toBe("A");
    });

    test("должна вернуть 'B' для кириллической 'Б' в верхнем регистре", () => {
      expect(parseCupValue("Б")).toBe("B");
    });

    test("должна вернуть 'B' для кириллической 'б' в нижнем регистре", () => {
      expect(parseCupValue("б")).toBe("B");
    });

    test("должна вернуть 'C' для кириллической 'С' в верхнем регистре", () => {
      expect(parseCupValue("С")).toBe("C");
    });

    test("должна вернуть 'C' для кириллической 'с' в нижнем регистре", () => {
      expect(parseCupValue("с")).toBe("C");
    });
  });

  describe("Обработка пробелов", () => {
    test("должна вернуть 'A' для '  A  ' с пробелами", () => {
      expect(parseCupValue("  A  ")).toBe("A");
    });

    test("должна вернуть 'B' для '  б  ' с пробелами (кириллица)", () => {
      expect(parseCupValue("  б  ")).toBe("B");
    });
  });

  describe("Некорректные значения", () => {
    test("должна вернуть null для латинской 'D'", () => {
      expect(parseCupValue("D")).toBeNull();
    });

    test("должна вернуть null для кириллической 'Г'", () => {
      expect(parseCupValue("Г")).toBeNull();
    });

    test("должна вернуть null для пустой строки", () => {
      expect(parseCupValue("")).toBeNull();
    });

    test("должна вернуть null для строки с пробелами", () => {
      expect(parseCupValue("   ")).toBeNull();
    });

    test("должна вернуть null для числа '1'", () => {
      expect(parseCupValue("1")).toBeNull();
    });

    test("должна вернуть null для 'AB'", () => {
      expect(parseCupValue("AB")).toBeNull();
    });

    test("должна вернуть null для 'ABC'", () => {
      expect(parseCupValue("ABC")).toBeNull();
    });

    test("должна вернуть null для случайного текста", () => {
      expect(parseCupValue("Hello")).toBeNull();
    });
  });
});

describe("parseCupPosition", () => {
  describe("Числовые позиции", () => {
    test("должна вернуть CupPosition.WINNER для '1'", () => {
      expect(parseCupPosition("1")).toBe(CupPosition.WINNER);
    });

    test("должна вернуть CupPosition.RUNNER_UP для '2'", () => {
      expect(parseCupPosition("2")).toBe(CupPosition.RUNNER_UP);
    });

    test("должна вернуть CupPosition.THIRD_PLACE для '3'", () => {
      expect(parseCupPosition("3")).toBe(CupPosition.THIRD_PLACE);
    });
  });

  describe("Раунды", () => {
    test("должна вернуть CupPosition.ROUND_OF_4 для '1/2'", () => {
      expect(parseCupPosition("1/2")).toBe(CupPosition.ROUND_OF_4);
    });

    test("должна вернуть CupPosition.ROUND_OF_8 для '1/4'", () => {
      expect(parseCupPosition("1/4")).toBe(CupPosition.ROUND_OF_8);
    });

    test("должна вернуть CupPosition.ROUND_OF_16 для '1/8'", () => {
      expect(parseCupPosition("1/8")).toBe(CupPosition.ROUND_OF_16);
    });
  });

  describe("Обработка пробелов", () => {
    test("должна вернуть CupPosition.WINNER для '  1  ' с пробелами", () => {
      expect(parseCupPosition("  1  ")).toBe(CupPosition.WINNER);
    });

    test("должна вернуть CupPosition.ROUND_OF_4 для '  1/2  ' с пробелами", () => {
      expect(parseCupPosition("  1/2  ")).toBe(CupPosition.ROUND_OF_4);
    });

    test("должна вернуть CupPosition.ROUND_OF_8 для ' 1/4 ' с пробелами", () => {
      expect(parseCupPosition(" 1/4 ")).toBe(CupPosition.ROUND_OF_8);
    });
  });

  describe("Некорректные значения", () => {
    test("должна вернуть null для '0'", () => {
      expect(parseCupPosition("0")).toBeNull();
    });

    test("должна вернуть null для '4'", () => {
      expect(parseCupPosition("4")).toBeNull();
    });

    test("должна вернуть null для '10'", () => {
      expect(parseCupPosition("10")).toBeNull();
    });

    test("должна вернуть null для '1/3'", () => {
      expect(parseCupPosition("1/3")).toBeNull();
    });

    test("должна вернуть null для '1/16'", () => {
      expect(parseCupPosition("1/16")).toBeNull();
    });

    test("должна вернуть null для пустой строки", () => {
      expect(parseCupPosition("")).toBeNull();
    });

    test("должна вернуть null для строки с пробелами", () => {
      expect(parseCupPosition("   ")).toBeNull();
    });

    test("должна вернуть null для случайного текста", () => {
      expect(parseCupPosition("Winner")).toBeNull();
    });

    test("должна вернуть null для букв", () => {
      expect(parseCupPosition("A")).toBeNull();
    });

    test("должна вернуть null для '1-2' (с дефисом вместо слэша)", () => {
      expect(parseCupPosition("1-2")).toBeNull();
    });

    test("должна вернуть null для '1 / 2' (с пробелами вокруг слэша)", () => {
      expect(parseCupPosition("1 / 2")).toBeNull();
    });
  });
});
