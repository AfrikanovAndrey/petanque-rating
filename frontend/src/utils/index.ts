import { TournamentCategory, TournamentType } from "@/types";
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

// Реэкспорт функции для получения иконок типа турнира
export { getTournamentTypeIcons } from "./tournamentIcons";

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

// Форматирование даты для input[type="date"] (YYYY-MM-DD)
export function formatDateForInput(dateString: string): string {
  try {
    const date = new Date(dateString);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
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
    case "TET_A_TET_MALE":
      return "Тет-а-тет мужской";
    case "TET_A_TET_FEMALE":
      return "Тет-а-тет женский";
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
