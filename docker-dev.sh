#!/bin/bash

# Цвета для вывода
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Функция для логирования
log() {
    echo -e "${GREEN}[$(date +'%Y-%m-%d %H:%M:%S')] $1${NC}"
}

warn() {
    echo -e "${YELLOW}[$(date +'%Y-%m-%d %H:%M:%S')] WARNING: $1${NC}"
}

error() {
    echo -e "${RED}[$(date +'%Y-%m-%d %H:%M:%S')] ERROR: $1${NC}"
}

info() {
    echo -e "${BLUE}[$(date +'%Y-%m-%d %H:%M:%S')] INFO: $1${NC}"
}

# Функция для запуска приложения в production режиме
prod() {
    log "Запуск приложения в production режиме..."
    
    # Создаем директории если их нет
    mkdir -p uploads mysql/data

    # Остановка production режима
    docker-compose --profile production down

    # Пересборка и запуск production режима
    docker-compose --profile production up -d --build

    if [ $? -ne 0 ]; then
        error "Ошибка при сборке или запуске контейнеров"
        exit 1
    fi
    
    # Ждем пока база данных запустится
    log "Ожидание запуска базы данных..."
    sleep 10
    
    log "Приложение запущено!"
    info "Frontend: http://localhost:3000"
    info "Backend API: http://localhost:3001/api"
    info "Админ панель: http://localhost:3000/admin (admin/admin123)"
}

# Функция для запуска приложения в dev режиме с hot reload
dev() {
    log "Запуск приложения в dev режиме с hot reload..."
    
    # Создаем директории если их нет
    mkdir -p uploads mysql/data
    
    # Запускаем контейнеры с dev файлом для hot reload
    if command -v docker-compose &> /dev/null; then
        docker-compose -f docker-compose.yml -f docker-compose.dev.yml up
    else
        docker compose -f docker-compose.yml -f docker-compose.dev.yml up
    fi
    
    log "Dev режим завершен!"
}

# Функция для остановки приложения
stop() {
    log "Остановка приложения..."
    
    # Останавливаем контейнеры (работает для любого режима)
    if command -v docker-compose &> /dev/null; then
        docker-compose -f docker-compose.yml -f docker-compose.dev.yml down 2>/dev/null || docker-compose -f docker-compose.yml down
    else
        docker compose -f docker-compose.yml -f docker-compose.dev.yml down 2>/dev/null || docker compose -f docker-compose.yml down
    fi
    
    log "Приложение остановлено!"
}

# Функция для перезапуска приложения
restart() {
    log "Перезапуск приложения..."
    stop
    sleep 2
    prod
}

# Функция для сборки образов
build() {
    local mode=${1:-production}
    
    if [ "$mode" = "dev" ]; then
        log "Сборка dev образов..."
        
        if command -v docker-compose &> /dev/null; then
            docker-compose -f docker-compose.yml -f docker-compose.dev.yml build --no-cache
        else
            docker compose -f docker-compose.yml -f docker-compose.dev.yml build --no-cache
        fi
    else
        log "Сборка production образов..."
        info "Backend будет собран с использованием SWC компилятора (быстро и мало памяти)"
        
        if command -v docker-compose &> /dev/null; then
            docker-compose -f docker-compose.yml build --no-cache
        else
            docker compose -f docker-compose.yml build --no-cache
        fi
    fi
    
    log "Образы собраны!"
}

# Функция для очистки
clean() {
    warn "Это удалит все контейнеры, образы и данные!"
    read -p "Вы уверены? (y/N): " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        log "Очистка..."
        
        # Останавливаем и удаляем контейнеры
        if command -v docker-compose &> /dev/null; then
            docker-compose down -v --rmi all
        else
            docker compose down -v --rmi all
        fi
        
        # Удаляем данные
        sudo rm -rf mysql/data uploads/*
        
        log "Очистка завершена!"
    else
        info "Очистка отменена."
    fi
}

# Функция для создания бэкапа базы данных
backup() {
    local backup_name="petanque_rating_dump.sql"
    
    log "Создание бэкапа базы данных: $backup_name"
    
    docker exec petanque-mysql mysqldump -u petanque_user -ppetanque_password petanque_rating > "backups/$backup_name"
    
    if [ $? -eq 0 ]; then
        log "Бэкап создан: backups/$backup_name"
    else
        error "Ошибка создания бэкапа!"
    fi
}

# Функция для восстановления из бэкапа
restore() {
    local backup_file=$1
    
    if [ -z "$backup_file" ]; then
        error "Укажите файл бэкапа: $0 restore <backup_file>"
        exit 1
    fi
    
    if [ ! -f "$backup_file" ]; then
        error "Файл бэкапа не найден: $backup_file"
        exit 1
    fi
    
    warn "Это заменит текущую базу данных!"
    read -p "Вы уверены? (y/N): " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        log "Восстановление из бэкапа: $backup_file"
        
        docker exec -i petanque-mysql mysql -u petanque_user -ppetanque_password petanque_rating < "$backup_file"
        
        if [ $? -eq 0 ]; then
            log "Бэкап восстановлен!"
        else
            error "Ошибка восстановления бэкапа!"
        fi
    else
        info "Восстановление отменено."
    fi
}

# Функция помощи
help() {
    echo "Использование: $0 <команда> [опции]"
    echo ""
    echo "🚀 Основные команды:"
    echo "  prod         Запуск приложения в production режиме"
    echo "  dev          Запуск приложения в dev режиме с hot reload"
    echo "  stop         Остановка приложения"
    echo "  restart      Перезапуск приложения в production режиме"
    echo ""
    echo "🔧 Утилиты:"
    echo "  build        Сборка образов (build [dev|production])"
    echo "  clean        Полная очистка (контейнеры, образы, данные)"
    echo ""
    echo "💾 Резервное копирование:"
    echo "  backup       Создание бэкапа базы данных"
    echo "  restore      Восстановление из бэкапа (restore <file>)"
    echo ""
    echo "❓ Справка:"
    echo "  help         Показать эту справку"
    echo ""
    echo "📝 Примеры:"
    echo "  $0 dev                                      # Запуск в dev режиме"
    echo "  $0 prod                                     # Запуск в production режиме"
    echo "  $0 build dev                                # Сборка dev образов"
    echo "  $0 build production                         # Сборка production образов"
    echo "  $0 backup                                   # Создать бэкап базы данных"
    echo "  $0 restore backups/petanque_rating_dump.sql # Восстановить из бэкапа"
}

# Основная логика
main() {    
    case "${1:-}" in
        prod)
            prod
            ;;
        dev)
            dev
            ;;
        stop)
            stop
            ;;
        restart)
            restart
            ;;
        build)
            build "$2"
            ;;
        clean)
            clean
            ;;
        backup)
            mkdir -p backups
            backup
            ;;
        restore)
            restore "$2"
            ;;
        help|--help|-h)
            help
            ;;
        *)
            error "Неизвестная команда: ${1:-}"
            echo ""
            help
            exit 1
            ;;
    esac
}

# Запуск скрипта
main "$@"
