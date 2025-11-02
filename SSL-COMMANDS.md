# Шпаргалка команд SSL/HTTPS

Краткая справка по командам для работы с SSL сертификатами.

## 🚀 Быстрый старт

```bash
# Полная настройка в 3 команды
./check-ssl-ready.sh          # Проверка готовности
./init-letsencrypt.sh         # Получение сертификата
docker compose --profile production ps  # Проверка статуса
```

## 📦 Управление контейнерами

```bash
# Запуск всех сервисов с production профилем
docker compose --profile production up -d

# Запуск с prod конфигурацией и автообновлением
docker compose -f docker-compose.yml -f docker-compose.prod.yml --profile production up -d

# Остановка всех сервисов
docker compose --profile production down

# Перезапуск конкретного сервиса
docker compose restart nginx
docker compose restart backend
docker compose restart mysql

# Пересборка и перезапуск
docker compose --profile production up -d --build

# Статус всех контейнеров
docker compose --profile production ps

# Использование ресурсов
docker stats
```

## 📋 Просмотр логов

```bash
# Все логи
docker compose logs -f

# Конкретный сервис
docker compose logs -f nginx
docker compose logs -f backend
docker compose logs -f certbot

# Последние N строк
docker compose logs --tail=50 nginx
docker compose logs --tail=100 backend

# Сохранить логи в файл
docker compose logs > logs-$(date +%Y%m%d-%H%M%S).txt
```

## 🔒 Управление SSL сертификатами

```bash
# Информация о сертификатах
docker compose run --rm certbot certificates

# Проверка срока действия
docker compose run --rm certbot certificates | grep "Expiry Date"

# Обновление сертификатов (автоматическое)
./renew-certificates.sh

# Принудительное обновление (до истечения срока)
docker compose run --rm certbot renew --force-renewal

# Удаление сертификата (ОСТОРОЖНО!)
docker compose run --rm certbot delete --cert-name rating.petanque.ru

# Тестовый (staging) сертификат
docker compose run --rm certbot certonly --webroot \
  -w /var/www/html \
  --staging \
  -d rating.petanque.ru \
  -d www.rating.petanque.ru \
  --email afrikanov.andrey@gmail.com \
  --agree-tos --no-eff-email
```

## 🔧 Управление Nginx

```bash
# Проверка конфигурации
docker compose exec nginx nginx -t

# Перезагрузка конфигурации (без остановки)
docker compose exec nginx nginx -s reload

# Перезапуск nginx
docker compose restart nginx

# Просмотр конфигурации
docker compose exec nginx cat /etc/nginx/conf.d/default.conf

# Редактирование конфигурации (на хосте)
nano nginx/default.conf
docker compose exec nginx nginx -t  # Проверка
docker compose exec nginx nginx -s reload  # Применение
```

## 🗄️ Работа с базой данных

```bash
# Подключение к MySQL
docker compose exec mysql mysql -u root -p petanque_rating

# Создание бэкапа
docker compose exec mysql mysqldump -u root -p petanque_rating > backup-$(date +%Y%m%d).sql

# Восстановление из бэкапа
docker compose exec -T mysql mysql -u root -p petanque_rating < backup-20241102.sql

# Просмотр таблиц
docker compose exec mysql mysql -u root -p -e "USE petanque_rating; SHOW TABLES;"

# Экспорт в один архив
docker compose exec mysql mysqldump -u root -p petanque_rating | gzip > backup-$(date +%Y%m%d).sql.gz
```

## 💾 Резервное копирование

```bash
# Бэкап базы данных
docker compose exec mysql mysqldump -u root -p petanque_rating > \
  backups/db-backup-$(date +%Y%m%d).sql

# Бэкап SSL сертификатов
docker run --rm \
  -v rate-scoring_certbot-etc:/etc/letsencrypt \
  -v $(pwd)/backups:/backup \
  alpine tar czf /backup/ssl-backup-$(date +%Y%m%d).tar.gz -C /etc/letsencrypt .

# Бэкап загруженных файлов
tar czf backups/uploads-backup-$(date +%Y%m%d).tar.gz uploads/

# Полный бэкап
mkdir -p backups/full-backup-$(date +%Y%m%d)
docker compose exec mysql mysqldump -u root -p petanque_rating > \
  backups/full-backup-$(date +%Y%m%d)/database.sql
cp -r uploads backups/full-backup-$(date +%Y%m%d)/
docker run --rm \
  -v rate-scoring_certbot-etc:/etc/letsencrypt \
  -v $(pwd)/backups/full-backup-$(date +%Y%m%d):/backup \
  alpine tar czf /backup/ssl.tar.gz -C /etc/letsencrypt .
```

## 🔍 Диагностика

```bash
# Проверка DNS
nslookup rating.petanque.ru
dig rating.petanque.ru

# Проверка портов
sudo lsof -i :80
sudo lsof -i :443
sudo netstat -tlnp | grep ':80\|:443'

# Проверка SSL сертификата (внешняя)
echo | openssl s_client -servername rating.petanque.ru \
  -connect rating.petanque.ru:443 2>/dev/null | \
  openssl x509 -noout -dates

# Проверка SSL (подробная)
echo | openssl s_client -servername rating.petanque.ru \
  -connect rating.petanque.ru:443 2>/dev/null | \
  openssl x509 -noout -text

# Тест SSL на SSLLabs
echo "https://www.ssllabs.com/ssltest/analyze.html?d=rating.petanque.ru"

# Проверка заголовков безопасности
curl -I https://rating.petanque.ru

# Проверка API
curl https://rating.petanque.ru/api/rating/table
curl https://rating.petanque.ru/health

# Проверка перенаправления HTTP -> HTTPS
curl -I http://rating.petanque.ru
```

## 🧹 Очистка

```bash
# Удаление остановленных контейнеров
docker compose down

# Удаление неиспользуемых образов
docker image prune -a

# Удаление неиспользуемых volumes (ОСТОРОЖНО!)
docker volume prune

# Удаление всего неиспользуемого
docker system prune -a

# Полная очистка проекта (ТОЛЬКО для переустановки!)
docker compose --profile production down -v
docker system prune -a --volumes
```

## 🔄 Обновление приложения

```bash
# Получение последних изменений
git pull

# Пересборка контейнеров
docker compose --profile production build

# Перезапуск с новыми образами
docker compose --profile production up -d

# Или всё в одной команде
git pull && \
docker compose --profile production build && \
docker compose --profile production up -d

# Проверка после обновления
docker compose --profile production ps
docker compose logs -f --tail=50
```

## 📊 Мониторинг

```bash
# Использование ресурсов контейнерами
docker stats

# Место на диске
df -h
docker system df

# Размер volumes
docker volume ls
docker volume inspect rate-scoring_mysql_data

# Логи системы
journalctl -u docker.service -f

# Процессы в контейнере
docker compose exec nginx ps aux
docker compose exec backend ps aux
```

## ⚙️ Переменные окружения

```bash
# Просмотр переменных окружения контейнера
docker compose exec backend env
docker compose exec backend printenv | grep DB_

# Изменение переменных (требует перезапуска)
# 1. Отредактируйте docker-compose.yml или .env
nano docker-compose.yml

# 2. Пересоздайте контейнер
docker compose up -d backend --force-recreate
```

## 🚨 Аварийное восстановление

```bash
# Полный перезапуск всех сервисов
docker compose --profile production down
docker compose --profile production up -d

# Восстановление базы данных
docker compose exec -T mysql mysql -u root -p petanque_rating < backup.sql

# Восстановление SSL сертификатов
docker run --rm \
  -v rate-scoring_certbot-etc:/etc/letsencrypt \
  -v $(pwd)/backups:/backup \
  alpine tar xzf /backup/ssl-backup-20241102.tar.gz -C /etc/letsencrypt

# Пересоздание всех контейнеров
docker compose --profile production up -d --force-recreate

# Откат на предыдущую версию
git log --oneline  # Найдите нужный коммит
git checkout <commit-hash>
docker compose --profile production build
docker compose --profile production up -d
```

## 📝 Полезные алиасы

Добавьте в `~/.bashrc` или `~/.zshrc`:

```bash
# Docker Compose сокращения
alias dc='docker compose'
alias dcp='docker compose --profile production'
alias dcl='docker compose logs -f'
alias dps='docker compose ps'

# Petanque specific
alias petanque-logs='docker compose logs -f nginx backend'
alias petanque-status='docker compose --profile production ps'
alias petanque-restart='docker compose --profile production restart'
alias petanque-backup='docker compose exec mysql mysqldump -u root -p petanque_rating > backup-$(date +%Y%m%d).sql'
```

После добавления:
```bash
source ~/.bashrc  # или source ~/.zshrc
```

---

**Совет**: Сохраните эту шпаргалку в закладки для быстрого доступа к командам!

