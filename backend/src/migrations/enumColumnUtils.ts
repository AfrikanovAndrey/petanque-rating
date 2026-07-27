/**
 * Хелперы для безопасного изменения MySQL ENUM:
 * не затирать значения, добавленные более поздними миграциями.
 */

/** Парсит COLUMN_TYPE вида enum('A','B') → ['A','B'] */
export function parseEnumValues(columnType: string | undefined): string[] {
  if (!columnType) {
    return [];
  }
  const match = columnType.match(/^enum\((.*)\)$/i);
  if (!match) {
    return [];
  }
  const inner = match[1];
  const values: string[] = [];
  const re = /'((?:\\'|[^'])*)'/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(inner)) !== null) {
    values.push(m[1].replace(/\\'/g, "'"));
  }
  return values;
}

/** Собирает ENUM(...) для MODIFY COLUMN */
export function formatEnumSql(values: string[]): string {
  return `ENUM(\n      ${values.map((v) => `'${v.replace(/'/g, "\\'")}'`).join(",\n      ")}\n    )`;
}

/** Добавляет value в конец списка, если его ещё нет (порядок существующих сохраняется). */
export function ensureEnumValue(values: string[], value: string): string[] {
  if (values.includes(value)) {
    return values;
  }
  return [...values, value];
}

/** Удаляет value из списка ENUM. */
export function removeEnumValue(values: string[], value: string): string[] {
  return values.filter((v) => v !== value);
}
