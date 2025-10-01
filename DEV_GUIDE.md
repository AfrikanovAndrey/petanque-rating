# Руководство разработчика

## Быстрый старт для разработки

### Запуск в dev-режиме с hot reload

```bash
# Запустить все сервисы в dev-режиме
./docker-dev.sh dev

# Или запустить только нужный сервис
./docker-dev.sh dev-service backend   # Только backend
./docker-dev.sh dev-service frontend  # Только frontend
./docker-dev.sh dev-service mysql     # Только база данных
```

### URL адреса в dev-режиме

- **Frontend**: http://localhost:3000
- **Backend API**: http://localhost:3001/api
- **Админ панель**: http://localhost:3000/admin (admin/admin123)
- **MySQL**: localhost:3306

### Особенности dev-режима

#### Backend (Node.js + TypeScript)

- Использует `ts-node-dev` для hot reload
- Автоматически перезапускается при изменении файлов в `src/`
- TypeScript компилируется на лету
- Все dev зависимости доступны

#### Frontend (React + Vite)

- Использует Vite dev server
- Hot Module Replacement (HMR)
- Быстрая пересборка при изменениях
- CSS и TypeScript hot reload

### Структура файлов

```
├── docker-compose.yml          # Production конфигурация
├── docker-compose.override.yml # Dev override (автоматически применяется)
├── backend/
│   ├── Dockerfile              # Production образ
│   └── Dockerfile.dev          # Dev образ
└── frontend/
    ├── Dockerfile              # Production образ
    └── Dockerfile.dev          # Dev образ
```

### Команды для разработки

```bash
# Dev команды
./docker-dev.sh dev                    # Запуск всего стека в dev-режиме
./docker-dev.sh dev-service backend    # Запуск только backend
./docker-dev.sh dev-service frontend   # Запуск только frontend
./docker-dev.sh build dev              # Сборка dev образов

# Утилиты
./docker-dev.sh logs backend           # Логи backend
./docker-dev.sh logs frontend          # Логи frontend
./docker-dev.sh status                 # Статус контейнеров

# Production команды
./docker-dev.sh start                  # Запуск в production режиме
./docker-dev.sh build production       # Сборка production образов
```

### Volume Mounting

В dev-режиме исходный код монтируется в контейнеры:

#### Backend

- `./backend/src` → `/app/src`
- `./backend/package.json` → `/app/package.json`
- `./backend/tsconfig.json` → `/app/tsconfig.json`

#### Frontend

- `./frontend/src` → `/app/src`
- `./frontend/public` → `/app/public`
- Конфигурационные файлы (vite.config.ts, tailwind.config.js, etc.)

### Отладка

#### Backend логи

```bash
# Просмотр логов backend
./docker-dev.sh logs backend

# Подключение к контейнеру backend
docker exec -it petanque-backend bash
```

#### Frontend логи

```bash
# Просмотр логов frontend
./docker-dev.sh logs frontend

# Vite dev server выводит подробную информацию о HMR
```

#### База данных

```bash
# Подключение к MySQL
docker exec -it petanque-mysql mysql -u petanque_user -p

# Или через внешний клиент
mysql -h localhost -u petanque_user -p petanque_rating
```

### Порты в dev-режиме

| Сервис   | Внутренний порт | Внешний порт |
| -------- | --------------- | ------------ |
| Frontend | 5173 (Vite)     | 3000         |
| Backend  | 3001            | 3001         |
| MySQL    | 3306            | 3306         |

### Переменные окружения

Dev-режим использует следующие переменные:

```bash
# Backend
NODE_ENV=development
VITE_API_URL=http://localhost:3001/api

# Остальные переменные из docker-compose.yml
```

### Решение проблем

#### Проблема: Контейнер не видит изменения в коде

**Решение**: Убедитесь, что volume правильно монтируются:

```bash
docker inspect petanque-backend | grep -A 10 Mounts
```

#### Проблема: Frontend не подключается к backend

**Решение**: Проверьте переменную `VITE_API_URL` и статус backend:

```bash
./docker-dev.sh status
curl http://localhost:3001/api/health
```

#### Проблема: Медленная работа на macOS

**Решение**: Используется флаг `:cached` для volume, но можно попробовать `:delegated`

### Production vs Development

| Аспект        | Development       | Production          |
| ------------- | ----------------- | ------------------- |
| Dockerfile    | Dockerfile.dev    | Dockerfile          |
| Node.js режим | ts-node-dev       | Скомпилированный JS |
| Frontend      | Vite dev server   | Nginx + статика     |
| Hot reload    | ✅ Включен        | ❌ Отключен         |
| Source maps   | ✅ Включены       | ❌ Отключены        |
| Объем образа  | Больше (dev deps) | Меньше (prod only)  |
| Безопасность  | Менее строгая     | Строгая             |
