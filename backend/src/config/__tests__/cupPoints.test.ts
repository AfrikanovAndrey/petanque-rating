import {
  getCupPoints,
  getPointsExample,
  getAllCupPointsConfig,
  getWinsPoints,
} from "../cupPoints";
import { CupPosition } from "../../types";

describe("getCupPoints", () => {
  describe("Турнир 2-й категории, кубок А, 29 команд", () => {
    test("должен вернуть 9 очков для победителя кубка А", () => {
      // Arrange
      const category = "2" as const;
      const cup = "A" as const;
      const position = CupPosition.WINNER;
      const totalTeams = 29;
      const expectedPoints = 9;

      // Act
      const actualPoints = getCupPoints(category, cup, position, totalTeams);

      // Assert
      expect(actualPoints).toBe(expectedPoints);
    });

    test("должен вернуть 8 очков для финалиста кубка А", () => {
      // Arrange
      const category = "2" as const;
      const cup = "A" as const;
      const position = CupPosition.RUNNER_UP;
      const totalTeams = 29;
      const expectedPoints = 8;

      // Act
      const actualPoints = getCupPoints(category, cup, position, totalTeams);

      // Assert
      expect(actualPoints).toBe(expectedPoints);
    });

    test("должен вернуть 7 очков для полуфиналиста кубка А", () => {
      // Arrange
      const category = "2" as const;
      const cup = "A" as const;
      const position = CupPosition.SEMI_FINAL;
      const totalTeams = 29;
      const expectedPoints = 7;

      // Act
      const actualPoints = getCupPoints(category, cup, position, totalTeams);

      // Assert
      expect(actualPoints).toBe(expectedPoints);
    });

    test("должен вернуть 6 очков для четвертьфиналиста кубка А", () => {
      // Arrange
      const category = "2" as const;
      const cup = "A" as const;
      const position = CupPosition.QUARTER_FINAL;
      const totalTeams = 29;
      const expectedPoints = 6;

      // Act
      const actualPoints = getCupPoints(category, cup, position, totalTeams);

      // Assert
      expect(actualPoints).toBe(expectedPoints);
    });
  });

  describe("Граничные случаи", () => {
    test("должен правильно определить диапазон 25-30 команд для 25 команд", () => {
      const points = getCupPoints("2", "A", CupPosition.WINNER, 25);
      expect(points).toBe(9);
    });

    test("должен правильно определить диапазон 25-30 команд для 30 команд", () => {
      const points = getCupPoints("2", "A", CupPosition.WINNER, 30);
      expect(points).toBe(9);
    });

    test("должен правильно определить диапазон 31-36 команд для 31 команды", () => {
      const points = getCupPoints("2", "A", CupPosition.WINNER, 31);
      expect(points).toBe(10);
    });

    test("должен правильно определить диапазон 36+ команд для 50 команд", () => {
      const points = getCupPoints("2", "A", CupPosition.WINNER, 50);
      expect(points).toBe(12);
    });
  });

  describe("Сравнение категорий турниров", () => {
    test("турнир 1-й категории должен давать больше очков чем 2-й категории", () => {
      const teams = 29;
      const position = CupPosition.WINNER;
      const cup = "A" as const;

      const category1Points = getCupPoints("1", cup, position, teams);
      const category2Points = getCupPoints("2", cup, position, teams);

      expect(category1Points).toBeGreaterThan(category2Points);
      expect(category1Points).toBe(13); // Для категории 1
      expect(category2Points).toBe(9); // Для категории 2
    });
  });

  describe("Сравнение кубков", () => {
    test("кубок А должен давать больше очков чем кубок Б", () => {
      const teams = 29;
      const position = CupPosition.WINNER;
      const category = "1" as const;

      const cupAPoints = getCupPoints(category, "A", position, teams);
      const cupBPoints = getCupPoints(category, "B", position, teams);

      expect(cupAPoints).toBeGreaterThan(cupBPoints);
      expect(cupAPoints).toBe(13); // Кубок А
      expect(cupBPoints).toBe(7); // Кубок Б
    });
  });

  describe("Обработка ошибок", () => {
    test("должен вернуть 0 для несуществующей позиции", () => {
      const points = getCupPoints("1", "A", "invalid" as CupPosition, 20);
      expect(points).toBe(0);
    });

    test("должен вернуть 0 для кубка Б с малым количеством команд (категория 1)", () => {
      // Кубок Б в категории 1 начинается с 13 команд
      const points = getCupPoints("1", "B", CupPosition.WINNER, 10);
      expect(points).toBe(0);
    });

    test("должен вернуть 0 для кубка Б с малым количеством команд (категория 2)", () => {
      // Кубок Б в категории 2 начинается с 13 команд, поэтому 10 команд не должны давать очки
      const points = getCupPoints("2", "B", CupPosition.WINNER, 10);
      expect(points).toBe(0);
    });
  });
});

describe("getWinsPoints", () => {
  describe("Турниры 1 категории", () => {
    test("должен вернуть 3 очка за 3 победы", () => {
      const points = getWinsPoints("1", 3);
      expect(points).toBe(3);
    });

    test("должен вернуть 3 очка за 5 побед", () => {
      const points = getWinsPoints("1", 5);
      expect(points).toBe(3);
    });

    test("должен вернуть 2 очка за 2 победы", () => {
      const points = getWinsPoints("1", 2);
      expect(points).toBe(2);
    });

    test("должен вернуть 2 очка за 1 победу", () => {
      const points = getWinsPoints("1", 1);
      expect(points).toBe(2);
    });

    test("должен вернуть 0 очков за 0 побед", () => {
      const points = getWinsPoints("1", 0);
      expect(points).toBe(0);
    });
  });

  describe("Турниры 2 категории", () => {
    test("должен вернуть 2 очка за 3 победы", () => {
      const points = getWinsPoints("2", 3);
      expect(points).toBe(2);
    });

    test("должен вернуть 2 очка за 4 победы", () => {
      const points = getWinsPoints("2", 4);
      expect(points).toBe(2);
    });

    test("должен вернуть 1 очко за 2 победы", () => {
      const points = getWinsPoints("2", 2);
      expect(points).toBe(1);
    });

    test("должен вернуть 1 очко за 1 победу", () => {
      const points = getWinsPoints("2", 1);
      expect(points).toBe(1);
    });

    test("должен вернуть 0 очков за 0 побед", () => {
      const points = getWinsPoints("2", 0);
      expect(points).toBe(0);
    });
  });

  describe("Граничные случаи", () => {
    test("должен корректно обрабатывать отрицательные значения", () => {
      const points = getWinsPoints("1", -1);
      expect(points).toBe(0);
    });
  });
});

describe("getPointsExample", () => {
  test("должен вернуть корректную структуру примеров", () => {
    const examples = getPointsExample();

    expect(examples).toHaveProperty("description");
    expect(examples).toHaveProperty("cupExamples");
    expect(examples).toHaveProperty("winsExamples");
    expect(examples).toHaveProperty("ranges");
    expect(examples).toHaveProperty("categories");

    expect(Array.isArray(examples.cupExamples)).toBe(true);
    expect(examples.cupExamples.length).toBeGreaterThan(0);

    expect(Array.isArray(examples.winsExamples)).toBe(true);
    expect(examples.winsExamples.length).toBeGreaterThan(0);

    // Проверяем первый пример кубка
    const firstCupExample = examples.cupExamples[0];
    expect(firstCupExample).toHaveProperty("scenario");
    expect(firstCupExample).toHaveProperty("teams");
    expect(firstCupExample).toHaveProperty("category");
    expect(firstCupExample).toHaveProperty("cup");
    expect(firstCupExample).toHaveProperty("position");
    expect(firstCupExample).toHaveProperty("points");
    expect(typeof firstCupExample.points).toBe("number");

    // Проверяем первый пример побед
    const firstWinsExample = examples.winsExamples[0];
    expect(firstWinsExample).toHaveProperty("scenario");
    expect(firstWinsExample).toHaveProperty("category");
    expect(firstWinsExample).toHaveProperty("wins");
    expect(firstWinsExample).toHaveProperty("points");
    expect(typeof firstWinsExample.wins).toBe("number");
    expect(typeof firstWinsExample.points).toBe("number");
  });
});

describe("getCupPoints для кубка C", () => {
  describe("Кубок C с дополнительными очками", () => {
    test("должен вернуть очки отборочного тура + 2 для победителя кубка С", () => {
      // Arrange
      const category = "1" as const;
      const cup = "C" as const;
      const position = CupPosition.WINNER;
      const totalTeams = 20;
      const qualifyingRoundPoints = 5; // Очки, заработанные в отборочном туре
      const expectedPoints = 7; // 5 + 2

      // Act
      const actualPoints = getCupPoints(
        category,
        cup,
        position,
        totalTeams,
        qualifyingRoundPoints
      );

      // Assert
      expect(actualPoints).toBe(expectedPoints);
    });

    test("должен вернуть очки отборочного тура + 2 для финалиста кубка С", () => {
      // Arrange
      const category = "2" as const;
      const cup = "C" as const;
      const position = CupPosition.RUNNER_UP;
      const totalTeams = 30;
      const qualifyingRoundPoints = 3;
      const expectedPoints = 5; // 3 + 2

      // Act
      const actualPoints = getCupPoints(
        category,
        cup,
        position,
        totalTeams,
        qualifyingRoundPoints
      );

      // Assert
      expect(actualPoints).toBe(expectedPoints);
    });

    test("должен вернуть очки отборочного тура + 1 для полуфиналиста кубка С", () => {
      // Arrange
      const category = "1" as const;
      const cup = "C" as const;
      const position = CupPosition.SEMI_FINAL;
      const totalTeams = 25;
      const qualifyingRoundPoints = 4;
      const expectedPoints = 5; // 4 + 1

      // Act
      const actualPoints = getCupPoints(
        category,
        cup,
        position,
        totalTeams,
        qualifyingRoundPoints
      );

      // Assert
      expect(actualPoints).toBe(expectedPoints);
    });

    test("должен вернуть только очки отборочного тура для четвертьфиналиста кубка С", () => {
      // Arrange
      const category = "2" as const;
      const cup = "C" as const;
      const position = CupPosition.QUARTER_FINAL;
      const totalTeams = 40;
      const qualifyingRoundPoints = 2;
      const expectedPoints = 2; // 2 + 0

      // Act
      const actualPoints = getCupPoints(
        category,
        cup,
        position,
        totalTeams,
        qualifyingRoundPoints
      );

      // Assert
      expect(actualPoints).toBe(expectedPoints);
    });

    test("должен работать с нулевыми очками отборочного тура", () => {
      // Arrange
      const category = "1" as const;
      const cup = "C" as const;
      const position = CupPosition.WINNER;
      const totalTeams = 16;
      const qualifyingRoundPoints = 0;
      const expectedPoints = 2; // 0 + 2

      // Act
      const actualPoints = getCupPoints(
        category,
        cup,
        position,
        totalTeams,
        qualifyingRoundPoints
      );

      // Assert
      expect(actualPoints).toBe(expectedPoints);
    });
  });
});

describe("getAllCupPointsConfig", () => {
  test("должен вернуть все конфигурации очков", () => {
    const config = getAllCupPointsConfig();

    // Проверяем что конфигурация содержит ожидаемые ключи
    expect(config).toHaveProperty("1-A-8-12");
    expect(config).toHaveProperty("2-A-25-30");
    expect(config).toHaveProperty("1-B-19-24");

    // Проверяем структуру одной конфигурации
    const category2Cup25to30 = config["2-A-25-30"];
    expect(category2Cup25to30).toHaveProperty("1"); // Победитель
    expect(category2Cup25to30).toHaveProperty("2"); // Финалист
    expect(category2Cup25to30["1"]).toBe(9); // 9 очков за победу
  });

  test("конфигурация должна покрывать все необходимые случаи", () => {
    const config = getAllCupPointsConfig();
    const keys = Object.keys(config);

    // Проверяем наличие конфигураций для обеих категорий
    const category1Keys = keys.filter((key) => key.startsWith("1-"));
    const category2Keys = keys.filter((key) => key.startsWith("2-"));

    expect(category1Keys.length).toBeGreaterThan(0);
    expect(category2Keys.length).toBeGreaterThan(0);

    // Проверяем наличие конфигураций для обоих кубков
    const cupAKeys = keys.filter((key) => key.includes("-A-"));
    const cupBKeys = keys.filter((key) => key.includes("-B-"));

    expect(cupAKeys.length).toBeGreaterThan(0);
    expect(cupBKeys.length).toBeGreaterThan(0);
  });
});
