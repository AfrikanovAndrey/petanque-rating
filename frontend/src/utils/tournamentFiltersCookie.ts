import {
  Tournament,
  TournamentCategory,
  TournamentStatus,
  TournamentType,
} from "../types";
import { canUsePreferenceCookies } from "./cookieConsent";
import {
  ADMIN_TOURNAMENT_FILTERS_COOKIE_NAME,
  TOURNAMENT_FILTERS_COOKIE_NAME,
} from "./cookieNames";
import { clearCookie, getCookie, setCookie } from "./cookieStorage";

const PUBLIC_FILTERS_COOKIE_NAME = TOURNAMENT_FILTERS_COOKIE_NAME;
const ADMIN_FILTERS_COOKIE_NAME = ADMIN_TOURNAMENT_FILTERS_COOKIE_NAME;
const COOKIE_MAX_AGE_SEC = 60 * 60 * 24 * 365;

/** @deprecated legacy localStorage key — миграция в cookie админки */
const LEGACY_ADMIN_TOURNAMENT_FILTERS_STORAGE_KEY =
  "petanque_admin_tournaments_filters";

export interface TournamentListFilters {
  statuses: TournamentStatus[];
  types: TournamentType[];
  categories: TournamentCategory[];
}

export const EMPTY_TOURNAMENT_LIST_FILTERS: TournamentListFilters = {
  statuses: [],
  types: [],
  categories: [],
};

const PUBLIC_FILTER_STATUSES: TournamentStatus[] = [
  TournamentStatus.FINISHED,
  TournamentStatus.REGISTRATION,
  TournamentStatus.IN_PROGRESS,
];

const ADMIN_FILTER_STATUSES: TournamentStatus[] = [
  TournamentStatus.DRAFT,
  ...PUBLIC_FILTER_STATUSES,
];

const ALL_TOURNAMENT_TYPES = Object.values(TournamentType);
const ALL_CATEGORIES: TournamentCategory[] = ["FEDERAL", "REGIONAL"];

function isTournamentStatus(value: unknown): value is TournamentStatus {
  return (
    typeof value === "string" &&
    Object.values(TournamentStatus).includes(value as TournamentStatus)
  );
}

function isPublicTournamentStatus(value: unknown): value is TournamentStatus {
  return (
    typeof value === "string" &&
    PUBLIC_FILTER_STATUSES.includes(value as TournamentStatus)
  );
}

function isTournamentType(value: unknown): value is TournamentType {
  return typeof value === "string" && ALL_TOURNAMENT_TYPES.includes(value as TournamentType);
}

function isTournamentCategory(value: unknown): value is TournamentCategory {
  return typeof value === "string" && ALL_CATEGORIES.includes(value as TournamentCategory);
}

function parseStringArray<T>(
  raw: unknown,
  guard: (value: unknown) => value is T
): T[] {
  if (!Array.isArray(raw)) {
    return [];
  }
  return raw.filter(guard);
}

function parseFiltersJson(
  raw: string,
  isStatus: (value: unknown) => value is TournamentStatus
): TournamentListFilters | null {
  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    return {
      statuses: parseStringArray(parsed.statuses, isStatus),
      types: parseStringArray(parsed.types, isTournamentType),
      categories: parseStringArray(parsed.categories, isTournamentCategory),
    };
  } catch {
    return null;
  }
}

function setFiltersCookie(name: string, filters: TournamentListFilters): void {
  setCookie(name, JSON.stringify(filters), COOKIE_MAX_AGE_SEC, {
    encode: true,
  });
}

function loadFiltersFromCookie(
  cookieName: string,
  isStatus: (value: unknown) => value is TournamentStatus,
  requireConsent: boolean
): TournamentListFilters {
  if (requireConsent && !canUsePreferenceCookies()) {
    return { ...EMPTY_TOURNAMENT_LIST_FILTERS };
  }
  const raw = getCookie(cookieName);
  if (!raw) {
    return { ...EMPTY_TOURNAMENT_LIST_FILTERS };
  }
  return parseFiltersJson(raw, isStatus) ?? { ...EMPTY_TOURNAMENT_LIST_FILTERS };
}

function saveFiltersToCookie(
  cookieName: string,
  filters: TournamentListFilters,
  requireConsent: boolean
): void {
  if (requireConsent && !canUsePreferenceCookies()) {
    return;
  }
  setFiltersCookie(cookieName, filters);
}

function migrateLegacyAdminFiltersFromStorage(): TournamentListFilters | null {
  if (typeof localStorage === "undefined") {
    return null;
  }
  const raw = localStorage.getItem(LEGACY_ADMIN_TOURNAMENT_FILTERS_STORAGE_KEY);
  if (!raw) {
    return null;
  }
  localStorage.removeItem(LEGACY_ADMIN_TOURNAMENT_FILTERS_STORAGE_KEY);
  return parseFiltersJson(raw, isTournamentStatus);
}

export function loadTournamentFiltersFromCookie(): TournamentListFilters {
  return loadFiltersFromCookie(
    PUBLIC_FILTERS_COOKIE_NAME,
    isPublicTournamentStatus,
    true
  );
}

export function saveTournamentFiltersToCookie(
  filters: TournamentListFilters
): void {
  saveFiltersToCookie(PUBLIC_FILTERS_COOKIE_NAME, filters, true);
}

export function clearTournamentFiltersCookie(): void {
  clearCookie(PUBLIC_FILTERS_COOKIE_NAME);
}

export function loadAdminTournamentFiltersFromCookie(): TournamentListFilters {
  const raw = getCookie(ADMIN_FILTERS_COOKIE_NAME);
  if (raw !== null) {
    return parseFiltersJson(raw, isTournamentStatus) ?? {
      ...EMPTY_TOURNAMENT_LIST_FILTERS,
    };
  }

  const legacy = migrateLegacyAdminFiltersFromStorage();
  if (legacy) {
    saveAdminTournamentFiltersToCookie(legacy);
    return legacy;
  }

  return { ...EMPTY_TOURNAMENT_LIST_FILTERS };
}

export function saveAdminTournamentFiltersToCookie(
  filters: TournamentListFilters
): void {
  saveFiltersToCookie(ADMIN_FILTERS_COOKIE_NAME, filters, false);
}

export function clearAdminTournamentFiltersCookie(): void {
  clearCookie(ADMIN_FILTERS_COOKIE_NAME);
}

/** @deprecated используйте loadAdminTournamentFiltersFromCookie */
export function loadAdminTournamentFiltersFromStorage(): TournamentListFilters {
  return loadAdminTournamentFiltersFromCookie();
}

/** @deprecated используйте saveAdminTournamentFiltersToCookie */
export function saveAdminTournamentFiltersToStorage(
  filters: TournamentListFilters
): void {
  saveAdminTournamentFiltersToCookie(filters);
}

export function applyTournamentListFilters(
  tournaments: Tournament[],
  filters: TournamentListFilters
): Tournament[] {
  return tournaments.filter((tournament) => {
    if (
      filters.statuses.length > 0 &&
      !filters.statuses.includes(tournament.status)
    ) {
      return false;
    }
    if (filters.types.length > 0 && !filters.types.includes(tournament.type)) {
      return false;
    }
    if (
      filters.categories.length > 0 &&
      !filters.categories.includes(tournament.category)
    ) {
      return false;
    }
    return true;
  });
}

export function hasActiveTournamentFilters(
  filters: TournamentListFilters
): boolean {
  return (
    filters.statuses.length > 0 ||
    filters.types.length > 0 ||
    filters.categories.length > 0
  );
}

export const TOURNAMENT_FILTER_STATUS_OPTIONS = PUBLIC_FILTER_STATUSES;

export const TOURNAMENT_FILTER_ADMIN_STATUS_OPTIONS = ADMIN_FILTER_STATUSES;

export const TOURNAMENT_FILTER_TYPE_OPTIONS = ALL_TOURNAMENT_TYPES;

export const TOURNAMENT_FILTER_CATEGORY_OPTIONS = ALL_CATEGORIES;
