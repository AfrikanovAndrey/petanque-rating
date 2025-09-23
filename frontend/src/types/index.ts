// API Response типы
export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  message?: string;
}

// Игрок
export interface Player {
  id: number;
  name: string;
  created_at: string;
  updated_at: string;
}

// Турнир
export interface Tournament {
  id: number;
  name: string;
  date: string;
  created_at: string;
  updated_at: string;
}

// Результат турнира
export interface TournamentResult {
  id: number;
  tournament_id: number;
  player_id: number;
  position: number;
  points: number;
  created_at: string;
  updated_at: string;
  tournament_name?: string;
  tournament_date?: string;
  player_name?: string;
  is_counted?: boolean; // Входит ли в топ-N лучших результатов
}

// Рейтинг игрока
export interface PlayerRating {
  player_id: number;
  player_name: string;
  total_points: number;
  rank?: number;
  best_results: TournamentResult[];
  all_results: TournamentResult[];
}

// Строка таблицы рейтинга
export interface RatingTableRow {
  rank: number;
  player_id: number;
  player_name: string;
  total_points: number;
}

// Настройки очков за позицию
export interface PositionPoints {
  id: number;
  position: number;
  points: number;
  created_at: string;
  updated_at: string;
}

// Настройка рейтинга
export interface RatingSetting {
  id: number;
  setting_name: string;
  setting_value: string;
  description?: string;
  created_at: string;
  updated_at: string;
}

// Авторизация
export interface LoginCredentials {
  username: string;
  password: string;
}

export interface AuthResponse {
  success: boolean;
  token?: string;
  message?: string;
  admin?: {
    id: number;
    username: string;
  };
}

// Данные для загрузки турнира
export interface TournamentUpload {
  tournament_name: string;
  tournament_date: string;
  tournament_file: File;
}

// Турнир с результатами
export interface TournamentWithResults {
  tournament: Tournament;
  results: TournamentResult[];
}

// Состояния загрузки
export interface LoadingState {
  isLoading: boolean;
  error?: string;
}

// Пропсы для модальных окон
export interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
}

// Пропсы для форм
export interface FormProps<T = any> {
  initialData?: T;
  onSubmit: (data: T) => Promise<void> | void;
  onCancel?: () => void;
  isLoading?: boolean;
}

// Статистика
export interface Statistics {
  totalPlayers: number;
  totalTournaments: number;
  averageRating: number;
  topPlayer: {
    name: string;
    points: number;
  };
}
