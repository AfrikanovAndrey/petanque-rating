# 🚀 Быстрый старт: Сборка Backend

## Проблема: TypeScript падает с ошибкой памяти?

Используйте **SWC компилятор** - он в 20 раз быстрее и требует в 4 раза меньше памяти!

## ⚡ Рекомендуемый способ (SWC)

### На production сервере:

```bash
# 1. Установите зависимости (если еще не установлены)
cd backend
npm install

# 2. Соберите с помощью SWC
npm run build:swc

# 3. Запустите
npm start
```

### Или через Docker:

```bash
# Из корня проекта
docker build -f backend/Dockerfile.swc -t petanque-backend ./backend

# Или используя удобный скрипт
./build-backend.sh swc
```

## 📊 Сравнение вариантов

| Метод            | Память   | Скорость            | Рекомендация                     |
| ---------------- | -------- | ------------------- | -------------------------------- |
| **SWC**          | < 256 MB | ⚡⚡⚡ Очень быстро | ✅ **ЛУЧШИЙ ВЫБОР**              |
| TypeScript (1GB) | 1024 MB  | 🐌 Медленно         | Если нужна полная проверка типов |

## 🔧 Все доступные команды

```bash
# SWC компилятор (рекомендуется, < 256 MB RAM)
npm run build:swc

# TypeScript компилятор (1024 MB RAM)
npm run build
```

## 🐳 Docker варианты

```bash
# SWC компилятор (рекомендуется, < 256 MB)
docker build -f backend/Dockerfile.swc -t petanque-backend ./backend

# TypeScript компилятор (1024 MB)
docker build -f backend/Dockerfile -t petanque-backend ./backend
```

## 🆘 Если все еще не работает

### 1. Добавьте swap на сервере:

```bash
sudo fallocate -l 2G /swapfile
sudo chmod 600 /swapfile
sudo mkswap /swapfile
sudo swapon /swapfile
```

### 2. Соберите локально и скопируйте:

```bash
# На локальной машине
cd backend
npm install
npm run build:swc

# Скопируйте папку dist/ на сервер
scp -r dist/ user@your-server:/path/to/backend/
```

## 📚 Подробная документация

Смотрите [BUILD_OPTIONS.md](./BUILD_OPTIONS.md) для всех опций и настроек.

## ✅ Почему SWC?

- ✨ **Написан на Rust** - очень быстрый и эффективный
- 💾 **Минимальное использование памяти** - работает даже на 256 MB RAM
- ⚡ **В 20 раз быстрее** TypeScript компилятора
- 🔄 **Полная совместимость** с TypeScript синтаксисом
- 🎯 **Используется в Next.js** и других крупных проектах
