#!/bin/sh
set -e

# Bind-mount ./uploads с хоста перекрывает каталог из образа и часто
# принадлежит root, а процесс работает от nodejs (uid 1001).
mkdir -p /app/uploads/clubs
chown -R nodejs:nodejs /app/uploads

exec su-exec nodejs "$@"
