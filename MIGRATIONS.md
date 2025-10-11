# 🚀 Самоконтролирующие TypeScript миграции

## Обзор

С версии 2.0.0 в проект добавлена **система самоконтролирующих TypeScript миграций**.

**Ключевые особенности:**

- ✅ Миграции написаны на **TypeScript** (не SQL)
- ✅ **Самоконтролирующие** - каждая сама проверяет, нужно ли ее применять
- ✅ **Идемпотентные** - можно запускать повторно без ошибок
- ✅ **Нет таблицы migrations** - не засоряем БД служебными таблицами

Миграции применяются автоматически при каждом запуске сервера!

## Как это работает

### При запуске сервера

1. **Сканируется папка migrations/**

   - Находятся все TypeScript файлы `NNN_*.ts`
   - Файлы сортируются по имени (001, 002, 003...)

2. **Применяются все миграции по порядку**

   - Импортируется TypeScript модуль миграции
   - Вызывается функция `up(pool)`
   - **Миграция сама проверяет**, нужно ли ее применять
   - Если уже применена → выводит "⏭️ уже существует"
   - Если не применена → создает таблицы/колонки

3. **Нет таблицы отслеживания**

   - Не создается таблица `migrations`
   - Статус определяется по фактическому состоянию БД
   - Каждая миграция самостоятельная и идемпотентная

### Вывод в консоли

**Первый запуск:**

```
🔍 Проверка инициализации БД...
✅ Структура БД инициализирована
📋 Найдено миграций: 1
📝 Применение миграции: 001_add_users_table...
✅ Таблица users создана
✅ Данные из таблицы admins скопированы в users
✅ Все миграции применены
✅ БД готова к работе
```

**Повторный запуск:**

```
📋 Найдено миграций: 1
📝 Применение миграции: 001_add_users_table...
⏭️  Таблица users уже существует
✅ Все миграции применены
✅ БД готова к работе
```

## Преимущества

### ✅ Для разработчиков

- TypeScript вместо SQL - все в одном языке
- Типизация и проверка на этапе компиляции
- Не нужно вручную выполнять SQL файлы
- Автоматическое обновление при pull новых изменений
- Самоконтроль: миграции идемпотентные

### ✅ Для деплоя

- Упрощенный процесс развертывания
- Автоматическое обновление БД при обновлении кода
- Нет риска забыть применить миграцию
- Нет таблицы `migrations` в БД
- Легко откатить через backup

### ✅ Для команды

- Все в коде: миграции версионируются в Git
- Прозрачная история изменений БД
- Синхронизация БД между разработчиками
- Консистентность между окружениями
- Можно тестировать и ревьюить как обычный код

## Создание новой миграции

### Шаг 1: Создайте TypeScript файл

```bash
# Формат: NNN_description.ts
touch backend/src/migrations/002_add_sessions_table.ts
```

### Шаг 2: Напишите самоконтролирующую миграцию

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

  // Создаем таблицу
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
  await pool.execute(`DROP TABLE IF EXISTS sessions`);
  console.log("✅ Таблица sessions удалена");
}
```

### Шаг 3: Перезапустите сервер

```bash
docker-compose restart backend
```

Миграция применится автоматически! Если таблица уже существует, миграция просто выведет "⏭️ уже существует" и продолжит работу.

## Правила именования

### Формат файла

```
NNN_description.sql
```

Где:

- `NNN` - трехзначный порядковый номер (001, 002, 003...)
- `description` - краткое описание на английском (snake_case)

### Примеры хороших имен

✅ `001_add_users_table.sql`  
✅ `002_add_sessions_table.sql`  
✅ `003_update_players_gender.sql`  
✅ `004_add_tournaments_index.sql`

### Примеры плохих имен

❌ `users.sql` (нет номера)  
❌ `1_users.sql` (номер должен быть трехзначным)  
❌ `migration.sql` (нет описания)  
❌ `001-add-users.sql` (используйте underscore, не дефис)

## Лучшие практики

### 1. Одна миграция = одна задача

✅ Хорошо:

```sql
-- 001_add_users_table.sql
CREATE TABLE users (...);
```

❌ Плохо:

```sql
-- 001_multiple_changes.sql
CREATE TABLE users (...);
CREATE TABLE sessions (...);
ALTER TABLE players ...;
```

### 2. Используйте IF NOT EXISTS

✅ Хорошо:

```sql
CREATE TABLE IF NOT EXISTS users (...);
```

❌ Плохо:

```sql
CREATE TABLE users (...);  -- упадет, если таблица существует
```

### 3. Добавляйте комментарии

✅ Хорошо:

```sql
-- Миграция: Добавление поля email для пользователей
-- Дата: 2025-10-09
-- Автор: Иван Иванов

ALTER TABLE users
  ADD COLUMN email VARCHAR(255) UNIQUE;
```

### 4. Тестируйте на локальной БД

Перед коммитом проверьте:

1. Миграция применяется без ошибок
2. Миграция идемпотентна (можно запустить повторно)
3. Данные не теряются

### 5. Не изменяйте примененные миграции

❌ Не делайте так:

- Изменение уже примененной миграции
- Удаление примененной миграции
- Переименование примененной миграции

✅ Вместо этого:

- Создайте новую миграцию с исправлениями

## Откат миграций

### Автоматический откат не поддерживается

Система не поддерживает автоматический откат. Если нужно откатить:

1. **Создайте backup перед миграцией**

   ```bash
   docker exec petanque-mysql mysqldump -uroot -ppassword petanque_rating > backup.sql
   ```

2. **Откатите вручную**

   ```bash
   docker exec -i petanque-mysql mysql -uroot -ppassword petanque_rating < backup.sql
   ```

3. **Или создайте обратную миграцию**
   ```sql
   -- 003_revert_add_email.sql
   ALTER TABLE users DROP COLUMN email;
   ```

## Проверка статуса миграций

### В MySQL

```sql
-- Посмотреть все примененные миграции
SELECT * FROM migrations ORDER BY id;

-- Посмотреть последнюю миграцию
SELECT * FROM migrations ORDER BY id DESC LIMIT 1;

-- Посмотреть миграции за сегодня
SELECT * FROM migrations
WHERE DATE(executed_at) = CURDATE();
```

### В коде

```typescript
// Проверить, применена ли миграция
const applied = await isMigrationApplied("001_add_users_table.sql");
console.log("Миграция применена:", applied);
```

## Troubleshooting

### Ошибка: Table 'migrations' doesn't exist

Это нормально при первом запуске. Таблица создается автоматически.

### Ошибка: Duplicate entry

Миграция уже применена. Система автоматически пропускает такие миграции.

### Ошибка при выполнении SQL

1. Проверьте синтаксис SQL
2. Убедитесь, что таблицы/колонки существуют
3. Проверьте foreign key constraints
4. Посмотрите логи: `docker logs petanque-backend -f`

### Миграция не применяется

1. Проверьте, что файл имеет расширение `.sql`
2. Проверьте правильность имени файла
3. Перезапустите сервер
4. Проверьте логи

### Нужно применить миграцию вручную

```bash
# Через Docker
docker exec -i petanque-mysql mysql -uroot -ppassword petanque_rating < backend/src/migrations/XXX_migration.sql

# Отметить как примененную
docker exec -i petanque-mysql mysql -uroot -ppassword petanque_rating -e "INSERT INTO migrations (name) VALUES ('XXX_migration.sql')"
```

## Примеры миграций

### Создание таблицы

```sql
-- 002_add_sessions_table.sql
CREATE TABLE IF NOT EXISTS sessions (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  token VARCHAR(255) NOT NULL UNIQUE,
  expires_at TIMESTAMP NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_token (token),
  INDEX idx_expires (expires_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

### Добавление колонки

```sql
-- 003_add_user_email.sql
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS email VARCHAR(255) UNIQUE AFTER username;

-- Добавить индекс
CREATE INDEX IF NOT EXISTS idx_email ON users(email);
```

### Изменение типа колонки

```sql
-- 004_update_user_name_length.sql
ALTER TABLE users
  MODIFY COLUMN name VARCHAR(500) NOT NULL;
```

### Вставка данных

```sql
-- 005_add_default_settings.sql
INSERT IGNORE INTO rating_settings (setting_name, setting_value, description)
VALUES
  ('email_notifications', 'true', 'Включить email уведомления'),
  ('max_upload_size', '10', 'Максимальный размер файла в MB');
```

### Создание индекса

```sql
-- 006_add_tournaments_performance_indexes.sql
CREATE INDEX IF NOT EXISTS idx_date ON tournaments(date);
CREATE INDEX IF NOT EXISTS idx_category ON tournaments(category);
CREATE INDEX IF NOT EXISTS idx_date_category ON tournaments(date, category);
```

## Дальнейшее развитие

Возможные улучшения системы миграций:

- [ ] Поддержка транзакций для атомарности
- [ ] Автоматический откат при ошибке
- [ ] Миграции "down" для отката
- [ ] CLI команда для создания миграций
- [ ] Dry-run режим для тестирования
- [ ] Поддержка JavaScript миграций
- [ ] Параллельное применение миграций
- [ ] Web UI для мониторинга

## Дополнительная информация

- **Документация**: `backend/src/migrations/README.md`
- **Код системы**: `backend/src/migrations/migrate.ts`
- **Примеры**: `backend/src/migrations/*.sql`

---

**Версия**: 2.0.0  
**Дата**: 2025-10-09  
**Статус**: ✅ Готово к использованию
