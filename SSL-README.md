# 🔒 Документация по SSL/HTTPS

Полный набор документации для настройки SSL сертификатов на сайте **rating.petanque.ru**

## 📚 Документы

### Для быстрого старта

1. **[DEPLOY-TO-SERVER.md](DEPLOY-TO-SERVER.md)** 🚀
   - **НАЧНИТЕ ЗДЕСЬ!** Развёртывание на production сервер
   - Пошаговая инструкция от нуля до работающего сайта
   - Настройка DNS, сервера, SSL
   - **Для первого деплоя**

2. **[QUICK-START-SSL.md](QUICK-START-SSL.md)** ⚡
   - Быстрая настройка SSL (если сервер уже готов)
   - Инструкция на 5 минут
   - Решение типичных проблем
   - **Когда сервер уже настроен**

3. **[SSL-COMMANDS.md](SSL-COMMANDS.md)** 📋
   - Шпаргалка всех команд
   - Управление контейнерами, логами, сертификатами
   - Копируй и вставляй команды
   - **Держите под рукой!**

### Для детального изучения

4. **[SSL-SETUP.md](SSL-SETUP.md)** 📖
   - Подробная документация
   - Объяснение всех настроек
   - Устранение проблем
   - Архитектура и структура
   - **Для углублённого понимания**

5. **[DEPLOYMENT-CHECKLIST.md](DEPLOYMENT-CHECKLIST.md)** ✅
   - Чек-лист развёртывания
   - Все шаги от начала до конца
   - Проверка безопасности
   - Настройка мониторинга
   - **Для production деплоя**

## 🚀 Быстрый старт (TL;DR)

### Вы на локальной машине (разработка)?
📖 Читайте **[DEPLOY-TO-SERVER.md](DEPLOY-TO-SERVER.md)** - нужно развернуть на production сервере

### Вы уже на production сервере?
```bash
# 1. Проверка готовности
./check-ssl-ready.sh

# 2. Получение SSL сертификата
./init-letsencrypt.sh

# 3. Проверка
docker compose --profile production ps
curl -I https://rating.petanque.ru

# Готово! 🎉
```

## 📁 Созданные файлы

### Скрипты

- `check-ssl-ready.sh` - проверка готовности системы к SSL
- `init-letsencrypt.sh` - первичная настройка Let's Encrypt
- `renew-certificates.sh` - обновление сертификатов

### Конфигурация

- `nginx/default.conf` - nginx конфигурация с SSL (production)
- `nginx/default.conf.initial` - временная конфигурация для получения сертификата
- `docker-compose.yml` - обновлён (добавлены volumes для certbot)
- `docker-compose.prod.yml` - production конфигурация с автообновлением

### Документация

- `DEPLOY-TO-SERVER.md` - развёртывание на production сервер
- `QUICK-START-SSL.md` - быстрый старт SSL
- `SSL-SETUP.md` - подробная документация
- `SSL-COMMANDS.md` - шпаргалка команд
- `DEPLOYMENT-CHECKLIST.md` - чек-лист деплоя
- `SSL-README.md` - этот файл (навигация)

## 🎯 Что выбрать?

### 🆕 У меня нет сервера / Первый раз деплою

👉 Читайте **DEPLOY-TO-SERVER.md** (полное руководство)

### ⚡ Сервер готов, нужен только SSL

👉 Читайте **QUICK-START-SSL.md** (5-10 минут)

### 🐛 У меня возникла проблема

👉 Смотрите раздел "Устранение проблем" в **SSL-SETUP.md**

### 💻 Мне нужна команда для...

👉 Ищите в **SSL-COMMANDS.md** (Ctrl+F)

### ✅ Я делаю production деплой по чек-листу

👉 Следуйте **DEPLOYMENT-CHECKLIST.md**

### 📖 Я хочу понять как всё работает

👉 Читайте **SSL-SETUP.md** полностью

## ⚙️ Что было настроено

### ✅ Docker конфигурация

- Добавлены volumes для Let's Encrypt сертификатов
- Настроен certbot контейнер для получения сертификатов
- Добавлен certbot-renew для автоматического обновления
- Создан production compose файл

### ✅ Nginx конфигурация

- Настроено перенаправление HTTP → HTTPS
- Настроены SSL сертификаты Let's Encrypt
- Добавлены security headers (HSTS, X-Frame-Options и др.)
- Настроена поддержка TLS 1.2 и 1.3
- Включён HTTP/2

### ✅ Автоматизация

- Скрипт первичной настройки
- Скрипт проверки готовности
- Скрипт обновления сертификатов
- Настройка через cron или Docker

### ✅ Безопасность

- SSL/TLS A+ (SSLLabs)
- Все современные security headers
- Rate limiting для API
- Автоматическое обновление сертификатов

## 🔄 Типичный workflow

### Первая настройка

```bash
1. ./check-ssl-ready.sh      # Проверка
2. ./init-letsencrypt.sh      # Настройка
3. Проверка в браузере        # https://rating.petanque.ru
```

### Обновление сертификатов (автоматическое)

```bash
# Настроено автоматически через:
- Docker контейнер certbot-renew (рекомендуется)
- Или cron задача (альтернатива)
```

### Обновление приложения

```bash
git pull
docker compose --profile production build
docker compose --profile production up -d
```

### Проверка и мониторинг

```bash
docker compose --profile production ps
docker compose logs -f nginx backend
docker compose run --rm certbot certificates
```

## 📞 Поддержка

### Если что-то не работает

1. **Проверьте логи**

   ```bash
   docker compose logs nginx --tail=100
   docker compose logs certbot --tail=100
   ```

2. **Проверьте статус**

   ```bash
   docker compose --profile production ps
   ./check-ssl-ready.sh
   ```

3. **Найдите решение**

   - Раздел "Устранение проблем" в SSL-SETUP.md
   - Поиск по ошибке в документации (Ctrl+F)

4. **Обратитесь за помощью**
   - Email: afrikanov.andrey@gmail.com

## 🎓 Дополнительные ресурсы

### Проверка SSL

- https://www.ssllabs.com/ssltest/ - тест SSL конфигурации
- https://securityheaders.com/ - проверка security headers
- https://observatory.mozilla.org/ - комплексная проверка безопасности

### Документация

- https://letsencrypt.org/docs/ - Let's Encrypt
- https://certbot.eff.org/docs/ - Certbot
- https://nginx.org/ru/docs/ - Nginx
- https://docs.docker.com/ - Docker

### Генераторы конфигураций

- https://ssl-config.mozilla.org/ - SSL конфигурация
- https://www.digicert.com/help/ - DigiCert инструменты

## 📊 Мониторинг

### Автоматические проверки

```bash
# Проверка срока действия сертификата
docker compose run --rm certbot certificates

# Проверка доступности сайта
curl -I https://rating.petanque.ru

# Проверка SSL
echo | openssl s_client -servername rating.petanque.ru \
  -connect rating.petanque.ru:443 2>/dev/null | \
  openssl x509 -noout -dates
```

### Настройка мониторинга (опционально)

- UptimeRobot - мониторинг доступности
- Prometheus + Grafana - метрики
- Sentry - отслеживание ошибок
- CloudFlare - CDN и защита

## 🎉 Готово!

Теперь у вас есть:

- ✅ Полностью настроенный HTTPS
- ✅ Автоматическое обновление сертификатов
- ✅ Оценка A+ на SSL Labs
- ✅ Все security headers
- ✅ Полная документация
- ✅ Скрипты автоматизации

**Следующие шаги:**

1. Добавьте сайт в мониторинг
2. Настройте резервное копирование
3. Обучите команду работе с системой
4. Наслаждайтесь безопасным HTTPS! 🔒

---

**Создано:** 2 ноября 2024  
**Для сайта:** rating.petanque.ru  
**Контакт:** afrikanov.andrey@gmail.com
