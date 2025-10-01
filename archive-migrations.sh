#!/bin/bash

# ========================================
# Скрипт для архивирования миграций
# ========================================

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
MIGRATIONS_DIR="$SCRIPT_DIR/backend/src/migrations"
ARCHIVE_DIR="$SCRIPT_DIR/migrations-archive"
DATE=$(date +"%Y%m%d_%H%M%S")

echo "🗂️ Архивирование миграций..."
echo "📁 Источник: $MIGRATIONS_DIR"
echo "📁 Архив: $ARCHIVE_DIR"

# Создать папку архива если не существует
mkdir -p "$ARCHIVE_DIR"

# Создать папку для данного архива
CURRENT_ARCHIVE="$ARCHIVE_DIR/migrations_$DATE"
mkdir -p "$CURRENT_ARCHIVE"

# Копировать все миграции
echo "📄 Копирование файлов миграций..."
cp -r "$MIGRATIONS_DIR"/* "$CURRENT_ARCHIVE/"

# Создать README для архива
cat > "$CURRENT_ARCHIVE/README.md" << EOF
# Архив миграций от $DATE

Этот архив содержит все миграции, которые были объединены в единый инициализирующий файл.

## Содержимое архива

$(ls -la "$CURRENT_ARCHIVE"/*.ts 2>/dev/null | awk '{print "- " $9}' | sed 's|.*/||')

## Применение

Для применения отдельной миграции:

1. Скопируйте нужный файл обратно в \`backend/src/migrations/\`
2. Импортируйте функцию в \`migrate.ts\`
3. Запустите миграцию:
   \`\`\`bash
   cd backend
   npm run migrate
   \`\`\`

## Восстановление всех миграций

Для полного восстановления системы миграций:

\`\`\`bash
cp migrations_$DATE/* ../backend/src/migrations/
\`\`\`

## Создание резервной копии БД

\`\`\`bash
# Экспорт данных
docker exec petanque-mysql mysqldump -u root -p petanque_rating > backup_$DATE.sql

# Импорт данных
docker exec -i petanque-mysql mysql -u root -p petanque_rating < backup_$DATE.sql
\`\`\`
EOF

echo "✅ Архив создан: $CURRENT_ARCHIVE"

# Создать символическую ссылку на последний архив
ln -sfn "migrations_$DATE" "$ARCHIVE_DIR/latest"

echo "📊 Статистика:"
echo "   📄 Файлов заархивировано: $(ls -1 "$CURRENT_ARCHIVE"/*.ts 2>/dev/null | wc -l)"
echo "   📦 Размер архива: $(du -sh "$CURRENT_ARCHIVE" | cut -f1)"
echo "   🔗 Ссылка на последний архив: $ARCHIVE_DIR/latest"

# Показать инструкции
cat << EOF

📋 Дальнейшие действия:

1. ✅ Архив миграций создан
2. 🔄 Обновите backend/src/migrations/migrate.ts:
   - Уберите импорты отдельных миграций
   - Оставьте только базовую структуру для новых миграций
   
3. 🐳 Перезапустите Docker контейнеры для применения новой структуры БД:
   docker-compose down
   docker-compose up -d

4. 🧪 Протестируйте работу приложения

📝 Документация доступна в файле: МИГРАЦИИ_АРХИВ.md

EOF

echo "🎉 Архивирование завершено успешно!"
