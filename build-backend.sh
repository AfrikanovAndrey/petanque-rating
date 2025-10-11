#!/bin/bash

# Скрипт для сборки backend с различными настройками памяти
# Использование: ./build-backend.sh [standard|lowmem|local]

set -e

MODE="${1:-standard}"

echo "🔨 Сборка backend в режиме: $MODE"

case $MODE in
  "standard")
    echo "📦 Стандартная сборка (требуется ~1024 MB RAM)"
    docker build -f backend/Dockerfile -t petanque-backend:latest ./backend
    ;;
    
  "lowmem")
    echo "💾 Сборка с минимальной памятью (требуется ~384 MB RAM)"
    docker build -f backend/Dockerfile.lowmem -t petanque-backend:latest ./backend
    ;;
    
  "swc")
    echo "⚡ Сборка с SWC компилятором (требуется < 256 MB RAM, очень быстро!)"
    docker build -f backend/Dockerfile.swc -t petanque-backend:latest ./backend
    ;;
    
  "local")
    echo "🏠 Локальная сборка (без Docker)"
    cd backend
    npm run build
    echo "✅ Сборка завершена! Скомпилированные файлы в backend/dist/"
    ;;
    
  "local-lowmem")
    echo "🏠 Локальная сборка с минимальной памятью"
    cd backend
    npm run build:low-memory
    echo "✅ Сборка завершена! Скомпилированные файлы в backend/dist/"
    ;;
    
  "local-swc")
    echo "⚡ Локальная сборка с SWC (быстро и мало памяти)"
    cd backend
    npm install
    npm run build:swc
    echo "✅ Сборка завершена! Скомпилированные файлы в backend/dist/"
    ;;
    
  *)
    echo "❌ Неизвестный режим: $MODE"
    echo ""
    echo "Доступные режимы:"
    echo "  standard      - Стандартная сборка TypeScript (1024 MB RAM)"
    echo "  lowmem        - TypeScript с минимальной памятью (384 MB RAM)"
    echo "  swc           - SWC компилятор (< 256 MB RAM, РЕКОМЕНДУЕТСЯ)"
    echo "  local         - Локальная сборка без Docker"
    echo "  local-lowmem  - Локальная сборка с ограничением памяти"
    echo "  local-swc     - Локальная сборка с SWC"
    echo ""
    echo "Пример: ./build-backend.sh swc"
    exit 1
    ;;
esac

echo "✅ Сборка успешно завершена!"

