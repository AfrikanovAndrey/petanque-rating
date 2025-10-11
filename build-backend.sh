#!/bin/bash

# Скрипт для сборки backend с различными настройками
# Использование: ./build-backend.sh [swc|standard|local|local-swc]

set -e

MODE="${1:-standard}"

echo "🔨 Сборка backend в режиме: $MODE"

case $MODE in
  "standard")
    echo "📦 Стандартная сборка TypeScript (требуется ~1024 MB RAM)"
    docker build -f backend/Dockerfile -t petanque-backend:latest ./backend
    ;;
    
  "swc")
    echo "⚡ Сборка с SWC компилятором (требуется < 256 MB RAM, очень быстро!)"
    docker build -f backend/Dockerfile.swc -t petanque-backend:latest ./backend
    ;;
    
  "local")
    echo "🏠 Локальная сборка TypeScript (без Docker)"
    cd backend
    npm run build
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
    echo "  swc           - SWC компилятор (< 256 MB RAM, РЕКОМЕНДУЕТСЯ)"
    echo "  standard      - Стандартная сборка TypeScript (1024 MB RAM)"
    echo "  local         - Локальная сборка TypeScript без Docker"
    echo "  local-swc     - Локальная сборка с SWC"
    echo ""
    echo "Пример: ./build-backend.sh swc"
    exit 1
    ;;
esac

echo "✅ Сборка успешно завершена!"

