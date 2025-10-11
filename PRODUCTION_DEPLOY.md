# 🚀 Production Deployment - Инструкция

## Проблема была решена!

Backend теперь собирается с использованием **SWC компилятора**, который требует **< 256 MB RAM** вместо 1024 MB.

---

## ✅ Что было изменено:

1. **docker-compose.yml** - Backend использует `Dockerfile.swc`
2. **docker-compose.override.yml → docker-compose.dev.yml** - Переименован для явного использования
3. **docker-dev.sh** - Обновлен для работы с новой структурой
4. **Backend сборка** - Теперь использует SWC (быстро и мало памяти)

---

## 📋 Шаги для деплоя на production сервере:

### 1. Остановите старые контейнеры

```bash
docker-compose down
# или
docker stop $(docker ps -aq)
```

### 2. Обновите код из репозитория

```bash
git pull origin production_fixes
```

### 3. Запустите с новой конфигурацией

```bash
./docker-dev.sh prod
```

**Или** если переименовали функцию обратно в `start`:

```bash
./docker-dev.sh start
```

**Или** напрямую через docker-compose:

```bash
docker-compose -f docker-compose.yml up -d --build
```

---

## 🔍 Проверка работы:

```bash
# Проверить статус контейнеров
docker ps

# Проверить логи backend
docker logs petanque-backend

# Проверить логи всех сервисов
./docker-dev.sh logs
```

### Ожидаемый результат в логах backend:

```
> petanque-rating-backend@1.0.0 start
> node dist/server.js

🚀 Сервер запущен на порту 3001
✅ Подключение к базе данных установлено
```

---

## ⚠️ Важно!

### Файл docker-compose.dev.yml больше НЕ применяется автоматически

- **Для production**: используйте `./docker-dev.sh prod` или `docker-compose -f docker-compose.yml up -d`
- **Для development**: используйте `./docker-dev.sh dev` (применит docker-compose.dev.yml)

---

## 🆘 Если что-то пошло не так:

### Backend не запускается с ошибкой "ts-node-dev: not found":

Это значит что применился dev конфигурационный файл. Решение:

```bash
# Остановите все контейнеры
docker-compose down

# Убедитесь что нет старого override файла
ls docker-compose.override.yml
# Если есть - переименуйте его
mv docker-compose.override.yml docker-compose.dev.yml

# Запустите заново
docker-compose -f docker-compose.yml up -d --build
```

### Backend падает с ошибкой памяти при сборке:

SWC должен решить эту проблему. Но если все равно не хватает памяти:

```bash
# Добавьте swap
sudo fallocate -l 2G /swapfile
sudo chmod 600 /swapfile
sudo mkswap /swapfile
sudo swapon /swapfile

# Повторите сборку
docker-compose -f docker-compose.yml up -d --build
```

### Нужно пересобрать только backend:

```bash
docker build -f backend/Dockerfile.swc -t petanque-backend ./backend
docker-compose -f docker-compose.yml up -d backend
```

---

## 📊 Сравнение использования памяти:

| Компилятор          | Требуется RAM | Время сборки  |
| ------------------- | ------------- | ------------- |
| TypeScript (старый) | 1024+ MB      | ~60 секунд    |
| **SWC (новый)**     | **< 256 MB**  | **~5 секунд** |

---

## 🎯 Быстрые команды:

```bash
# Запуск production
./docker-dev.sh prod

# Остановка
./docker-dev.sh stop

# Перезапуск
./docker-dev.sh restart

# Логи
./docker-dev.sh logs backend

# Статус
docker ps
```

---

## 📚 Дополнительная документация:

- **backend/QUICKSTART_BUILD.md** - Быстрый старт по сборке
- **backend/BUILD_OPTIONS.md** - Все варианты сборки и настройки
- **build-backend.sh** - Скрипт для локальной сборки backend

---

✅ **Теперь приложение должно успешно собираться и запускаться на серверах с 512 MB RAM!**
