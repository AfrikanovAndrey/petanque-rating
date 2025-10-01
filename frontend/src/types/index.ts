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
  gender: string;
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

// Команда
export interface Team {
  id: number;
  name: string;
  tournament_id: number;
  created_at: string;
  updated_at: string;
}

// Участник команды
export interface TeamMember {
  player_id: number;
  player_name: string;
  sort_order: number;
}

// Команда с участниками
export interface TeamWithMembers extends Team {
  members: TeamMember[];
}

// Enum для причин получения очков
export enum PointsReason {
  // Кубки
  CUP_WINNER = "CUP_WINNER",
  CUP_RUNNER_UP = "CUP_RUNNER_UP",
  CUP_THIRD_PLACE = "CUP_THIRD_PLACE",
  CUP_SEMI_FINAL = "CUP_SEMI_FINAL",
  CUP_QUARTER_FINAL = "CUP_QUARTER_FINAL",

  // Квалификация (швейцарка)
  QUALIFYING_HIGH = "QUALIFYING_HIGH", // >=3 побед
  QUALIFYING_LOW = "QUALIFYING_LOW", // 1-2 побед

  // Результат игрока
  PLAYER_RESULT = "PLAYER_RESULT",
}

export function getPointsReasonText(
  reason: PointsReason | string,
  cup?: "A" | "B" | "C" | null,
  qualifyingWins?: number
): string {
  // Для обратной совместимости со старыми данными
  if (typeof reason === "string") {
    // Проверяем, является ли строка валидным значением PointsReason
    if (Object.values(PointsReason).includes(reason as PointsReason)) {
      // Преобразуем строку в соответствующий enum
      reason = reason as PointsReason;
    } else {
      return reason; // Возвращаем как есть, если не нашли соответствие
    }
  }

  switch (reason) {
    case PointsReason.QUALIFYING_HIGH:
      if (qualifyingWins !== undefined && qualifyingWins >= 3) {
        return `Победы в квалификационном этапе: >= 3`;
      }
      return "Квалификация >=3 побед";

    case PointsReason.QUALIFYING_LOW:
      if (
        qualifyingWins !== undefined &&
        qualifyingWins > 0 &&
        qualifyingWins <= 2
      ) {
        return `Победы в квалификационном этапе: 1-2`;
      }
      return "Квалификация 1-2 победы";

    case PointsReason.CUP_WINNER:
      return cup ? `1 ${cup}` : "1 место";

    case PointsReason.CUP_RUNNER_UP:
      return cup ? `2 ${cup}` : "2 место";

    case PointsReason.CUP_THIRD_PLACE:
      return cup ? `3 ${cup}` : "3 место";

    case PointsReason.CUP_SEMI_FINAL:
      return cup ? `1/2 ${cup}` : "Полуфинал";

    case PointsReason.CUP_QUARTER_FINAL:
      return cup ? `1/4 ${cup}` : "Четвертьфинал";

    case PointsReason.PLAYER_RESULT:
      return "Результат игрока";

    default:
      throw new Error(`Неизвестное значение PointsReason: ${reason}`);
  }

  return "Результат турнира";
}

// Функция для получения цвета позиции (для обратной совместимости)
export function getPointsReasonColor(reason: PointsReason | string): string {
  if (reason === PointsReason.CUP_WINNER || reason === "CUP_WINNER")
    return "text-yellow-600";
  if (reason === PointsReason.CUP_RUNNER_UP || reason === "CUP_RUNNER_UP")
    return "text-gray-600";
  if (reason === PointsReason.CUP_THIRD_PLACE || reason === "CUP_THIRD_PLACE")
    return "text-amber-600";
  return "text-gray-900";
}

// Результат турнира
export interface TournamentResult {
  id: number;
  tournament_id: number;
  team_id: number;
  points_reason: PointsReason;
  points: number;
  cup?: "A" | "B" | null; // Кубок А или Б, null если не попал в кубки
  qualifying_wins?: number; // Количество побед команды в квалификационной части
  wins?: number; // Общее количество побед (qualifying_wins + бонусы за кубки)
  loses?: number; // Общее количество поражений
  created_at: string;
  updated_at: string;
  tournament_name?: string;
  tournament_date?: string;
  team_name?: string;
  team_players?: string; // Строка с именами игроков через запятую
  is_counted?: boolean; // Входит ли в топ-N лучших результатов
}

// Рейтинг игрока
export interface PlayerRating {
  player_id: number | null; // Может быть null для лицензированных игроков без записи в players
  player_name: string;
  gender?: "male" | "female" | null;
  total_points: number;
  rank?: number;
  best_results: TournamentResult[];
  all_results: TournamentResult[];
  licensed_name?: string; // Полное имя из лицензионной базы
}

// Рейтинг команды
export interface TeamRating {
  team_id: number;
  team_name: string;
  players: string[]; // Массив имен игроков
  total_points: number;
  rank?: number;
  best_results: TournamentResult[];
  all_results: TournamentResult[];
}

// Строка таблицы рейтинга
export interface RatingTableRow {
  rank: number;
  player_id: number | null;
  player_name: string;
  gender?: "male" | "female" | null;
  total_points: number;
}

// Рейтинги разделенные по полу
export interface RatingsByGender {
  male: PlayerRating[];
  female: PlayerRating[];
  unknown: PlayerRating[];
}

// Рейтинги для конкретного пола
export interface GenderRatingResponse {
  data: PlayerRating[];
  gender: string;
  count: number;
}

// Статистика рейтингов по полу
export interface GenderRatingCounts {
  male: number;
  female: number;
  unknown: number;
  total: number;
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
