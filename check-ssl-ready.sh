#!/bin/bash

# Скрипт проверки готовности системы к получению SSL сертификата

echo "=================================================="
echo "Проверка готовности системы к SSL"
echo "=================================================="
echo ""
echo "⚠️  ВАЖНО: Эта проверка запускается на локальной машине."
echo "    Для получения реальных SSL сертификатов нужно:"
echo "    1. Загрузить код на production сервер"
echo "    2. Убедиться, что DNS указывает на сервер"
echo "    3. Запустить эту проверку на сервере"
echo "    4. Затем выполнить ./init-letsencrypt.sh"
echo ""
echo "=================================================="
echo ""

# Цветовые коды
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

check_pass=0
check_fail=0
check_warn=0

# Функции для вывода
print_success() {
    echo -e "${GREEN}✓${NC} $1"
    ((check_pass++))
}

print_fail() {
    echo -e "${RED}✗${NC} $1"
    ((check_fail++))
}

print_warn() {
    echo -e "${YELLOW}!${NC} $1"
    ((check_warn++))
}

# 1. Проверка Docker
echo "1. Проверка Docker..."
if command -v docker &> /dev/null; then
    docker_version=$(docker --version)
    print_success "Docker установлен: $docker_version"
    
    if docker ps &> /dev/null; then
        print_success "Docker daemon работает"
    else
        print_fail "Docker daemon не работает. Запустите: sudo systemctl start docker"
    fi
else
    print_fail "Docker не установлен"
fi
echo ""

# 2. Проверка Docker Compose
echo "2. Проверка Docker Compose..."
if command -v docker compose version &> /dev/null 2>&1; then
    compose_version=$(docker compose version)
    print_success "Docker Compose установлен: $compose_version"
else
    print_fail "Docker Compose не установлен"
fi
echo ""

# 3. Проверка DNS
echo "3. Проверка DNS записей..."
domains=("rating.petanque.ru" "www.rating.petanque.ru")

for domain in "${domains[@]}"; do
    if command -v dig &> /dev/null; then
        ip=$(dig +short $domain | head -n1)
        if [ -n "$ip" ]; then
            print_success "$domain -> $ip"
        else
            print_fail "$domain не разрешается в IP"
        fi
    elif command -v nslookup &> /dev/null; then
        ip=$(nslookup $domain | grep "Address:" | tail -n1 | awk '{print $2}')
        if [ -n "$ip" ]; then
            print_success "$domain -> $ip"
        else
            print_fail "$domain не разрешается в IP"
        fi
    else
        print_warn "Утилиты dig/nslookup не найдены. Установите: apt-get install dnsutils"
    fi
done
echo ""

# 4. Проверка портов
echo "4. Проверка доступности портов..."
ports=(80 443)

for port in "${ports[@]}"; do
    if command -v lsof &> /dev/null; then
        if sudo lsof -i :$port &> /dev/null; then
            process=$(sudo lsof -i :$port | grep LISTEN | awk '{print $1}' | head -n1)
            if [ "$process" == "docker-pr" ] || [ "$process" == "nginx" ]; then
                print_success "Порт $port используется Docker/Nginx (это нормально)"
            else
                print_warn "Порт $port занят процессом: $process"
            fi
        else
            print_success "Порт $port свободен"
        fi
    elif command -v netstat &> /dev/null; then
        if sudo netstat -tlnp | grep ":$port " &> /dev/null; then
            print_warn "Порт $port используется"
        else
            print_success "Порт $port свободен"
        fi
    else
        print_warn "Утилиты lsof/netstat не найдены"
    fi
done
echo ""

# 5. Проверка файлов конфигурации
echo "5. Проверка файлов конфигурации..."
required_files=(
    "docker-compose.yml"
    "nginx/nginx.conf"
    "nginx/default.conf"
    "nginx/default.conf.initial"
    "init-letsencrypt.sh"
    "renew-certificates.sh"
)

for file in "${required_files[@]}"; do
    if [ -f "$file" ]; then
        print_success "$file существует"
    else
        print_fail "$file не найден"
    fi
done
echo ""

# 6. Проверка прав на выполнение скриптов
echo "6. Проверка прав на выполнение..."
scripts=("init-letsencrypt.sh" "renew-certificates.sh" "check-ssl-ready.sh")

for script in "${scripts[@]}"; do
    if [ -f "$script" ]; then
        if [ -x "$script" ]; then
            print_success "$script исполняемый"
        else
            print_warn "$script не исполняемый. Выполните: chmod +x $script"
        fi
    fi
done
echo ""

# 7. Проверка доступа к Let's Encrypt
echo "7. Проверка доступа к Let's Encrypt..."
if command -v curl &> /dev/null; then
    if curl -s -I https://acme-v02.api.letsencrypt.org/directory 2>/dev/null | grep "200 OK" &> /dev/null; then
        print_success "Let's Encrypt API доступен"
    else
        print_warn "Let's Encrypt API недоступен или заблокирован"
        echo "  Примечание: Это нормально для локальной машины"
        echo "  Проверка реальной доступности будет на production сервере"
    fi
else
    print_warn "curl не установлен"
fi
echo ""

# 8. Проверка контейнеров Docker
echo "8. Проверка контейнеров Docker..."
if docker ps &> /dev/null; then
    services=("mysql" "backend" "frontend")
    
    for service in "${services[@]}"; do
        container_name="petanque-$service"
        if docker ps --format '{{.Names}}' | grep -q "^$container_name$"; then
            status=$(docker ps --filter "name=^$container_name$" --format "{{.Status}}")
            print_success "$service контейнер работает: $status"
        else
            print_warn "$service контейнер не запущен"
        fi
    done
else
    print_warn "Не удалось проверить контейнеры"
fi
echo ""

# Итоги
echo "=================================="
echo "Результаты проверки:"
echo "=================================="
echo -e "${GREEN}Успешно:${NC} $check_pass"
echo -e "${YELLOW}Предупреждения:${NC} $check_warn"
echo -e "${RED}Ошибки:${NC} $check_fail"
echo ""

if [ $check_fail -eq 0 ]; then
    echo -e "${GREEN}✓ Система готова к получению SSL сертификата!${NC}"
    echo ""
    echo "Следующий шаг:"
    echo "  ./init-letsencrypt.sh"
    exit 0
else
    echo -e "${RED}✗ Обнаружены критические проблемы. Исправьте их перед получением сертификата.${NC}"
    echo ""
    echo "Дополнительная информация:"
    echo "  - Прочитайте QUICK-START-SSL.md"
    echo "  - Или SSL-SETUP.md для подробностей"
    exit 1
fi

