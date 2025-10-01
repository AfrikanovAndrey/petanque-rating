/**
 * Утилита для определения пола по русскому имени
 */

export type Gender = "male" | "female" | null;

interface GenderResult {
  gender: Gender;
  confidence: "high" | "medium" | "low";
  reason?: string;
}

// Типичные женские окончания
const FEMALE_ENDINGS = [
  "а",
  "я",
  "ия",
  "ья",
  "на",
  "ла",
  "ра",
  "са",
  "та",
  "ка",
  "га",
  "ва",
  "да",
  "за",
  "ма",
  "па",
  "ха",
  "ча",
  "ша",
  "ща",
  "ина",
  "ана",
  "ена",
  "она",
  "уна",
  "ына",
];

// Типичные мужские окончания
const MALE_ENDINGS = [
  "ий",
  "ей",
  "ай",
  "ой",
  "ый",
  "ин",
  "он",
  "ен",
  "ан",
  "ун",
  "ын",
  "дир",
  "мир",
  "тор",
  "сор",
  "нор",
  "лор",
  "др", // Александр
  "нс", // Денис
  "ил", // Михаил
  "ел", // Павел
  "им", // Максим, Вадим
  "ём", // Артём
  "ак", // Исаак
  "ек", // Витек
  "ич", // Драганич
  "юш", // Сеявуш
  "ат", // Булат
  "ав", // Владислав, Ярослав
];

// Однозначно женские имена (исключения)
const DEFINITELY_FEMALE = [
  "любовь",
  "руфь",
  "эстер",
  "рахиль",
  "юдифь",
  "элишева",
];

// Однозначно мужские имена (исключения)
const DEFINITELY_MALE = [
  "игорь",
  "олег",
  "глеб",
  "лев",
  "давид",
  "даниил",
  "daniel",
  "michael",
  "david",
  // Популярные русские мужские имена
  "александр",
  "андрей",
  "алексей",
  "анатолий",
  "антон",
  "артём",
  "артем",
  "борис",
  "вадим",
  "валерий",
  "василий",
  "виктор",
  "владимир",
  "владислав",
  "вячеслав",
  "геннадий",
  "георгий",
  "денис",
  "дмитрий",
  "евгений",
  "егор",
  "иван",
  "илья",
  "кирилл",
  "константин",
  "максим",
  "михаил",
  "николай",
  "павел",
  "пётр",
  "петр",
  "роман",
  "сергей",
  "станислав",
  "юрий",
  "ярослав",
];

// Неоднозначные имена (требуют уточнения)
const AMBIGUOUS_NAMES = [
  "саша",
  "женя",
  "валя",
  "шура",
  "слава",
  "паша",
  "миша",
  "гриша",
  "алеша",
  "никита",
  "кира",
  "авдотья",
  "ефросинья",
];

/**
 * Определяет пол по полному имени (может содержать имя и фамилию)
 */
export function detectGender(fullName: string): GenderResult {
  const name = fullName.trim().toLowerCase();

  // Разбиваем на части (имя фамилия отчество)
  const nameParts = name.split(/\s+/);
  const firstName = nameParts[0];
  const secondName = nameParts.length > 1 ? nameParts[1] : "";

  console.log(
    `🔍 Определяю пол для: "${fullName}" -> части: [${nameParts.join(", ")}]`
  );

  // Проверяем все части имени на однозначные мужские имена
  for (const part of nameParts) {
    if (DEFINITELY_MALE.includes(part)) {
      return {
        gender: "male",
        confidence: "high",
        reason: `однозначно мужское имя: "${part}"`,
      };
    }

    if (DEFINITELY_FEMALE.includes(part)) {
      return {
        gender: "female",
        confidence: "high",
        reason: `однозначно женское имя: "${part}"`,
      };
    }

    // Проверяем неоднозначные имена
    if (AMBIGUOUS_NAMES.includes(part)) {
      return {
        gender: null,
        confidence: "low",
        reason: `неоднозначное имя "${part}", требует уточнения`,
      };
    }
  }

  // Определяем по окончаниям - проверяем все части имени
  for (const part of nameParts) {
    // Женские окончания
    for (const ending of FEMALE_ENDINGS) {
      if (part.endsWith(ending)) {
        const confidence = ending.length > 2 ? "high" : "medium";
        return {
          gender: "female",
          confidence,
          reason: `женское окончание "-${ending}" в "${part}"`,
        };
      }
    }

    // Мужские окончания
    for (const ending of MALE_ENDINGS) {
      if (part.endsWith(ending)) {
        const confidence = ending.length > 2 ? "high" : "medium";
        return {
          gender: "male",
          confidence,
          reason: `мужское окончание "-${ending}" в "${part}"`,
        };
      }
    }
  }

  // Проверяем фамилии - ищем признаки в любой части имени
  for (const part of nameParts) {
    if (
      part.endsWith("ова") ||
      part.endsWith("ева") ||
      part.endsWith("ина") ||
      part.endsWith("ская")
    ) {
      return {
        gender: "female",
        confidence: "medium",
        reason: `женское окончание фамилии в "${part}"`,
      };
    }

    if (
      part.endsWith("ов") ||
      part.endsWith("ев") ||
      part.endsWith("ин") ||
      part.endsWith("ский")
    ) {
      return {
        gender: "male",
        confidence: "medium",
        reason: `мужское окончание фамилии в "${part}"`,
      };
    }
  }

  // Правило для русских имен: большинство мужских имен заканчиваются на согласные
  const consonants = "бвгджзйклмнпрстфхцчшщ";
  const vowels = "аеёиоуыэюя";

  // Проверяем каждую часть имени на согласные окончания
  for (const part of nameParts) {
    const lastChar = part.charAt(part.length - 1);

    if (consonants.includes(lastChar)) {
      // Если часть заканчивается на согласную, скорее всего мужское
      // Исключаем мягкий знак, так как он может быть и в мужских, и в женских именах
      if (!part.endsWith("ь") && part.length > 2) {
        // минимум 3 символа для надежности
        return {
          gender: "male",
          confidence: "medium",
          reason: `"${part}" заканчивается на согласную (типично для мужских имен)`,
        };
      }
    }

    if (
      vowels.includes(lastChar) &&
      !part.endsWith("а") &&
      !part.endsWith("я")
    ) {
      // Если часть заканчивается на гласную (кроме а/я), но мы уже проверили женские окончания
      // Может быть мужским (как Никита)
      if (part.endsWith("о") || part.endsWith("у")) {
        return {
          gender: "male",
          confidence: "low",
          reason: `"${part}" заканчивается на о/у (может быть мужским)`,
        };
      }
    }
  }

  // Если ничего не подошло
  return {
    gender: null,
    confidence: "low",
    reason: "не удалось определить по правилам русского языка",
  };
}

/**
 * Пакетное определение пола для списка имен
 */
export function detectGenderBatch(names: string[]): Map<string, GenderResult> {
  const results = new Map<string, GenderResult>();

  for (const name of names) {
    results.set(name, detectGender(name));
  }

  return results;
}
