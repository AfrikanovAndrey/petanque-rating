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
#RUN npm run build
RUN node --max-old-space-size=500 ./node_modules/.bin/tsc

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

# Создаем директорию для загрузок и назначаем права
RUN mkdir -p /app/uploads && chown -R nodejs:nodejs /app/uploads
RUN chown -R nodejs:nodejs /app

# Переключаемся на пользователя nodejs
USER nodejs

# Открываем порт
EXPOSE 3001

# Команда запуска
CMD ["npm", "start"]
