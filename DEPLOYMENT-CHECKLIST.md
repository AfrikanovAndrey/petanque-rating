# Чек-лист развёртывания в Production

Используйте этот чек-лист для развёртывания rating.petanque.ru в production окружении.

## 📋 Предварительная подготовка

### DNS и Сеть
- [ ] DNS записи для `rating.petanque.ru` и `www.rating.petanque.ru` указывают на IP сервера
- [ ] Порты 80 и 443 открыты в файрволле
- [ ] SSH доступ к серверу настроен

### Сервер
- [ ] Docker установлен (версия 20.0+)
- [ ] Docker Compose установлен (версия 2.0+)
- [ ] Достаточно места на диске (минимум 10GB свободно)
- [ ] Настроены swap и память (рекомендуется минимум 2GB RAM)

## 🔐 Безопасность

### Пароли и секреты
- [ ] Сгенерирован надёжный `JWT_SECRET` (минимум 32 символа)
- [ ] Изменён `MYSQL_ROOT_PASSWORD`
- [ ] Изменён `MYSQL_PASSWORD`
- [ ] Изменён `ADMIN_PASSWORD`
- [ ] Создан `.env` файл с секретами (не коммитить в git!)

### Генерация безопасных секретов

```bash
# JWT Secret (64 символа)
openssl rand -base64 48

# MySQL пароли (32 символа)
openssl rand -base64 24

# Admin пароль (создайте собственный сложный пароль)
```

## 🚀 Развёртывание

### Шаг 1: Подготовка кода

```bash
# Клонирование репозитория
git clone <repository-url> /path/to/rate-scoring
cd /path/to/rate-scoring

# Создание .env файла (опционально, можно использовать переменные в docker-compose.yml)
# cp .env.production.example .env
# nano .env  # Отредактируйте значения
```

- [ ] Код клонирован на сервер
- [ ] Проверены права на файлы (`chmod +x *.sh`)

### Шаг 2: Базовые сервисы

```bash
# Запуск базы данных, backend и frontend
docker compose up -d mysql backend frontend

# Проверка логов
docker compose logs -f backend
```

- [ ] MySQL контейнер запущен и здоров
- [ ] Backend контейнер запущен
- [ ] Frontend контейнер запущен
- [ ] База данных инициализирована

### Шаг 3: SSL сертификаты

```bash
# Проверка готовности
./check-ssl-ready.sh

# Получение сертификата
./init-letsencrypt.sh

# Проверка
docker compose --profile production ps
docker compose logs nginx
```

- [ ] Скрипт проверки выполнен успешно
- [ ] SSL сертификат получен
- [ ] Nginx запущен и работает
- [ ] Сайт доступен по HTTPS

### Шаг 4: Автоматическое обновление сертификатов

**Вариант A: Через cron**

```bash
crontab -e
# Добавьте строку:
0 3 * * 0 cd /path/to/rate-scoring && ./renew-certificates.sh >> /var/log/certbot-renew.log 2>&1
```

- [ ] Cron задача добавлена
- [ ] Путь в cron задаче правильный

**Вариант B: Через Docker (рекомендуется)**

```bash
docker compose -f docker-compose.yml -f docker-compose.prod.yml --profile production up -d
```

- [ ] Контейнер certbot-renew запущен
- [ ] Автообновление настроено

## ✅ Проверка развёртывания

### Базовые проверки

```bash
# Статус всех контейнеров
docker compose --profile production ps

# Логи
docker compose logs nginx --tail=50
docker compose logs backend --tail=50

# Сертификаты
docker compose run --rm certbot certificates
```

- [ ] Все контейнеры в статусе `Up`
- [ ] Нет ошибок в логах nginx
- [ ] Нет ошибок в логах backend
- [ ] Сертификат действителен (срок > 60 дней)

### Функциональные проверки

- [ ] Сайт открывается по https://rating.petanque.ru
- [ ] HTTP перенаправляется на HTTPS
- [ ] SSL сертификат валидный (зелёный замок в браузере)
- [ ] API отвечает: `curl https://rating.petanque.ru/api/rating/table`
- [ ] Frontend загружается корректно
- [ ] Админка доступна: https://rating.petanque.ru/admin
- [ ] Можно войти в админку

### Проверка безопасности

- [ ] SSL Labs Test: https://www.ssllabs.com/ssltest/analyze.html?d=rating.petanque.ru (оценка A/A+)
- [ ] Security Headers: https://securityheaders.com/?q=rating.petanque.ru (оценка A/A+)
- [ ] Проверка HSTS: заголовок `Strict-Transport-Security` присутствует
- [ ] Проверка rate limiting: множественные быстрые запросы к API блокируются

## 📊 Мониторинг

### Настройка логирования

```bash
# Просмотр логов в реальном времени
docker compose logs -f

# Логи конкретного сервиса
docker compose logs -f nginx
docker compose logs -f backend
docker compose logs -f mysql

# Экспорт логов
docker compose logs > logs-$(date +%Y%m%d).txt
```

- [ ] Логи доступны и читаемы
- [ ] Настроена ротация логов Docker (опционально)

### Резервное копирование

```bash
# База данных
docker compose exec mysql mysqldump -u root -p petanque_rating > backup-$(date +%Y%m%d).sql

# SSL сертификаты
docker run --rm -v petanque_certbot-etc:/etc/letsencrypt -v $(pwd):/backup alpine \
  tar czf /backup/ssl-backup-$(date +%Y%m%d).tar.gz -C /etc/letsencrypt .

# Загруженные файлы
tar czf uploads-backup-$(date +%Y%m%d).tar.gz uploads/
```

- [ ] Бэкап базы данных выполнен
- [ ] Бэкап SSL сертификатов выполнен
- [ ] Бэкап загруженных файлов выполнен
- [ ] Настроено автоматическое резервное копирование (cron)

## 🔧 Обслуживание

### Обновление приложения

```bash
# Получение последних изменений
git pull

# Пересборка и перезапуск контейнеров
docker compose -f docker-compose.yml -f docker-compose.prod.yml --profile production build
docker compose -f docker-compose.yml -f docker-compose.prod.yml --profile production up -d

# Проверка
docker compose ps
docker compose logs -f
```

### Обновление сертификатов вручную

```bash
# Проверка срока действия
docker compose run --rm certbot certificates

# Принудительное обновление
docker compose run --rm certbot renew --force-renewal
docker compose --profile production exec nginx nginx -s reload
```

### Очистка Docker

```bash
# Удаление неиспользуемых образов
docker image prune -a

# Удаление неиспользуемых volumes
docker volume prune

# Полная очистка (ОСТОРОЖНО!)
docker system prune -a --volumes
```

## 🚨 Устранение проблем

### Сайт недоступен

1. Проверьте статус контейнеров: `docker compose ps`
2. Проверьте логи nginx: `docker compose logs nginx`
3. Проверьте DNS: `nslookup rating.petanque.ru`
4. Проверьте файрволл: `sudo ufw status`

### SSL ошибки

1. Проверьте сертификаты: `docker compose run --rm certbot certificates`
2. Проверьте конфигурацию nginx: `docker compose exec nginx nginx -t`
3. Перезапустите nginx: `docker compose restart nginx`

### Ошибки базы данных

1. Проверьте статус MySQL: `docker compose ps mysql`
2. Проверьте логи: `docker compose logs mysql`
3. Проверьте подключение: `docker compose exec mysql mysql -u root -p -e "SHOW DATABASES;"`

### Проблемы с производительностью

1. Проверьте использование ресурсов: `docker stats`
2. Проверьте место на диске: `df -h`
3. Увеличьте ресурсы MySQL в docker-compose.yml

## 📞 Поддержка

- **Email**: afrikanov.andrey@gmail.com
- **Документация**: 
  - [README.md](README.md) - основная документация
  - [QUICK-START-SSL.md](QUICK-START-SSL.md) - быстрый старт SSL
  - [SSL-SETUP.md](SSL-SETUP.md) - подробная настройка SSL
  - [DOCKER.md](DOCKER.md) - работа с Docker

## ✨ После развёртывания

- [ ] Создан первый администратор
- [ ] Загружены настройки очков за позиции
- [ ] Загружены первые турниры для тестирования
- [ ] Проверена корректность расчёта рейтинга
- [ ] Документация передана заказчику
- [ ] Настроены уведомления о проблемах (опционально)
- [ ] Настроен мониторинг uptime (опционально)

---

**Поздравляем! 🎉** Ваше приложение успешно развёрнуто в production!

**Следующие шаги:**
1. Настройте автоматические резервные копии
2. Настройте мониторинг (Prometheus, Grafana, Uptime Robot)
3. Документируйте изменения и процедуры
4. Обучите администраторов работе с системой

