/**
 * Парсинг CSV регистрации команд (формат как при скачивании):
 * №,состав команды,рейтинг
 * 1,"Игрок А, Игрок Б",1234
 */

export type RegistrationCsvTeamRow = {
  /** 1-based номер строки в файле (для сообщений об ошибках) */
  lineNumber: number;
  /** Номер из колонки «№», если удалось разобрать */
  rowNumber: number | null;
  /** Имена игроков из колонки «состав команды» */
  playerNames: string[];
};

/** Разбор одной CSV-строки с учётом кавычек (RFC 4180). */
export function parseCsvLine(line: string): string[] {
  const fields: string[] = [];
  let current = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"') {
        if (line[i + 1] === '"') {
          current += '"';
          i += 1;
        } else {
          inQuotes = false;
        }
      } else {
        current += ch;
      }
      continue;
    }
    if (ch === '"') {
      inQuotes = true;
      continue;
    }
    if (ch === ",") {
      fields.push(current);
      current = "";
      continue;
    }
    current += ch;
  }
  fields.push(current);
  return fields.map((f) => f.trim());
}

function splitRosterNames(rosterField: string): string[] {
  return rosterField
    .split(",")
    .map((name) => name.trim())
    .filter((name) => name.length > 0);
}

/**
 * Разбирает CSV регистрации. Колонка «рейтинг» игнорируется.
 * Пустые строки пропускаются. Заголовок опционален.
 */
export function parseRegistrationCsv(content: string): {
  teams: RegistrationCsvTeamRow[];
  error?: string;
} {
  const text = content.replace(/^\uFEFF/, "").replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  const lines = text.split("\n");
  const teams: RegistrationCsvTeamRow[] = [];

  let startIndex = 0;
  if (lines.length > 0) {
    const firstFields = parseCsvLine(lines[0]);
    const headerJoined = firstFields.join(",").toLowerCase();
    if (
      headerJoined.includes("состав") ||
      firstFields[0]?.toLowerCase() === "№" ||
      firstFields[0]?.toLowerCase() === "n" ||
      firstFields[0]?.toLowerCase() === "no"
    ) {
      startIndex = 1;
    }
  }

  for (let i = startIndex; i < lines.length; i++) {
    const raw = lines[i].trim();
    if (!raw) {
      continue;
    }
    const lineNumber = i + 1;
    const fields = parseCsvLine(raw);
    if (fields.length < 2) {
      return {
        teams: [],
        error: `Строка ${lineNumber}: ожидаются колонки «№», «состав команды» (и опционально «рейтинг»)`,
      };
    }

    // Формат: №, состав, [рейтинг]
    // Если состав не в кавычках и есть лишние запятые — поля съедут.
    // При скачивании состав с запятыми всегда в кавычках, поэтому fields[1] — полный состав.
    const rowNumberRaw = fields[0];
    const rosterField = fields[1];
    const playerNames = splitRosterNames(rosterField);
    if (playerNames.length === 0) {
      return {
        teams: [],
        error: `Строка ${lineNumber}: пустой состав команды`,
      };
    }

    const parsedNum = parseInt(rowNumberRaw, 10);
    teams.push({
      lineNumber,
      rowNumber: Number.isFinite(parsedNum) ? parsedNum : null,
      playerNames,
    });
  }

  if (teams.length === 0) {
    return { teams: [], error: "В файле нет строк с командами" };
  }

  return { teams };
}
