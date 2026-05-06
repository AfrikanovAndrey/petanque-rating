import {
  TournamentCategory,
  TournamentStatus,
  TournamentType,
  UserRole,
} from "../types";
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

export function getTournamentStatusText(
  status: TournamentStatus | string | undefined
): string {
  const key = status ?? TournamentStatus.FINISHED;
  switch (key) {
    case TournamentStatus.DRAFT:
      return "Черновик";
    case TournamentStatus.REGISTRATION:
      return "Регистрация";
    case TournamentStatus.IN_PROGRESS:
      return "В процессе";
    case TournamentStatus.FINISHED:
    default:
      return "Завершён";
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

/** Возвращает нормализованный список ролей пользователя. */
export function getUserRoles(input: {
  role?: UserRole;
  roles?: UserRole[];
} | UserRole | null | undefined): UserRole[] {
  if (!input) return [];
  if (typeof input === "string") return [input];
  const fromArray = input.roles && input.roles.length > 0 ? input.roles : [];
  const merged = fromArray.length > 0 ? fromArray : input.role ? [input.role] : [];
  return [...new Set(merged)];
}

/** Проверка наличия хотя бы одной роли у пользователя. */
export function hasAnyUserRole(
  user: { role?: UserRole; roles?: UserRole[] } | null | undefined,
  allowedRoles: UserRole[]
): boolean {
  const roles = getUserRoles(user);
  return allowedRoles.some((role) => roles.includes(role));
}

/** Стартовая страница админки после входа в зависимости от роли(ей) */
export function getAdminHomePath(roleOrRoles: UserRole | UserRole[]): string {
  const roles = Array.isArray(roleOrRoles) ? roleOrRoles : [roleOrRoles];
  if (roles.includes(UserRole.ADMIN)) return "/admin/dashboard";
  if (roles.includes(UserRole.MANAGER)) return "/admin/tournaments";
  if (roles.includes(UserRole.LICENSE_MANAGER)) return "/admin/players";
  if (roles.includes(UserRole.PRESIDIUM_MEMBER)) return "/admin/tournaments";
  return "/admin/tournaments";
}

export function getUserRoleLabel(role: UserRole): string {
  switch (role) {
    case UserRole.ADMIN:
      return "Администратор";
    case UserRole.MANAGER:
      return "Организатор турнира";
    case UserRole.LICENSE_MANAGER:
      return "Менеджер лицензий";
    case UserRole.PRESIDIUM_MEMBER:
      return "Член президиума";
    default:
      return String(role);
  }
}

export function getUserRolesLabel(roles: UserRole[]): string {
  if (roles.length === 0) return "—";
  return roles.map((role) => getUserRoleLabel(role)).join(", ");
}

// Выход из системы
export function logout(): void {
  localStorage.removeItem("admin_token");
  localStorage.removeItem("current_user");
  window.location.href = "/admin/login";
}

/** Текст регламента для UI: пусто и служебные артефакты сборки не показываем как регламент. */
export function regulationsForDisplay(raw: string | null | undefined): string {
  const s = raw?.trim();
  if (!s) return "— не указан —";
  if (/\[vite\]|Internal server error|Failed to resolve import/i.test(s)) {
    return "— не указан —";
  }
  return s;
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
