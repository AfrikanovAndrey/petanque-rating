#!/bin/bash

# Скрипт для обновления SSL сертификатов Let's Encrypt
# Можно добавить в cron для автоматического обновления

set -e

echo "### Проверка и обновление сертификатов..."
docker compose run --rm certbot renew

echo ""
echo "### Перезагрузка nginx..."
docker compose --profile production exec nginx nginx -s reload

echo ""
echo "### Обновление сертификатов завершено!"

