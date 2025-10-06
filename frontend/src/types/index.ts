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
  category: TournamentCategory;
  teams_count: number;
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

export type TournamentCategory = "FEDERAL" | "REGIONAL";

export enum TournamentCategoryEnum {
  FEDERAL,
  REGIONAL,
}

// Enum для причин получения очков
export enum CupPosition {
  // Кубки
  WINNER = "WINNER",
  RUNNER_UP = "RUNNER_UP",
  THIRD_PLACE = "THIRD_PLACE",
  SEMI_FINAL = "SEMI_FINAL",
  QUARTER_FINAL = "QUARTER_FINAL",

  // Квалификация (швейцарка)
  QUALIFYING_HIGH = "QUALIFYING_HIGH", // >=3 побед
  QUALIFYING_LOW = "QUALIFYING_LOW", // 1-2 побед
}

export function getCupPositionText(
  cupPosition: CupPosition | string,
  cup?: "A" | "B" | "C" | null
) {
  // Для обратной совместимости со старыми данными
  if (typeof cupPosition === "string") {
    // Проверяем, является ли строка валидным значением PointsReason
    if (Object.values(CupPosition).includes(cupPosition as CupPosition)) {
      // Преобразуем строку в соответствующий enum
      cupPosition = cupPosition as CupPosition;
    } else {
      return cupPosition; // Возвращаем как есть, если не нашли соответствие
    }
  }

  if (cup) {
    switch (cupPosition) {
      case CupPosition.WINNER:
        return `1 ${cup}`;

      case CupPosition.RUNNER_UP:
        return `2 ${cup}`;

      case CupPosition.THIRD_PLACE:
        return `3 ${cup}`;

      case CupPosition.SEMI_FINAL:
        return `1/2 ${cup}`;

      case CupPosition.QUARTER_FINAL:
        return `1/4 ${cup}`;
    }
  }

  // TODO: доделать очки за победы в квалификационном этапе
  // switch (cupPosition) {
  //   case CupPosition.QUALIFYING_HIGH:
  //     if (qualifyingWins !== undefined && qualifyingWins >= 3) {
  //       return `Победы в квалификационном этапе: >= 3`;
  //     }
  //     return "Квалификация >=3 побед";

  //   case CupPosition.QUALIFYING_LOW:
  //     if (
  //       qualifyingWins !== undefined &&
  //       qualifyingWins > 0 &&
  //       qualifyingWins <= 2
  //     ) {
  //       return `Победы в квалификационном этапе: 1-2`;
  //     }
  //     return "Квалификация 1-2 победы";

  //   default:
  //     throw new Error(`Неизвестное значение PointsReason: ${cupPosition}`);
  // }
}

// Результат турнира
export interface TournamentResult {
  id: number;
  tournament_id: number;
  team_id: number;
  cup_position: CupPosition;
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
