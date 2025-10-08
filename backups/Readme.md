# 🚀 Инструкция по применению backups

### Создать резервную копию

```bash
docker exec petanque-mysql mysqldump --no-tablespaces -u petanque_user -ppetanque_password petanque_rating > ./backups/petanque_rating_dump.sql
```

### Восстановить БД из backup

```bash
# Очистить БД
docker exec -i petanque-mysql mysql -u petanque_user -ppetanque_password petanque_rating < ./backups/clear-database.sql

# Восстановить БД из резервной копии
docker exec -i petanque-mysql mysql --default-character-set=utf8 -u petanque_user -ppetanque_password petanque_rating < ./backups/petanque_rating_dump.sql
```
