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

# Проверка наличия Docker и Docker Compose
check_dependencies() {
    if ! command -v docker &> /dev/null; then
        error "Docker не установлен. Пожалуйста, установите Docker."
        exit 1
    fi

    if ! command -v docker-compose &> /dev/null && ! docker compose version &> /dev/null; then
        error "Docker Compose не установлен. Пожалуйста, установите Docker Compose."
        exit 1
    fi
}

# Функция для запуска приложения в production режиме
prod() {
    log "Запуск приложения в production режиме..."
    
    # Создаем директории если их нет
    mkdir -p uploads mysql/data
    
    # Информируем о сборке
    info "Backend будет собран с использованием SWC компилятора (быстро и мало памяти)"
    
    # Запускаем контейнеры без override файла (docker-compose соберет backend автоматически)
    if command -v docker-compose &> /dev/null; then
        docker-compose -f docker-compose.yml up -d --build
    else
        docker compose -f docker-compose.yml up -d --build
    fi
    
    if [ $? -ne 0 ]; then
        error "Ошибка при сборке или запуске контейнеров"
        exit 1
    fi
    
    # Ждем пока база данных запустится
    log "Ожидание запуска базы данных..."
    sleep 10
    
    # Проверяем статус
    check_status
    
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
    
    # Запускаем контейнеры с override файлом (автоматически применяется)
    if command -v docker-compose &> /dev/null; then
        docker-compose up
    else
        docker compose up
    fi
    
    log "Dev режим завершен!"
}

# Функция для запуска только определенных сервисов в dev режиме
dev_service() {
    local service=${1:-}
    
    if [ -z "$service" ]; then
        error "Укажите сервис: $0 dev-service <backend|frontend|mysql>"
        exit 1
    fi
    
    log "Запуск сервиса '$service' в dev режиме..."
    
    # Создаем директории если их нет
    mkdir -p uploads mysql/data
    
    if command -v docker-compose &> /dev/null; then
        docker-compose up "$service"
    else
        docker compose up "$service"
    fi
}

# Функция для остановки приложения
stop() {
    log "Остановка приложения..."
    
    if command -v docker-compose &> /dev/null; then
        docker-compose down
    else
        docker compose down
    fi
    
    log "Приложение остановлено!"
}

# Функция для перезапуска приложения
restart() {
    log "Перезапуск приложения..."
    stop
    sleep 2
    start
}

# Функция для сборки образов
build() {
    local mode=${1:-production}
    
    if [ "$mode" = "dev" ]; then
        log "Сборка dev образов..."
        
        if command -v docker-compose &> /dev/null; then
            docker-compose build --no-cache
        else
            docker compose build --no-cache
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

# Функция для просмотра логов
logs() {
    local service=${1:-}
    
    if [ -n "$service" ]; then
        if command -v docker-compose &> /dev/null; then
            docker-compose logs -f "$service"
        else
            docker compose logs -f "$service"
        fi
    else
        if command -v docker-compose &> /dev/null; then
            docker-compose logs -f
        else
            docker compose logs -f
        fi
    fi
}

# Функция для проверки статуса
check_status() {
    info "Статус контейнеров:"
    
    if command -v docker-compose &> /dev/null; then
        docker-compose ps
    else
        docker compose ps
    fi
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
    local backup_name="petanque_backup_$(date +%Y%m%d_%H%M%S).sql"
    
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
    echo "  start        Запуск приложения в production режиме"
    echo "  dev          Запуск приложения в dev режиме с hot reload"
    echo "  dev-service  Запуск одного сервиса в dev режиме (dev-service <service>)"
    echo "  stop         Остановка приложения"
    echo "  restart      Перезапуск приложения"
    echo ""
    echo "🔧 Утилиты:"
    echo "  build        Сборка образов (build [dev|production])"
    echo "  logs         Просмотр логов (logs [service])"
    echo "  status       Проверка статуса контейнеров"
    echo "  clean        Полная очистка (контейнеры, образы, данные)"
    echo ""
    echo "💾 Резервное копирование:"
    echo "  backup       Создание бэкапа базы данных"
    echo "  restore      Восстановление из бэкапа (restore <file>)"
    echo ""
    echo "❓ Справка:"
    echo "  help         Показать эту справку"
    echo ""
    echo "📝 Примеры для разработки:"
    echo "  $0 dev                    # Запуск всех сервисов в dev режиме"
    echo "  $0 dev-service backend    # Запуск только backend в dev режиме"
    echo "  $0 dev-service frontend   # Запуск только frontend в dev режиме"
    echo "  $0 build dev              # Сборка dev образов"
    echo "  $0 logs backend           # Просмотр логов backend"
    echo ""
    echo "📝 Примеры для production:"
    echo "  $0 start                  # Запуск в production режиме"
    echo "  $0 build production       # Сборка production образов"
    echo "  $0 restore backups/backup_20231120_143000.sql"
}

# Основная логика
main() {
    check_dependencies
    
    case "${1:-}" in
        start)
            start
            ;;
        dev)
            dev
            ;;
        dev-service)
            dev_service "$2"
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
        logs)
            logs "$2"
            ;;
        status)
            check_status
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
