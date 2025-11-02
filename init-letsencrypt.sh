#!/bin/bash

# Скрипт для первичной настройки SSL сертификатов Let's Encrypt
# Для сайта rating.petanque.ru

set -e

domains=(rating.petanque.ru www.rating.petanque.ru)
email="afrikanov.andrey@gmail.com"
staging=0 # Установите в 1 для тестирования с staging сервером Let's Encrypt

echo "### Подготовка директорий для certbot..."
mkdir -p "./certbot/www"
mkdir -p "./certbot/conf"

echo ""
echo "### Создание dummy сертификата для $domains..."
path="/etc/letsencrypt/live/$domains"
mkdir -p "./certbot/conf/live/$domains"
docker compose run --rm --entrypoint "\
  openssl req -x509 -nodes -newkey rsa:4096 -days 1\
    -keyout '$path/privkey.pem' \
    -out '$path/fullchain.pem' \
    -subj '/CN=localhost'" certbot

echo ""
echo "### Использование временной конфигурации nginx..."
cp nginx/default.conf nginx/default.conf.backup
cp nginx/default.conf.initial nginx/default.conf

echo ""
echo "### Запуск nginx с production профилем..."
docker compose --profile production up -d nginx

echo ""
echo "### Удаление dummy сертификата для $domains..."
docker compose run --rm --entrypoint "\
  rm -rf /etc/letsencrypt/live/$domains && \
  rm -rf /etc/letsencrypt/archive/$domains && \
  rm -rf /etc/letsencrypt/renewal/$domains.conf" certbot

echo ""
echo "### Запрос настоящего сертификата Let's Encrypt для $domains..."
domain_args=""
for domain in "${domains[@]}"; do
  domain_args="$domain_args -d $domain"
done

# Выбор тестового или реального сервера Let's Encrypt
case "$staging" in
  1) staging_arg="--staging" ;;
  *) staging_arg="" ;;
esac

docker compose run --rm certbot certonly --webroot \
  -w /var/www/html \
  $staging_arg \
  $domain_args \
  --email $email \
  --rsa-key-size 4096 \
  --agree-tos \
  --no-eff-email \
  --force-renewal

echo ""
echo "### Восстановление полной конфигурации nginx с SSL..."
cp nginx/default.conf.backup nginx/default.conf

echo ""
echo "### Перезагрузка nginx..."
docker compose --profile production exec nginx nginx -s reload

echo ""
echo "### Настройка завершена! Ваш сайт теперь работает с HTTPS."
echo "### Проверьте сертификат на: https://www.ssllabs.com/ssltest/analyze.html?d=$domains"

