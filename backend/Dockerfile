# Используем официальный образ Node.js LTS
FROM node:18-alpine AS builder

# Устанавливаем рабочую директорию
WORKDIR /app

# Копируем package.json и package-lock.json
COPY package*.json ./

# Устанавливаем все зависимости (включая dev для сборки)
RUN npm ci && npm cache clean --force

# Копируем исходный код
COPY . .

# Компилируем TypeScript
RUN npm run build

# Production stage
FROM node:18-alpine AS production

# Устанавливаем рабочую директорию
WORKDIR /app

# Копируем package.json и package-lock.json
COPY package*.json ./

# Устанавливаем только production зависимости
RUN npm ci --only=production && npm cache clean --force

# Копируем скомпилированный код из builder stage
COPY --from=builder /app/dist ./dist

# Копируем исходники для миграций (нужны для ts-node)
COPY --from=builder /app/src ./src
COPY --from=builder /app/tsconfig.json ./tsconfig.json

# Создаем пользователя для безопасности
RUN addgroup -g 1001 -S nodejs
RUN adduser -S nodejs -u 1001

RUN apk add --no-cache su-exec \
    && mkdir -p /app/uploads/clubs \
    && chown -R nodejs:nodejs /app /app/uploads

COPY docker-entrypoint.sh /app/docker-entrypoint.sh
RUN chmod +x /app/docker-entrypoint.sh

EXPOSE 3001

ENTRYPOINT ["/app/docker-entrypoint.sh"]
CMD ["npm", "start"]
