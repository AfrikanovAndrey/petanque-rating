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

# Функция для запуска приложения
start() {
    log "Запуск приложения..."
    
    # Создаем директории если их нет
    mkdir -p uploads mysql/data
    
    # Запускаем контейнеры
    if command -v docker-compose &> /dev/null; then
        docker-compose up -d
    else
        docker compose up -d
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
    log "Сборка образов..."
    
    if command -v docker-compose &> /dev/null; then
        docker-compose build --no-cache
    else
        docker compose build --no-cache
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
    echo "Команды:"
    echo "  start     Запуск приложения"
    echo "  stop      Остановка приложения"
    echo "  restart   Перезапуск приложения"
    echo "  build     Сборка образов"
    echo "  logs      Просмотр логов (опционально: logs <service>)"
    echo "  status    Проверка статуса контейнеров"
    echo "  clean     Полная очистка (контейнеры, образы, данные)"
    echo "  backup    Создание бэкапа базы данных"
    echo "  restore   Восстановление из бэкапа (restore <file>)"
    echo "  help      Показать эту справку"
    echo ""
    echo "Примеры:"
    echo "  $0 start"
    echo "  $0 logs backend"
    echo "  $0 restore backups/backup_20231120_143000.sql"
}

# Основная логика
main() {
    check_dependencies
    
    case "${1:-}" in
        start)
            start
            ;;
        stop)
            stop
            ;;
        restart)
            restart
            ;;
        build)
            build
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
