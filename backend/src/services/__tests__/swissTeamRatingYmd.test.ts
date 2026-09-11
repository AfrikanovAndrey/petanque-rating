import { ymdFromSqlDate } from "../../utils/ymdDate";

describe("ymdFromSqlDate", () => {
  it("принимает YYYY-MM-DD", () => {
    expect(ymdFromSqlDate("2026-03-15")).toBe("2026-03-15");
  });

  it("отрезает время от ISO-строки", () => {
    expect(ymdFromSqlDate("2026-03-15T00:00:00.000Z")).toBe("2026-03-15");
  });

  it("отклоняет пустые и некорректные значения", () => {
    expect(ymdFromSqlDate(null)).toBeNull();
    expect(ymdFromSqlDate("")).toBeNull();
    expect(ymdFromSqlDate("15.03.2026")).toBeNull();
    expect(ymdFromSqlDate("2026-13-01")).toBeNull();
  });
});
