# Развёртывание на Production сервер

## 📍 Текущая ситуация

Вы находитесь на **локальной машине разработки**. Для получения SSL сертификатов нужно развернуть приложение на **production сервере** с публичным IP адресом.

## 🎯 Пошаговый план

### Шаг 1: Подготовка сервера

#### Требования к серверу:
- Ubuntu/Debian Linux (рекомендуется Ubuntu 22.04 LTS)
- Минимум 2GB RAM
- Минимум 20GB диска
- Публичный IP адрес
- SSH доступ

#### Провайдеры (примеры):
- **DigitalOcean** - от $6/месяц
- **Hetzner** - от €4.5/месяц
- **AWS/Azure/GCP** - различные варианты
- **VDSina.ru** - от 300₽/месяц
- **Timeweb** - от 300₽/месяц

### Шаг 2: Настройка DNS

Добавьте DNS записи для вашего домена:

```
Тип: A
Имя: rating.petanque.ru
Значение: [IP адрес вашего сервера]
TTL: 300

Тип: A
Имя: www.rating.petanque.ru
Значение: [IP адрес вашего сервера]
TTL: 300
```

**Важно:** DNS распространение может занять до 24 часов, но обычно происходит за 5-15 минут.

**Проверка DNS** (с локальной машины):
```bash
nslookup rating.petanque.ru
# Должен вернуть IP вашего сервера
```

### Шаг 3: Подключение к серверу

```bash
# SSH подключение
ssh root@[IP-адрес-сервера]

# Или с использованием ключа
ssh -i ~/.ssh/your_key root@[IP-адрес-сервера]
```

### Шаг 4: Установка необходимого ПО на сервере

```bash
# Обновление системы
sudo apt update && sudo apt upgrade -y

# Установка Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh

# Проверка установки
docker --version
docker compose version

# Установка дополнительных утилит
sudo apt install -y git curl wget htop
```

### Шаг 5: Загрузка кода на сервер

#### Вариант A: Через Git (рекомендуется)

```bash
# На сервере
cd /opt
git clone [URL-вашего-репозитория] petanque
cd petanque

# Если репозиторий приватный
git clone https://username:token@github.com/username/repo.git petanque
```

#### Вариант B: Через SCP (с локальной машины)

```bash
# На локальной машине (из директории проекта)
cd /Users/afrikanova/projects/petanque/rate-scoring
tar czf petanque.tar.gz .

# Копирование на сервер
scp petanque.tar.gz root@[IP-сервера]:/opt/

# На сервере
ssh root@[IP-сервера]
cd /opt
tar xzf petanque.tar.gz -C petanque
cd petanque
```

### Шаг 6: Настройка переменных окружения

```bash
# На сервере в директории проекта
cd /opt/petanque

# Создание .env файла (опционально)
cat > .env << 'EOF'
# MySQL
MYSQL_ROOT_PASSWORD=$(openssl rand -base64 24)
MYSQL_PASSWORD=$(openssl rand -base64 24)

# Backend
JWT_SECRET=$(openssl rand -base64 48)
ADMIN_USERNAME=admin
ADMIN_PASSWORD=ваш-надёжный-пароль

# Let's Encrypt
LETSENCRYPT_EMAIL=afrikanov.andrey@gmail.com
DOMAIN=rating.petanque.ru
EOF

# Или отредактируйте docker-compose.yml напрямую
nano docker-compose.yml
```

**⚠️ ВАЖНО:** Сохраните все пароли в надёжном месте!

### Шаг 7: Настройка файрволла

```bash
# Настройка UFW (Ubuntu Firewall)
sudo ufw allow 22/tcp    # SSH
sudo ufw allow 80/tcp    # HTTP
sudo ufw allow 443/tcp   # HTTPS
sudo ufw enable

# Проверка
sudo ufw status
```

### Шаг 8: Запуск базовых сервисов

```bash
cd /opt/petanque

# Сделать скрипты исполняемыми
chmod +x *.sh

# Запуск MySQL, Backend, Frontend
docker compose up -d mysql backend frontend

# Проверка логов
docker compose logs -f backend

# Дождитесь сообщения "Server is running on port 3001"
# Ctrl+C для выхода из логов
```

### Шаг 9: Проверка готовности к SSL

```bash
# На сервере
./check-ssl-ready.sh
```

Все проверки должны пройти успешно (особенно DNS).

### Шаг 10: Получение SSL сертификата

```bash
# На сервере
./init-letsencrypt.sh

# Это займёт 2-3 минуты
```

Скрипт автоматически:
1. Создаст временный сертификат
2. Запустит nginx
3. Получит настоящий сертификат от Let's Encrypt
4. Переключит nginx на HTTPS

### Шаг 11: Проверка результата

```bash
# На сервере
docker compose --profile production ps

# Проверка сертификата
docker compose run --rm certbot certificates
```

**В браузере:**
- Откройте https://rating.petanque.ru
- Должен отображаться замок 🔒 в адресной строке
- HTTP должен перенаправляться на HTTPS

### Шаг 12: Настройка автообновления сертификатов

#### Вариант A: Через Docker (рекомендуется)

```bash
# Перезапуск с production конфигурацией
docker compose -f docker-compose.yml -f docker-compose.prod.yml --profile production down
docker compose -f docker-compose.yml -f docker-compose.prod.yml --profile production up -d
```

#### Вариант B: Через cron

```bash
# Добавление задачи в cron
crontab -e

# Добавьте строку:
0 3 * * 0 cd /opt/petanque && ./renew-certificates.sh >> /var/log/certbot-renew.log 2>&1
```

## ✅ Проверочный список

После развёртывания проверьте:

- [ ] Сайт открывается по https://rating.petanque.ru
- [ ] HTTP перенаправляется на HTTPS
- [ ] Сертификат валидный (зелёный замок)
- [ ] Админка работает (https://rating.petanque.ru/admin)
- [ ] API отвечает: `curl https://rating.petanque.ru/api/rating/table`
- [ ] Все контейнеры запущены: `docker compose --profile production ps`
- [ ] Автообновление сертификатов настроено

## 🔧 Полезные команды на сервере

```bash
# Просмотр логов
docker compose logs -f

# Статус контейнеров
docker compose --profile production ps

# Перезапуск
docker compose --profile production restart

# Обновление кода (если используете git)
git pull
docker compose --profile production build
docker compose --profile production up -d

# Бэкап базы данных
docker compose exec mysql mysqldump -u root -p petanque_rating > backup-$(date +%Y%m%d).sql
```

## 🚨 Что делать, если что-то пошло не так

### DNS не разрешается
```bash
# Проверка DNS
nslookup rating.petanque.ru

# Подождите 15-30 минут и попробуйте снова
# DNS распространение требует времени
```

### Порты недоступны
```bash
# Проверка файрволла
sudo ufw status

# Открытие портов
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
```

### Ошибка получения сертификата
```bash
# Проверьте логи
docker compose logs certbot

# Проверьте, что nginx работает
docker compose ps nginx

# Проверьте доступность порта 80 извне
curl -I http://rating.petanque.ru
```

### Контейнер не запускается
```bash
# Смотрите логи
docker compose logs [имя-сервиса]

# Пересоздайте контейнер
docker compose up -d --force-recreate [имя-сервиса]
```

## 📚 Дополнительная информация

После успешного развёртывания смотрите:
- [DEPLOYMENT-CHECKLIST.md](DEPLOYMENT-CHECKLIST.md) - полный чек-лист
- [SSL-COMMANDS.md](SSL-COMMANDS.md) - шпаргалка команд
- [SSL-SETUP.md](SSL-SETUP.md) - подробная документация

## 🎉 Готово!

Теперь ваш сайт:
- ✅ Работает на production сервере
- ✅ Защищён SSL/HTTPS
- ✅ Доступен по адресу rating.petanque.ru
- ✅ Автоматически обновляет сертификаты

## 📝 На локальной машине

На локальной машине разработки (где вы сейчас):
1. Продолжайте разработку
2. Тестируйте изменения локально
3. Коммитьте в git
4. На сервере делайте `git pull` для обновления

**Для локальной разработки SSL не нужен!** Используйте:
```bash
# На локальной машине
docker compose up -d mysql backend frontend
# Доступ: http://localhost:3000
```

---

**Вопросы?** Пишите: afrikanov.andrey@gmail.com

