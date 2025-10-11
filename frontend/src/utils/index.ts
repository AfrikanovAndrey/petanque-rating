import { TournamentCategory, TournamentType } from "@/types";
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

// Утилита для объединения классов Tailwind
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// Форматирование даты
export function formatDate(dateString: string): string {
  try {
    const date = new Date(dateString);
    return date.toLocaleDateString("ru-RU", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  } catch {
    return dateString;
  }
}

export function getTornamentCategoryText(category: TournamentCategory) {
  if (category === "FEDERAL") {
    return "Рейтинговый РФП";
  } else if (category === "REGIONAL") {
    return "Региональный рейтинговый";
  }
}

export function getTournamentTypeText(type: TournamentType) {
  switch (type) {
    case "TRIPLETTE":
      return "Триплеты";
    case "DOUBLETTE_MALE":
      return "Дуплеты мужские";
    case "DOUBLETTE_FEMALE":
      return "Дуплеты женские";
    case "DOUBLETTE_MIXT":
      return "Дуплеты микст";
    case "TET-A-TET":
      return "Теты";
  }
}

// Форматирование даты для input[type="date"]
export function formatDateForInput(dateString: string): string {
  try {
    const date = new Date(dateString);
    return date.toISOString().split("T")[0];
  } catch {
    return "";
  }
}

// Форматирование времени
export function formatDateTime(dateString: string): string {
  try {
    const date = new Date(dateString);
    return date.toLocaleString("ru-RU", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return dateString;
  }
}

// Форматирование чисел с разделителями тысяч
export function formatNumber(num: number): string {
  return num.toLocaleString("ru-RU");
}

// Валидация email
export function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

// Генерация случайного ID
export function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).substr(2);
}

// Debounce функция
export function debounce<T extends (...args: any[]) => any>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: ReturnType<typeof setTimeout>;
  return (...args: Parameters<T>) => {
    clearTimeout(timeout);
    timeout = setTimeout(() => func(...args), wait);
  };
}

// Throttle функция
export function throttle<T extends (...args: any[]) => any>(
  func: T,
  limit: number
): (...args: Parameters<T>) => void {
  let inThrottle: boolean;
  return (...args: Parameters<T>) => {
    if (!inThrottle) {
      func(...args);
      inThrottle = true;
      setTimeout(() => (inThrottle = false), limit);
    }
  };
}

// Сохранение данных в localStorage
export function saveToStorage(key: string, data: any): void {
  try {
    localStorage.setItem(key, JSON.stringify(data));
  } catch (error) {
    console.error("Ошибка сохранения в localStorage:", error);
  }
}

// Загрузка данных из localStorage
export function loadFromStorage<T>(key: string): T | null {
  try {
    const item = localStorage.getItem(key);
    return item ? JSON.parse(item) : null;
  } catch (error) {
    console.error("Ошибка загрузки из localStorage:", error);
    return null;
  }
}

// Удаление данных из localStorage
export function removeFromStorage(key: string): void {
  try {
    localStorage.removeItem(key);
  } catch (error) {
    console.error("Ошибка удаления из localStorage:", error);
  }
}

// Проверка авторизации
export function isAuthenticated(): boolean {
  return !!localStorage.getItem("admin_token");
}

// Выход из системы
export function logout(): void {
  localStorage.removeItem("admin_token");
  localStorage.removeItem("current_user");
  window.location.href = "/admin/login";
}

// Копирование текста в буфер обмена
export async function copyToClipboard(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text);
      return true;
    } else {
      // Fallback для старых браузеров
      const textArea = document.createElement("textarea");
      textArea.value = text;
      textArea.style.position = "fixed";
      textArea.style.left = "-999999px";
      textArea.style.top = "-999999px";
      document.body.appendChild(textArea);
      textArea.focus();
      textArea.select();
      const result = document.execCommand("copy");
      document.body.removeChild(textArea);
      return result;
    }
  } catch (error) {
    console.error("Ошибка копирования в буфер обмена:", error);
    return false;
  }
}

// Скачивание данных в виде файла
export function downloadAsFile(
  data: string,
  filename: string,
  type: string = "text/plain"
): void {
  const blob = new Blob([data], { type });
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  window.URL.revokeObjectURL(url);
}

// Проверка поддержки функций браузером
export const browserSupport = {
  clipboard: !!(navigator.clipboard && window.isSecureContext),
  fileReader: !!window.FileReader,
  localStorage: (() => {
    try {
      const test = "__test__";
      localStorage.setItem(test, test);
      localStorage.removeItem(test);
      return true;
    } catch {
      return false;
    }
  })(),
};

// Обработка ошибок API
export function handleApiError(error: any): string {
  if (error.response?.data?.message) {
    return error.response.data.message;
  }

  if (error.response?.status === 404) {
    return "Ресурс не найден";
  }

  if (error.response?.status === 401) {
    return "Ошибка авторизации";
  }

  if (error.response?.status >= 500) {
    return "Внутренняя ошибка сервера";
  }

  if (error.code === "NETWORK_ERROR") {
    return "Ошибка сети";
  }

  return error.message || "Произошла неизвестная ошибка";
}
