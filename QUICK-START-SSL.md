# Быстрый старт: Настройка SSL для rating.petanque.ru

## Предварительная проверка

Перед началом убедитесь:

```bash
# 1. DNS записи указывают на ваш сервер
nslookup rating.petanque.ru
nslookup www.rating.petanque.ru

# 2. Порты 80 и 443 открыты
sudo ufw status
# или
sudo iptables -L -n | grep -E '80|443'

# 3. Docker работает
docker --version
docker compose version
```

## Пошаговая инструкция

### 1. Подготовка переменных окружения (опционально)

```bash
# Создайте .env файл с вашими секретами
cp .env.production.example .env
nano .env  # Отредактируйте значения
```

### 2. Запуск базовых сервисов

```bash
# Запустите базу данных, backend и frontend
docker compose up -d mysql backend frontend

# Дождитесь готовности (примерно 30 секунд)
docker compose ps
docker compose logs backend --tail=20
```

### 3. Получение SSL сертификата

```bash
# Запустите скрипт инициализации
./init-letsencrypt.sh
```

**Что делает скрипт:**
- ✓ Создает временные директории и dummy сертификат
- ✓ Запускает nginx с базовой конфигурацией
- ✓ Получает настоящий SSL сертификат от Let's Encrypt
- ✓ Переключает nginx на HTTPS конфигурацию
- ✓ Перезагружает nginx

⏱️ Занимает: ~2-3 минуты

### 4. Проверка

```bash
# Проверьте все контейнеры
docker compose --profile production ps

# Проверьте логи nginx
docker compose logs nginx --tail=30

# Проверьте сертификат
docker compose run --rm certbot certificates
```

### 5. Тестирование в браузере

Откройте: https://rating.petanque.ru

✓ Должна отображаться страница сайта  
✓ В адресной строке должен быть замок 🔒  
✓ HTTP должен перенаправляться на HTTPS  

### 6. Настройка автообновления сертификатов

#### Вариант A: Через cron (рекомендуется для VPS)

```bash
# Откройте crontab
crontab -e

# Добавьте строку (проверка каждое воскресенье в 3:00 ночи)
0 3 * * 0 cd /путь/к/rate-scoring && ./renew-certificates.sh >> /tmp/certbot-renew.log 2>&1
```

#### Вариант B: Через Docker (рекомендуется для облачных платформ)

```bash
# Используйте docker-compose.prod.yml
docker compose -f docker-compose.yml -f docker-compose.prod.yml --profile production up -d
```

## Устранение проблем

### ❌ "Port 80 is already in use"

```bash
# Найдите процесс
sudo lsof -i :80

# Остановите его или измените порты в docker-compose.yml
```

### ❌ "DNS validation failed"

```bash
# Проверьте DNS
dig rating.petanque.ru
dig www.rating.petanque.ru

# Подождите распространения DNS (до 24 часов)
# Или используйте staging режим для тестов
```

### ❌ "Couldn't connect to the ACME CA"

```bash
# Проверьте интернет соединение
curl -I https://acme-v02.api.letsencrypt.org/directory

# Проверьте firewall
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
```

### ❌ "Rate limit exceeded"

Let's Encrypt лимиты:
- 50 сертификатов/неделю на домен
- 5 попыток/час для одного набора доменов

**Решение**: Подождите или используйте staging режим:
```bash
# В init-letsencrypt.sh измените
staging=1
```

## Команды для управления

```bash
# Посмотреть статус
docker compose --profile production ps

# Посмотреть логи
docker compose logs -f nginx
docker compose logs -f certbot

# Перезапустить nginx
docker compose --profile production restart nginx

# Обновить сертификаты вручную
./renew-certificates.sh

# Остановить всё
docker compose --profile production down

# Полный перезапуск
docker compose --profile production down
docker compose --profile production up -d
```

## Безопасность

После настройки SSL:

1. **Измените пароли** в `.env` файле или `docker-compose.yml`:
   - MYSQL_ROOT_PASSWORD
   - MYSQL_PASSWORD
   - JWT_SECRET (минимум 32 символа)
   - ADMIN_PASSWORD

2. **Проверьте SSL конфигурацию**:
   - https://www.ssllabs.com/ssltest/analyze.html?d=rating.petanque.ru
   - Цель: оценка A или A+

3. **Настройте резервное копирование**:
```bash
# Бэкап сертификатов
docker run --rm -v petanque_certbot-etc:/etc/letsencrypt \
  -v $(pwd):/backup alpine \
  tar czf /backup/ssl-backup-$(date +%Y%m%d).tar.gz -C /etc/letsencrypt .

# Бэкап базы данных
docker compose exec mysql mysqldump -u root -p petanque_rating > backup-$(date +%Y%m%d).sql
```

## Поддержка

Если возникли проблемы:

1. Проверьте [SSL-SETUP.md](SSL-SETUP.md) для подробной информации
2. Посмотрите логи: `docker compose logs --tail=100`
3. Напишите на: afrikanov.andrey@gmail.com

---

**Готово!** 🎉 Ваш сайт теперь работает с HTTPS и автоматическим обновлением сертификатов.

