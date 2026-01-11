# 🚀 Инструкция по работе с резервными копиями БД

## 📁 Содержимое папки

- **`clear-database.sql`** - скрипт полной очистки данных БД (сохраняет настройки и пользователей)
- **`petanque_rating_dump.sql`** - резервная копия БД (пример/последний дамп)

## 💾 Создать резервную копию

```bash
# Полная резервная копия БД
docker exec petanque-mysql mysqldump --no-tablespaces -u petanque_user -ppetanque_password petanque_rating > ./backups/petanque_rating_dump.sql
```

## 🔄 Восстановить БД из backup

### Вариант 1: Полное восстановление (рекомендуется)

```bash
# 1. Очистить все данные (настройки и пользователи сохранятся)
docker exec -i petanque-mysql mysql -u petanque_user -ppetanque_password petanque_rating < ./backups/clear-database.sql


# 2. Восстановить данные из резервной копии
docker exec -i petanque-mysql mysql --default-character-set=utf8 -u petanque_user -ppetanque_password petanque_rating < ./backups/petanque_rating_dump.sql
```

## Скачать резервную копию с удалённого сервера

```bash
sftp user@remote-host
get /remote/file.txt  # скачать один файл
get -r /remote/dir/   # скачать папку
exit
```
