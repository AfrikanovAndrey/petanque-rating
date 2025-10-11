import axios, { AxiosResponse, InternalAxiosRequestConfig } from "axios";
import {
  ApiResponse,
  PlayerRating,
  LoginCredentials,
  AuthResponse,
  Tournament,
  TournamentWithResults,
  Player,
  User,
  CreateUserRequest,
  UpdateUserRequest,
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
};

export const tournamentsApi = {
  // Получить список всех турниров
  getAllTournaments: (): Promise<AxiosResponse<ApiResponse<Tournament[]>>> =>
    api.get("/rating/tournaments"),

  // Получить турнир с результатами
  getTournamentDetails: (
    tournamentId: number
  ): Promise<AxiosResponse<ApiResponse<TournamentWithResults>>> =>
    api.get(`/rating/tournaments/${tournamentId}`),
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

  // Получить турнир с результатами
  getTournamentDetails: (
    tournamentId: number
  ): Promise<AxiosResponse<ApiResponse<TournamentWithResults>>> =>
    api.get(`/admin/tournaments/${tournamentId}`),

  // Обновить турнир
  updateTournament: (
    tournamentId: number,
    data: {
      name?: string;
      type?: TournamentType;
      category?: string;
      teams_count?: number;
      date?: string;
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
    gender: string;
  }): Promise<AxiosResponse<ApiResponse<{ player_id: number }>>> =>
    api.post("/admin/players", data),

  // Обновить игрока
  updatePlayer: (
    playerId: number,
    data: { name: string; gender: string }
  ): Promise<AxiosResponse<ApiResponse>> =>
    api.put(`/admin/players/${playerId}`, data),

  // Удалить игрока
  deletePlayer: (playerId: number): Promise<AxiosResponse<ApiResponse>> =>
    api.delete(`/admin/players/${playerId}`),

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
};

export default api;
