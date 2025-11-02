# Настройка SSL сертификатов для rating.petanque.ru

## Предварительные требования

1. **DNS настройки**: Убедитесь, что домен rating.petanque.ru и www.rating.petanque.ru указывают на IP-адрес вашего сервера
2. **Порты 80 и 443**: Должны быть открыты в файрволле и доступны из интернета
3. **Docker и Docker Compose**: Установлены и работают

## Быстрая настройка

### Шаг 1: Подготовка

Перед началом убедитесь, что все сервисы работают в обычном режиме:

```bash
# Запуск основных сервисов (без nginx)
docker compose up -d mysql backend frontend
```

### Шаг 2: Получение SSL сертификата

Выполните скрипт инициализации Let's Encrypt:

```bash
# Сделать скрипт исполняемым
chmod +x init-letsencrypt.sh

# Запустить скрипт
./init-letsencrypt.sh
```

Скрипт выполнит следующие действия:

1. Создаст временный (dummy) сертификат
2. Запустит nginx с временной конфигурацией
3. Получит настоящий сертификат от Let's Encrypt
4. Переключит nginx на полную SSL конфигурацию
5. Перезагрузит nginx

### Шаг 3: Проверка

После завершения скрипта проверьте:

```bash
# Проверить статус всех контейнеров
docker compose --profile production ps

# Проверить логи nginx
docker compose logs nginx

# Проверить сертификаты
docker compose run --rm certbot certificates
```

Откройте браузер и перейдите на https://rating.petanque.ru - сайт должен работать с HTTPS.

## Автоматическое обновление сертификатов

Let's Encrypt сертификаты действительны 90 дней. Для автоматического обновления:

### Вариант 1: Использование скрипта вручную

```bash
# Сделать скрипт исполняемым
chmod +x renew-certificates.sh

# Запустить обновление
./renew-certificates.sh
```

### Вариант 2: Настройка cron (рекомендуется)

Добавьте задачу в crontab для автоматической проверки и обновления сертификатов каждую неделю:

```bash
# Откройте crontab
crontab -e

# Добавьте следующую строку (проверка каждое воскресенье в 3:00)
0 3 * * 0 cd /Users/afrikanova/projects/petanque/rate-scoring && ./renew-certificates.sh >> /tmp/certbot-renew.log 2>&1
```

### Вариант 3: Автоматическое обновление через Docker

Можно использовать отдельный контейнер для автоматического обновления. Обновите docker-compose.yml:

```yaml
certbot-renew:
  image: certbot/certbot
  container_name: petanque-certbot-renew
  volumes:
    - certbot-etc:/etc/letsencrypt
    - certbot-var:/var/lib/letsencrypt
    - web-root:/var/www/html
  entrypoint: "/bin/sh -c 'trap exit TERM; while :; do certbot renew; sleep 12h & wait $${!}; done;'"
  depends_on:
    - nginx
  networks:
    - petanque-network
  profiles:
    - production
```

Затем перезапустите с профилем production:

```bash
docker compose --profile production up -d
```

## Структура файлов

```
rate-scoring/
├── docker-compose.yml              # Основная конфигурация Docker
├── nginx/
│   ├── nginx.conf                  # Главный конфигурационный файл nginx
│   ├── default.conf                # Конфигурация с SSL (используется после получения сертификата)
│   └── default.conf.initial        # Временная конфигурация (для получения сертификата)
├── init-letsencrypt.sh             # Скрипт первичной настройки SSL
├── renew-certificates.sh           # Скрипт обновления сертификатов
└── SSL-SETUP.md                    # Эта документация
```

## Тестирование (staging режим)

Если вы хотите протестировать процесс без получения настоящего сертификата (чтобы не исчерпать лимиты Let's Encrypt):

1. Откройте `init-letsencrypt.sh`
2. Измените `staging=0` на `staging=1`
3. Запустите скрипт

⚠️ **Внимание**: Staging сертификаты не будут доверенными в браузерах!

## Проверка безопасности SSL

После настройки проверьте качество SSL конфигурации:

- https://www.ssllabs.com/ssltest/analyze.html?d=rating.petanque.ru
- https://securityheaders.com/?q=rating.petanque.ru

Текущая конфигурация должна получить оценку **A** или **A+**.

## Устранение неполадок

### Ошибка: "Couldn't obtain certificate"

1. Проверьте DNS записи:

```bash
nslookup rating.petanque.ru
nslookup www.rating.petanque.ru
```

2. Убедитесь, что порты 80 и 443 открыты:

```bash
sudo netstat -tlnp | grep ':80\|:443'
```

3. Проверьте логи certbot:

```bash
docker compose logs certbot
```

### Ошибка: "nginx: [emerg] cannot load certificate"

Это нормально при первом запуске. Скрипт `init-letsencrypt.sh` создаст временный сертификат, чтобы nginx мог запуститься.

### Порты уже используются

Если порты 80 или 443 уже заняты другим процессом:

```bash
# Найти процесс, использующий порт 80
sudo lsof -i :80

# Остановить процесс или изменить docker-compose.yml
```

### Проверка статуса сертификата

```bash
# Показать информацию о сертификатах
docker compose run --rm certbot certificates

# Проверить срок действия
echo | openssl s_client -servername rating.petanque.ru -connect rating.petanque.ru:443 2>/dev/null | openssl x509 -noout -dates
```

### Принудительное обновление сертификата

Если нужно обновить сертификат до истечения срока:

```bash
docker compose run --rm certbot renew --force-renewal
docker compose --profile production exec nginx nginx -s reload
```

## Важные замечания

1. **Лимиты Let's Encrypt**:

   - 50 сертификатов на домен в неделю
   - 5 попыток для одного набора доменов в час
   - Используйте staging режим для тестирования!

2. **Резервное копирование сертификатов**:
   Сертификаты хранятся в Docker volume `certbot-etc`. Рекомендуется делать резервные копии:

   ```bash
   docker run --rm -v petanque_certbot-etc:/etc/letsencrypt -v $(pwd):/backup alpine tar czf /backup/letsencrypt-backup.tar.gz -C /etc/letsencrypt .
   ```

3. **Восстановление из резервной копии**:
   ```bash
   docker run --rm -v petanque_certbot-etc:/etc/letsencrypt -v $(pwd):/backup alpine tar xzf /backup/letsencrypt-backup.tar.gz -C /etc/letsencrypt
   ```

## Дополнительная информация

- [Let's Encrypt документация](https://letsencrypt.org/docs/)
- [Certbot документация](https://certbot.eff.org/docs/)
- [Nginx SSL Configuration Generator](https://ssl-config.mozilla.org/)

## Контакты

При возникновении проблем обращайтесь к администратору: afrikanov.andrey@gmail.com
