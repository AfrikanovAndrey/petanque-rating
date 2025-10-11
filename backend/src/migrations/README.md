# Миграции базы данных (TypeScript)

## 🚀 Автоматическое применение миграций

**С версии 2.0.0 миграции пишутся на TypeScript и применяются автоматически!**

### Концепция самоконтролирующих миграций

Миграции **не используют отдельную таблицу** для отслеживания. Вместо этого:

✅ Каждая миграция **сама проверяет**, нужно ли ее применять  
✅ Используются конструкции `IF NOT EXISTS`, `IF EXISTS`  
✅ Идемпотентность - можно запускать повторно без ошибок  
✅ Простота - нет лишних таблиц в БД

Просто перезапустите backend:

```bash
docker-compose restart backend
# или
cd backend && npm run dev
```

При запуске сервер автоматически:

1. Найдет все TypeScript файлы миграций в папке `migrations/`
2. Применит все миграции по порядку
3. Каждая миграция сама решит, нужно ли ей что-то делать

### Вывод в консоли

```
🔍 Проверка инициализации БД...
✅ Структура БД инициализирована
📋 Найдено миграций: 1
📝 Применение миграции: 001_add_users_table...
✅ Таблица users уже существует
✅ Все миграции применены
✅ БД готова к работе
```

При повторном запуске:

```
📋 Найдено миграций: 1
📝 Применение миграции: 001_add_users_table...
⏭️ Таблица users уже существует
✅ Все миграции применены
```

## 📝 Создание новых миграций

### Правила именования

Миграции должны следовать формату:

```
NNN_description.ts
```

Где:

- `NNN` - порядковый номер (001, 002, 003...)
- `description` - краткое описание на английском

Примеры:

- `001_add_users_table.ts`
- `002_add_sessions_table.ts`
- `003_update_players_gender.ts`

### Структура миграции

Каждая миграция должна экспортировать две функции:

```typescript
import { Pool } from "mysql2/promise";

export async function up(pool: Pool): Promise<void> {
  // Код для применения миграции
}

export async function down(pool: Pool): Promise<void> {
  // Код для отката миграции
}
```

### Создание миграции

**Шаг 1:** Создайте новый TypeScript файл

```bash
touch backend/src/migrations/002_add_sessions_table.ts
```

**Шаг 2:** Напишите самоконтролирующую миграцию

```typescript
import { Pool, RowDataPacket } from "mysql2/promise";

/**
 * Миграция: Добавление таблицы сессий
 * Дата: 2025-10-09
 */

export async function up(pool: Pool): Promise<void> {
  // Проверяем, существует ли таблица
  const [tables] = await pool.execute<RowDataPacket[]>(`
    SELECT TABLE_NAME 
    FROM information_schema.TABLES 
    WHERE TABLE_SCHEMA = DATABASE() 
    AND TABLE_NAME = 'sessions'
  `);

  if (tables.length > 0) {
    console.log("⏭️  Таблица sessions уже существует");
    return;
  }

  // Создание таблицы
  await pool.execute(`
    CREATE TABLE sessions (
      id INT AUTO_INCREMENT PRIMARY KEY,
      user_id INT NOT NULL,
      token VARCHAR(255) NOT NULL UNIQUE,
      expires_at TIMESTAMP NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      INDEX idx_token (token),
      INDEX idx_expires (expires_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  console.log("✅ Таблица sessions создана");
}

export async function down(pool: Pool): Promise<void> {
  // Откат: удаление таблицы
  await pool.execute(`DROP TABLE IF EXISTS sessions`);
  console.log("✅ Таблица sessions удалена");
}
```

**Важно:** Миграция сама проверяет, нужно ли ее применять!

**Шаг 3:** Перезапустите сервер

```bash
docker-compose restart backend
```

Миграция применится автоматически!

## 💡 Преимущества TypeScript миграций

✅ **Самоконтроль** - миграции сами решают, нужно ли их применять  
✅ **Идемпотентность** - можно запускать повторно без ошибок  
✅ **Типизация** - TypeScript проверяет синтаксис на этапе компиляции  
✅ **Программная логика** - можно использовать условия, циклы, функции  
✅ **Откат** - поддержка функции `down()` для отката миграций  
✅ **Тестирование** - можно покрыть unit-тестами  
✅ **IDE поддержка** - автодополнение и подсказки  
✅ **Переиспользование** - можно импортировать утилиты и типы  
✅ **Нет лишних таблиц** - не создается таблица `migrations`

## 📚 Примеры миграций

### Создание таблицы

```typescript
import { Pool } from "mysql2/promise";

export async function up(pool: Pool): Promise<void> {
  await pool.execute(`
    CREATE TABLE IF NOT EXISTS logs (
      id INT AUTO_INCREMENT PRIMARY KEY,
      user_id INT,
      action VARCHAR(255) NOT NULL,
      details TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL,
      INDEX idx_user_id (user_id),
      INDEX idx_created_at (created_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);
}

export async function down(pool: Pool): Promise<void> {
  await pool.execute(`DROP TABLE IF EXISTS logs`);
}
```

### Добавление колонки

```typescript
import { Pool } from "mysql2/promise";

export async function up(pool: Pool): Promise<void> {
  await pool.execute(`
    ALTER TABLE users 
    ADD COLUMN IF NOT EXISTS email VARCHAR(255) UNIQUE AFTER username
  `);

  await pool.execute(`
    CREATE INDEX idx_email ON users(email)
  `);
}

export async function down(pool: Pool): Promise<void> {
  await pool.execute(`
    ALTER TABLE users DROP INDEX idx_email
  `);

  await pool.execute(`
    ALTER TABLE users DROP COLUMN email
  `);
}
```

### Миграция данных

```typescript
import { Pool } from "mysql2/promise";

export async function up(pool: Pool): Promise<void> {
  // Добавляем новое поле
  await pool.execute(`
    ALTER TABLE tournaments 
    ADD COLUMN status ENUM('pending', 'active', 'completed') 
    DEFAULT 'completed'
  `);

  // Обновляем существующие записи
  await pool.execute(`
    UPDATE tournaments 
    SET status = 'completed'
    WHERE date < CURDATE()
  `);

  await pool.execute(`
    UPDATE tournaments 
    SET status = 'active'
    WHERE date = CURDATE()
  `);
}

export async function down(pool: Pool): Promise<void> {
  await pool.execute(`
    ALTER TABLE tournaments DROP COLUMN status
  `);
}
```

### Миграция с условной логикой

```typescript
import { Pool, RowDataPacket } from "mysql2/promise";

export async function up(pool: Pool): Promise<void> {
  // Проверяем, существует ли колонка
  const [columns] = await pool.execute<RowDataPacket[]>(`
    SELECT COLUMN_NAME 
    FROM information_schema.COLUMNS 
    WHERE TABLE_SCHEMA = DATABASE() 
    AND TABLE_NAME = 'users' 
    AND COLUMN_NAME = 'phone'
  `);

  if (columns.length === 0) {
    await pool.execute(`
      ALTER TABLE users 
      ADD COLUMN phone VARCHAR(20)
    `);
    console.log("✅ Колонка phone добавлена");
  } else {
    console.log("⏭️  Колонка phone уже существует");
  }
}

export async function down(pool: Pool): Promise<void> {
  await pool.execute(`
    ALTER TABLE users DROP COLUMN IF EXISTS phone
  `);
}
```

## 🔄 Откат миграций

Система не поддерживает автоматический откат, но функция `down()` полезна для документации и ручного отката.

Ручной откат:

1. **Создайте backup БД**

   ```bash
   docker exec petanque-mysql mysqldump -uroot -ppassword petanque_rating > backup.sql
   ```

2. **Вызовите функцию down() или восстановите из backup**
   ```bash
   # Восстановите из backup
   docker exec -i petanque-mysql mysql -uroot -ppassword petanque_rating < backup.sql
   ```

**Примечание:** Поскольку нет таблицы `migrations` для отслеживания, вам не нужно удалять записи о примененных миграциях. Просто восстановите БД из backup.

## 🧪 Тестирование миграций

Можно протестировать миграцию перед применением:

```typescript
// test/migrations/002_add_sessions_table.test.ts
import { Pool } from "mysql2/promise";
import { up, down } from "../../src/migrations/002_add_sessions_table";
import { createTestPool } from "../helpers/db";

describe("Миграция 002_add_sessions_table", () => {
  let pool: Pool;

  beforeAll(async () => {
    pool = await createTestPool();
  });

  it("должна создать таблицу sessions", async () => {
    await up(pool);

    const [tables] = await pool.execute(`
      SHOW TABLES LIKE 'sessions'
    `);

    expect((tables as any[]).length).toBe(1);
  });

  it("должна откатить изменения", async () => {
    await down(pool);

    const [tables] = await pool.execute(`
      SHOW TABLES LIKE 'sessions'
    `);

    expect((tables as any[]).length).toBe(0);
  });

  afterAll(async () => {
    await pool.end();
  });
});
```

## 📋 Лучшие практики

### 1. Одна миграция = одна задача

✅ **Хорошо:**

```typescript
// 001_add_users_table.ts
export async function up(pool: Pool) {
  await pool.execute(`CREATE TABLE users (...)`);
}
```

❌ **Плохо:**

```typescript
// 001_multiple_changes.ts
export async function up(pool: Pool) {
  await pool.execute(`CREATE TABLE users (...)`);
  await pool.execute(`CREATE TABLE sessions (...)`);
  await pool.execute(`ALTER TABLE players ...`);
}
```

### 2. Всегда делайте проверки (самоконтроль!)

✅ **Хорошо - проверяем существование таблицы:**

```typescript
export async function up(pool: Pool): Promise<void> {
  // Проверяем существование
  const [tables] = await pool.execute<RowDataPacket[]>(`
    SELECT TABLE_NAME FROM information_schema.TABLES 
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'users'
  `);

  if (tables.length > 0) {
    console.log("⏭️  Таблица users уже существует");
    return;
  }

  // Создаем таблицу
  await pool.execute(`CREATE TABLE users (...)`);
  console.log("✅ Таблица users создана");
}
```

✅ **Хорошо - используем IF NOT EXISTS:**

```typescript
await pool.execute(`CREATE TABLE IF NOT EXISTS users (...)`);
await pool.execute(
  `ALTER TABLE users ADD COLUMN IF NOT EXISTS email VARCHAR(255)`
);
```

❌ **Плохо - нет проверки:**

```typescript
await pool.execute(`CREATE TABLE users (...)`); // упадет при повторном запуске!
```

### 3. Всегда реализуйте down()

✅ **Хорошо:**

```typescript
export async function up(pool: Pool) {
  await pool.execute(`ALTER TABLE users ADD COLUMN email VARCHAR(255)`);
}

export async function down(pool: Pool) {
  await pool.execute(`ALTER TABLE users DROP COLUMN email`);
}
```

### 4. Добавляйте комментарии

✅ **Хорошо:**

```typescript
/**
 * Миграция: Добавление email для пользователей
 * Дата: 2025-10-09
 * Автор: Иван Иванов
 * Задача: TASK-123
 */
export async function up(pool: Pool) {
  // Добавляем колонку email
  await pool.execute(`...`);
}
```

### 5. Тестируйте на локальной БД

Перед коммитом:

1. Миграция применяется без ошибок
2. Миграция идемпотентна (можно запустить повторно)
3. Функция `down()` работает корректно
4. Данные не теряются

## ⚠️ Важные замечания

### Не изменяйте примененные миграции

❌ **Не делайте так:**

- Изменение уже примененной миграции
- Удаление примененной миграции
- Переименование примененной миграции

✅ **Вместо этого:**

- Создайте новую миграцию с исправлениями

### Порядок миграций

Миграции применяются в алфавитном порядке имен файлов. Поэтому важно:

- Использовать трехзначные номера (001, 002, ...)
- Не пропускать номера
- Не использовать одинаковые номера

## 🔍 Проверка состояния БД

### Проверка существования таблицы

```sql
-- Проверить, существует ли таблица
SELECT TABLE_NAME
FROM information_schema.TABLES
WHERE TABLE_SCHEMA = DATABASE()
AND TABLE_NAME = 'users';
```

### В коде миграции

```typescript
import { Pool, RowDataPacket } from "mysql2/promise";

export async function up(pool: Pool): Promise<void> {
  // Проверяем существование таблицы
  const [tables] = await pool.execute<RowDataPacket[]>(`
    SELECT TABLE_NAME 
    FROM information_schema.TABLES 
    WHERE TABLE_SCHEMA = DATABASE() 
    AND TABLE_NAME = 'my_table'
  `);

  if (tables.length > 0) {
    console.log("⏭️  Таблица my_table уже существует");
    return; // Ничего не делаем
  }

  // Создаем таблицу только если ее нет
  await pool.execute(`CREATE TABLE my_table (...)`);
}
```

## 🆘 Troubleshooting

### Ошибка: Миграция не содержит функцию up()

Убедитесь, что экспортируете функцию `up`:

```typescript
export async function up(pool: Pool) { ... }
```

### Ошибка при импорте миграции

1. Проверьте синтаксис TypeScript
2. Убедитесь, что файл скомпилирован: `npm run build`
3. Проверьте, что имя файла начинается с трех цифр

### Миграция не применяется

1. Проверьте имя файла (должно быть `NNN_description.ts`)
2. Перезапустите сервер
3. Проверьте логи: `docker logs petanque-backend -f`

## 📖 Дополнительная информация

- **Система миграций**: `backend/src/migrations/migrate.ts`
- **Примеры**: `backend/src/migrations/001_*.ts`
- **Полная документация**: `/MIGRATIONS.md`

---

**Версия**: 2.0.0  
**Дата**: 2025-10-09  
**Статус**: ✅ Готово к использованию
