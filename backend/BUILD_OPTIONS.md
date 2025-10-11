# Варианты сборки Backend для серверов с ограниченной памятью

## 📊 Доступные варианты сборки

### Вариант 1: SWC компилятор (требуется < 256 MB RAM) ⚡ РЕКОМЕНДУЕТСЯ

**Самый быстрый и легкий вариант!** SWC написан на Rust и работает в 20 раз быстрее TypeScript.

**Dockerfile:** `Dockerfile.swc`  
**Лимит памяти:** < 256 MB  
**Особенности:**

- Очень быстрая компиляция (секунды вместо минут)
- Минимальное использование памяти
- Отлично подходит для ограниченных серверов
- Полная совместимость с TypeScript

**Команды:**

```bash
# Локальная сборка
npm run build:swc

# Docker сборка
docker build -f Dockerfile.swc -t petanque-backend .

# Или через скрипт
./build-backend.sh swc
```

---

### Вариант 2: Стандартная сборка TypeScript (требуется ~1024 MB RAM)

Официальный TypeScript компилятор с полной проверкой типов.

**Dockerfile:** `Dockerfile`  
**Лимит памяти:** 1024 MB  
**Особенности:**

- Отключены declaration maps
- Отключены source maps
- Включена инкрементальная компиляция
- Исключены тесты из компиляции

**Команды:**

```bash
# Локальная сборка
npm run build

# Docker сборка
docker build -f Dockerfile -t petanque-backend .
```

---

## 🔧 Дополнительные оптимизации

### Если сборка все еще падает с ошибкой памяти:

#### 1. Увеличьте лимит памяти в `package.json`:

```json
"build": "node --max-old-space-size=1024 ./node_modules/.bin/tsc -p tsconfig.prod.json"
```

#### 2. Добавьте swap на сервере:

```bash
# Создание 2GB swap файла
sudo fallocate -l 2G /swapfile
sudo chmod 600 /swapfile
sudo mkswap /swapfile
sudo swapon /swapfile

# Проверка
sudo swapon --show
```

#### 3. Ограничьте количество параллельных процессов Docker:

```bash
# Сборка с одним процессом
docker build --memory="1g" --cpus="1" -f Dockerfile .
```

#### 4. Используйте pre-compiled код:

Скомпилируйте код на машине разработки и скопируйте только `dist/` папку на сервер.

---

## 📝 Конфигурационные файлы

- **`tsconfig.json`** - Основная конфигурация для разработки
- **`tsconfig.prod.json`** - Оптимизированная конфигурация для production
- **`Dockerfile`** - Стандартный production build (TypeScript)
- **`Dockerfile.swc`** - Production build с SWC компилятором (рекомендуется)
- **`Dockerfile.dev`** - Для разработки с hot reload
- **`.swcrc`** - Конфигурация SWC компилятора

---

## 🐛 Отладка проблем с памятью

### Проверка использования памяти во время сборки:

```bash
# Мониторинг в реальном времени
watch -n 1 'free -m'

# Логи Docker
docker stats

# Детальная информация о сборке
docker build --progress=plain --no-cache -f Dockerfile .
```

### Типичные ошибки:

- **"JavaScript heap out of memory"** - недостаточно памяти для компиляции
  - Решение: Использовать `Dockerfile.swc` (SWC компилятор) или увеличить `--max-old-space-size`
- **"Killed"** - процесс убит OOM killer
  - Решение: Добавить swap или увеличить RAM

---

## 🚀 Рекомендации по deployment

1. **Для любых серверов (РЕКОМЕНДУЕТСЯ)**: Используйте `Dockerfile.swc` - быстро и мало памяти!
2. **Для VPS с 512MB+ RAM**: `Dockerfile.swc` (SWC компилятор) - идеальный выбор
3. **Для VPS с 1GB+ RAM**: Можете использовать `Dockerfile` (TypeScript) или `Dockerfile.swc`
4. **Для shared hosting**: Скомпилируйте локально с `npm run build:swc`, загрузите только `dist/`
5. **Для облачных провайдеров**: `Dockerfile.swc` - быстрая сборка в CI/CD

---

## 📚 Дополнительная информация

- TypeScript Compiler Options: https://www.typescriptlang.org/tsconfig
- Node.js Memory Management: https://nodejs.org/en/docs/guides/simple-profiling/
- Docker Build Optimization: https://docs.docker.com/build/building/best-practices/
