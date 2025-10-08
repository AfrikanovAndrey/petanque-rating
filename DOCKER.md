# Docker Guide для Petanque Rating System

Это руководство поможет вам быстро развернуть приложение используя Docker и Docker Compose.

## Быстрый старт

```bash
# Клонируйте репозиторий
git clone <repository-url>
cd petanque-rating

# Запустите приложение
./docker-dev.sh start
```

Приложение будет доступно по адресам:

- **Frontend**: http://localhost:3000
- **Backend API**: http://localhost:3001/api
- **Админ панель**: http://localhost:3000/admin
  - Логин: `admin`
  - Пароль: `admin123`

## Архитектура контейнеров

### Сервисы

1. **mysql** - База данных MySQL 8.0

   - Порт: 3306
   - Данные: Персистентное хранение в volume `mysql_data`
   - Инициализация: Скрипты из `mysql/init/`

2. **backend** - Node.js API сервер

   - Порт: 3001
   - Технологии: Node.js, Express, TypeScript
   - Зависимости: MySQL

3. **frontend** - React приложение

   - Порт: 3000 (через Nginx)
   - Технологии: React, TypeScript, Vite, Tailwind CSS
   - Статическая сборка с Nginx

4. **nginx** (production) - Reverse proxy
   - Порт: 80
   - Проксирует frontend и backend
   - Активируется с профилем `production`

### Структура файлов

```
petanque-rating/
├── docker-compose.yml           # Основная конфигурация
├── docker-compose.override.yml  # Настройки для разработки
├── docker-dev.sh               # Скрипт управления
├── .dockerignore               # Исключения для Docker
├── backend/
│   ├── Dockerfile              # Образ backend
│   └── .dockerignore
├── frontend/
│   ├── Dockerfile              # Образ frontend
│   ├── nginx.conf              # Конфигурация Nginx
│   └── .dockerignore
├── mysql/
│   └── init/
│       └── 01-init.sql         # Инициализация БД
└── nginx/                      # Production Nginx
    ├── nginx.conf
    └── default.conf
```

## Команды управления

### Основные команды

```bash
# Запуск всех сервисов
./docker-dev.sh start

# Остановка всех сервисов
./docker-dev.sh stop

# Перезапуск
./docker-dev.sh restart

# Проверка статуса
./docker-dev.sh status
```

### Логи и отладка

```bash
# Просмотр логов всех сервисов
./docker-dev.sh logs

# Логи конкретного сервиса
./docker-dev.sh logs backend
./docker-dev.sh logs frontend
./docker-dev.sh logs mysql

# Интерактивное подключение к контейнеру
docker exec -it petanque-backend bash
docker exec -it petanque-mysql mysql -u petanque_user -p
```

### Сборка и обновление

```bash
# Пересборка всех образов
./docker-dev.sh build

# Пересборка конкретного сервиса
docker-compose build backend
docker-compose build frontend

# Обновление и перезапуск
./docker-dev.sh build && ./docker-dev.sh restart
```

## Управление данными

### База данных

```bash
# Создание бэкапа
./docker-dev.sh backup

# Восстановление из бэкапа
./docker-dev.sh restore backups/backup_20231120_143000.sql

# Прямое подключение к MySQL
docker exec -it petanque-mysql mysql -u petanque_user -ppetanque_password petanque_rating
```

### Загруженные файлы

Файлы турниров сохраняются в директории `uploads/` и монтируются как volume.

### Очистка

```bash
# Полная очистка (удалит все данные!)
./docker-dev.sh clean

# Удаление только контейнеров (данные сохранятся)
docker-compose down

# Удаление неиспользуемых образов
docker image prune -f
```

## Production режим

### Запуск с Nginx

```bash
# Запуск в production режиме
docker-compose --profile production up -d

# Остановка production режима
docker-compose --profile production down
```

В production режиме:

- Nginx проксирует все запросы
- Применяется rate limiting
- Настроены security headers
- Приложение доступно на порту 80

### Переменные окружения

Создайте `.env` файл в корне проекта:

```env
# Database
MYSQL_ROOT_PASSWORD=secure_root_password
MYSQL_PASSWORD=secure_user_password

# Security
JWT_SECRET=your-very-secure-jwt-secret

# Admin
ADMIN_USERNAME=your_admin
ADMIN_PASSWORD=secure_admin_password
```

## Troubleshooting

### Проблемы с подключением к базе данных

```bash
# Проверьте статус MySQL
docker-compose logs mysql

# Проверьте healthcheck
docker-compose ps

# Перезапустите только MySQL
docker-compose restart mysql
```

### Проблемы с инициализацией БД

```bash
# Посмотрите логи backend
docker-compose logs backend

# Проверьте логи MySQL для инициализации
docker-compose logs mysql

# Если БД не инициализирована, пересоздайте volume:
docker-compose down -v
docker-compose up -d
```

### Порты заняты

Если порты 3000, 3001 или 3306 уже используются:

1. Остановите конфликтующие сервисы
2. Измените порты в `docker-compose.yml`
3. Обновите настройки в коде

### Проблемы с правами доступа

```bash
# Исправление прав на uploads директорию
sudo chown -R $USER:$USER uploads/

# Исправление прав на MySQL данные
sudo chown -R $USER:$USER mysql/data/
```

## Мониторинг

### Использование ресурсов

```bash
# Статистика контейнеров
docker stats

# Использование дискового пространства
docker system df
```

### Health checks

```bash
# Проверка здоровья контейнеров
docker-compose ps

# Ручная проверка API
curl http://localhost:3001/api/
curl http://localhost:3000/
```

## Кастомизация

### Изменение конфигурации Nginx

Отредактируйте `frontend/nginx.conf` для frontend Nginx или `nginx/default.conf` для production Nginx.

### Добавление переменных окружения

1. Добавьте переменные в `docker-compose.yml`
2. Обновите код для использования новых переменных
3. Пересоберите образы

### Изменение версий

Обновите теги образов в `docker-compose.yml`:

```yaml
services:
  mysql:
    image: mysql:8.2 # Новая версия MySQL
```

## Безопасность

### Production рекомендации

1. **Измените пароли по умолчанию**
2. **Используйте HTTPS** (добавьте SSL сертификаты)
3. **Настройте firewall** (ограничьте доступ к портам)
4. **Регулярно обновляйте** образы базовых контейнеров
5. **Используйте секреты** вместо переменных окружения для паролей

### Пример SSL конфигурации

```yaml
# В docker-compose.yml для production
services:
  nginx:
    ports:
      - "443:443"
    volumes:
      - ./ssl:/etc/nginx/ssl
```

Подробную документацию по настройке SSL смотрите в официальной документации Nginx.
