import axios, { AxiosResponse, InternalAxiosRequestConfig } from "axios";
import {
  ApiResponse,
  PlayerRating,
  LoginCredentials,
  AuthResponse,
  Tournament,
  TournamentRegistrationPageData,
  TournamentWithResults,
  Player,
  PlayerSearchResult,
  RegisterTournamentSlotPayload,
  User,
  CreateUserRequest,
  UpdateUserRequest,
  TournamentStatus,
  TournamentType,
} from "../types";

// Создаем экземпляр axios
const api = axios.create({
  baseURL: "/api",
  timeout: 30000,
  headers: {
    "Content-Type": "application/json",
  },
});

/** Создание турнира без загрузки результатов (POST /admin/tournaments) */
export type CreateBlankTournamentBody = {
  name: string;
  date: string;
  type: TournamentType;
  category: string;
  regulations?: string;
};

export const createBlankTournament = (
  data: CreateBlankTournamentBody
): Promise<AxiosResponse<ApiResponse<{ id: number }>>> =>
  api.post("/admin/tournaments", data);

// Интерцептор для добавления токена к запросам
api.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  const token = localStorage.getItem("admin_token");
  if (token && config.headers) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Интерцептор для обработки ошибок авторизации
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem("admin_token");
      // Перенаправляем на страницу входа только если мы не на публичной странице
      if (window.location.pathname.startsWith("/admin")) {
        window.location.href = "/admin/login";
      }
    }
    return Promise.reject(error);
  }
);

// === ПУБЛИЧНЫЕ API (рейтинг) ===
export const ratingApi = {
  // Получить полную таблицу рейтинга с деталями
  getFullRating: (): Promise<AxiosResponse<ApiResponse<PlayerRating[]>>> =>
    api.get("/rating/full"),

  // Получить рейтинги разделенные по полу
  getRatingsByGender: (
    gender?: string
  ): Promise<AxiosResponse<ApiResponse<any>>> =>
    api.get("/rating/by-gender" + (gender ? `?gender=${gender}` : "")),

  // Действующие лицензии на текущий календарный год
  getActiveLicenses: (): Promise<
    AxiosResponse<
      ApiResponse<
        {
          player_name: string;
          license_date: string;
          license_number: string | null;
          city: string | null;
        }[]
      >
    >
  > => api.get("/rating/licenses"),

  /** Поиск игроков по имени (публичный, для регистрации) */
  searchPlayers: (params: {
    q: string;
    gender?: "male" | "female";
    limit?: number;
  }): Promise<AxiosResponse<ApiResponse<PlayerSearchResult[]>>> =>
    api.get("/rating/players/search", { params }),
};

/** Публичная страница регистрации (GET /rating/tournaments/:id/registration) */
export const getPublicTournamentRegistration = (
  tournamentId: number
): Promise<
  AxiosResponse<ApiResponse<TournamentRegistrationPageData>>
> => api.get(`/rating/tournaments/${tournamentId}/registration`);

/** Публичная страница турнира «в процессе» (GET /rating/tournaments/:id/in-progress) */
export const getPublicTournamentInProgress = (
  tournamentId: number
): Promise<
  AxiosResponse<ApiResponse<TournamentRegistrationPageData>>
> => api.get(`/rating/tournaments/${tournamentId}/in-progress`);

/** Публичная заявка команды на турнир (статус REGISTRATION) */
export const registerTeamForTournamentPublic = (
  tournamentId: number,
  slots: RegisterTournamentSlotPayload[]
): Promise<AxiosResponse<ApiResponse<unknown>>> =>
  api.post(`/rating/tournaments/${tournamentId}/register-team`, {
    slots,
  });

export const tournamentsApi = {
  // Получить список всех турниров
  getAllTournaments: (): Promise<AxiosResponse<ApiResponse<Tournament[]>>> =>
    api.get("/rating/tournaments"),

  // Получить турнир с результатами
  getTournamentDetails: (
    tournamentId: number
  ): Promise<AxiosResponse<ApiResponse<TournamentWithResults>>> =>
    api.get(`/rating/tournaments/${tournamentId}`),

  getTournamentRegistrationPublic: getPublicTournamentRegistration,
  getTournamentInProgressPublic: getPublicTournamentInProgress,
};

// === API АВТОРИЗАЦИИ ===
export const authApi = {
  // Авторизация
  login: (
    credentials: LoginCredentials
  ): Promise<AxiosResponse<AuthResponse>> =>
    api.post("/auth/login", credentials),

  // Проверка токена
  verifyToken: (): Promise<AxiosResponse<AuthResponse>> =>
    api.get("/auth/verify"),
};

// === АДМИНСКИЕ API ===
export const adminApi = {
  // === УПРАВЛЕНИЕ ПОЛЬЗОВАТЕЛЯМИ (только для ADMIN) ===
  // Получить всех пользователей
  getUsers: (): Promise<
    AxiosResponse<{
      success: boolean;
      users: User[];
      message?: string;
    }>
  > => api.get("/admin/users"),

  // Получить текущего пользователя
  getCurrentUser: (): Promise<
    AxiosResponse<{
      success: boolean;
      data: User;
      message?: string;
    }>
  > => api.get("/admin/users/current"),

  // Создать пользователя
  createUser: (data: CreateUserRequest): Promise<AxiosResponse<ApiResponse>> =>
    api.post("/admin/users", data),

  // Обновить пользователя
  updateUser: (
    userId: number,
    data: UpdateUserRequest
  ): Promise<AxiosResponse<ApiResponse>> =>
    api.put(`/admin/users/${userId}`, data),

  // Удалить пользователя
  deleteUser: (userId: number): Promise<AxiosResponse<ApiResponse>> =>
    api.delete(`/admin/users/${userId}`),

  // === УПРАВЛЕНИЕ ТУРНИРАМИ ===
  // Загрузка турнира из Excel
  uploadTournament: (
    formData: FormData
  ): Promise<AxiosResponse<ApiResponse>> => {
    return api.post("/admin/tournaments/upload", formData, {
      headers: {
        "Content-Type": "multipart/form-data",
      },
      timeout: 60000, // 60 секунд для загрузки файла
    });
  },

  // Загрузка турнира из Google Sheets
  uploadTournamentFromGoogleSheets: (data: {
    tournament_name: string;
    tournament_date: string;
    tournament_type: TournamentType;
    tournament_category: string;
    google_sheets_url: string;
  }): Promise<AxiosResponse<ApiResponse>> => {
    return api.post("/admin/tournaments/upload-from-google-sheets", data, {
      timeout: 60000, // 60 секунд для загрузки из Google Sheets
    });
  },

  // Проверка доступности Google таблицы
  checkGoogleSheetsAccess: (data: {
    url: string;
  }): Promise<
    AxiosResponse<
      ApiResponse<{
        spreadsheetId: string;
        sheetNames: string[];
        totalSheets: number;
      }>
    >
  > => {
    return api.post("/admin/tournaments/check-google-sheets", data, {
      timeout: 30000, // 30 секунд для проверки доступности
    });
  },

  // Получить все турниры
  getTournaments: (): Promise<AxiosResponse<ApiResponse<Tournament[]>>> =>
    api.get("/admin/tournaments"),

  // Создать турнир (без загрузки результатов)
  createTournament: createBlankTournament,

  // Получить турнир с результатами
  getTournamentDetails: (
    tournamentId: number
  ): Promise<AxiosResponse<ApiResponse<TournamentWithResults>>> =>
    api.get(`/admin/tournaments/${tournamentId}`),

  /** Признать результаты турнира для учёта в рейтинге */
  validateTournamentResults: (
    tournamentId: number
  ): Promise<AxiosResponse<ApiResponse>> =>
    api.post(`/admin/tournaments/${tournamentId}/validate-results`),

  // Черновик турнира (статус DRAFT, без списка заявок)
  getTournamentDraftPage: (
    tournamentId: number
  ): Promise<
    AxiosResponse<ApiResponse<TournamentRegistrationPageData>>
  > => api.get(`/admin/tournaments/${tournamentId}/draft`),

  // Страница регистрации (турнир в статусе REGISTRATION + записанные команды)
  getTournamentRegistrationPage: (
    tournamentId: number
  ): Promise<
    AxiosResponse<ApiResponse<TournamentRegistrationPageData>>
  > => api.get(`/admin/tournaments/${tournamentId}/registration`),

  // Турнир в процессе: параметры + список заявок (только чтение)
  getTournamentInProgressPage: (
    tournamentId: number
  ): Promise<
    AxiosResponse<ApiResponse<TournamentRegistrationPageData>>
  > => api.get(`/admin/tournaments/${tournamentId}/in-progress`),

  /** Завершить турнир «в процессе»: записать результаты из Excel в этот же турнир */
  completeInProgressTournamentFromExcel: (
    tournamentId: number,
    file: File
  ): Promise<AxiosResponse<ApiResponse<{ tournament_id?: number }>>> => {
    const formData = new FormData();
    formData.append("tournament_file", file);
    return api.post(
      `/admin/tournaments/${tournamentId}/complete-from-excel`,
      formData,
      {
        headers: { "Content-Type": "multipart/form-data" },
        timeout: 120_000,
      }
    );
  },

  /** Завершить турнир «в процессе»: записать результаты из Google Таблицы в этот же турнир */
  completeInProgressTournamentFromGoogleSheets: (
    tournamentId: number,
    data: { google_sheets_url: string }
  ): Promise<AxiosResponse<ApiResponse<{ tournament_id?: number }>>> =>
    api.post(
      `/admin/tournaments/${tournamentId}/complete-from-google-sheets`,
      data,
      { timeout: 120_000 }
    ),

  /** Полностью заменить результаты завершённого турнира (Excel) */
  replaceFinishedTournamentResultsFromExcel: (
    tournamentId: number,
    file: File
  ): Promise<AxiosResponse<ApiResponse<{ tournament_id?: number }>>> => {
    const formData = new FormData();
    formData.append("tournament_file", file);
    return api.post(
      `/admin/tournaments/${tournamentId}/replace-results-from-excel`,
      formData,
      {
        headers: { "Content-Type": "multipart/form-data" },
        timeout: 120_000,
      }
    );
  },

  /** Полностью заменить результаты завершённого турнира (Google Таблицы) */
  replaceFinishedTournamentResultsFromGoogleSheets: (
    tournamentId: number,
    data: { google_sheets_url: string }
  ): Promise<AxiosResponse<ApiResponse<{ tournament_id?: number }>>> =>
    api.post(
      `/admin/tournaments/${tournamentId}/replace-results-from-google-sheets`,
      data,
      { timeout: 120_000 }
    ),

  // Подтвердить заявку команды на турнир
  confirmTournamentRegistration: (
    tournamentId: number,
    teamId: number
  ): Promise<AxiosResponse<ApiResponse>> =>
    api.post(`/admin/tournaments/${tournamentId}/registration/${teamId}/confirm`),

  // Изменить состав зарегистрированной команды
  updateTournamentRegistrationTeam: (
    tournamentId: number,
    teamId: number,
    player_ids: number[]
  ): Promise<AxiosResponse<ApiResponse>> =>
    api.put(`/admin/tournaments/${tournamentId}/registration/${teamId}`, {
      player_ids,
    }),

  // Удалить заявку команды на турнир
  deleteTournamentRegistration: (
    tournamentId: number,
    teamId: number
  ): Promise<AxiosResponse<ApiResponse>> =>
    api.delete(`/admin/tournaments/${tournamentId}/registration/${teamId}`),

  // Обновить турнир
  updateTournament: (
    tournamentId: number,
    data: {
      name?: string;
      type?: TournamentType;
      category?: string;
      date?: string;
      status?: TournamentStatus;
      manual?: boolean;
      regulations?: string | null;
    }
  ): Promise<AxiosResponse<ApiResponse>> =>
    api.put(`/admin/tournaments/${tournamentId}`, data),

  // Удалить турнир
  deleteTournament: (
    tournamentId: number
  ): Promise<AxiosResponse<ApiResponse>> =>
    api.delete(`/admin/tournaments/${tournamentId}`),

  // === УПРАВЛЕНИЕ ИГРОКАМИ ===
  // Получить всех игроков
  getPlayers: (): Promise<AxiosResponse<ApiResponse<Player[]>>> =>
    api.get("/admin/players"),

  // Создать игрока
  createPlayer: (data: {
    name: string;
    license_number?: string;
    gender: string;
    city?: string;
  }): Promise<AxiosResponse<ApiResponse<{ player_id: number }>>> =>
    api.post("/admin/players", data),

  // Массовая загрузка игроков из текстового файла
  uploadPlayersFromText: (
    formData: FormData
  ): Promise<AxiosResponse<ApiResponse>> => {
    return api.post("/admin/players/upload-text", formData, {
      headers: {
        "Content-Type": "multipart/form-data",
      },
      timeout: 30000, // 30 секунд для загрузки файла
    });
  },

  // Обновить игрока
  updatePlayer: (
    playerId: number,
    data: { name: string; license_number?: string; gender: string; city?: string }
  ): Promise<AxiosResponse<ApiResponse>> =>
    api.put(`/admin/players/${playerId}`, data),

  // Удалить игрока
  deletePlayer: (playerId: number): Promise<AxiosResponse<ApiResponse>> =>
    api.delete(`/admin/players/${playerId}`),

  // Получить детали игрока (турниры, результаты)
  getPlayerDetails: (
    playerId: number
  ): Promise<AxiosResponse<ApiResponse<PlayerRating>>> =>
    api.get(`/rating/player/${playerId}`),

  // === УПРАВЛЕНИЕ КОМАНДАМИ ===
  // Удалить все команды
  deleteAllTeams: (): Promise<
    AxiosResponse<ApiResponse<{ deleted_count: number }>>
  > => api.delete("/teams"),

  // === НАСТРОЙКИ РЕЙТИНГА ===

  // Получить количество лучших результатов
  getBestResultsCount: (): Promise<
    AxiosResponse<ApiResponse<{ best_results_count: number }>>
  > => api.get("/admin/settings/best-results-count"),

  // Обновить количество лучших результатов
  setBestResultsCount: (count: number): Promise<AxiosResponse<ApiResponse>> =>
    api.put("/admin/settings/best-results-count", { count }),

  // === ПЕРЕСЧЁТ РЕЙТИНГА ===

  // Пересчитать очки всех турниров текущего календарного года
  recalculateTournamentPoints: (): Promise<AxiosResponse<ApiResponse>> =>
    api.post("/admin/tournaments/recalculate-points"),

  // Пересчитать очки конкретного турнира
  recalculateTournamentPointsById: (
    tournamentId: number
  ): Promise<AxiosResponse<ApiResponse>> =>
    api.post(`/admin/tournaments/${tournamentId}/recalculate-points`),

  // === ЛОГИ АУДИТА (только для ADMIN) ===
  // Получить логи аудита с фильтрацией
  getAuditLogs: (params?: {
    user_id?: number;
    username?: string;
    action?: string;
    entity_type?: string;
    entity_id?: number;
    success?: boolean;
    date_from?: string;
    date_to?: string;
    limit?: number;
    offset?: number;
  }): Promise<AxiosResponse<ApiResponse<any>>> =>
    api.get("/admin/audit-logs", { params }),

  // Получить конкретную запись аудита
  getAuditLogById: (id: number): Promise<AxiosResponse<ApiResponse<any>>> =>
    api.get(`/admin/audit-logs/${id}`),

  // Получить историю действий пользователя
  getUserAuditHistory: (
    userId: number,
    limit?: number
  ): Promise<AxiosResponse<ApiResponse<any>>> =>
    api.get(`/admin/audit-logs/user/${userId}`, {
      params: { limit },
    }),

  // Получить историю изменений сущности
  getEntityAuditHistory: (
    entityType: string,
    entityId: number,
    limit?: number
  ): Promise<AxiosResponse<ApiResponse<any>>> =>
    api.get(`/admin/audit-logs/entity/${entityType}/${entityId}`, {
      params: { limit },
    }),

  // Получить статистику по действиям
  getAuditStatistics: (params?: {
    date_from?: string;
    date_to?: string;
  }): Promise<AxiosResponse<ApiResponse<any>>> =>
    api.get("/admin/audit-logs/statistics", { params }),

  // Получить список доступных действий
  getAuditActions: (): Promise<AxiosResponse<ApiResponse<any>>> =>
    api.get("/admin/audit-logs/actions"),

  // Получить список типов сущностей
  getAuditEntityTypes: (): Promise<AxiosResponse<ApiResponse<any>>> =>
    api.get("/admin/audit-logs/entity-types"),

  // Удалить старые записи аудита
  cleanupAuditLogs: (days: number): Promise<AxiosResponse<ApiResponse>> =>
    api.delete("/admin/audit-logs/cleanup", { data: { days } }),
};

export default api;
