export interface Player {
  id: number;
  name: string;
  gender?: "male" | "female" | null;
  city?: string | null;
  created_at: Date;
  updated_at: Date;
}

export enum TournamentType {
  TRIPLETTE = "TRIPLETTE",
  DOUBLETTE_MALE = "DOUBLETTE_MALE",
  DOUBLETTE_FEMALE = "DOUBLETTE_FEMALE",
  DOUBLETTE_MIXT = "DOUBLETTE_MIXT",
  TET_A_TET_MALE = "TET_A_TET_MALE",
  TET_A_TET_FEMALE = "TET_A_TET_FEMALE",
}

export interface Tournament {
  id: number;
  name: string;
  type: TournamentType;
  category: string;
  date: string;
  created_at: Date;
  updated_at: Date;
  teams_count?: number; // Вычисляемое поле, возвращается при получении списка турниров
}

export interface TournamentResult {
  id: number;
  tournament_id: number;
  team_id: number;
  cup_position: CupPosition | null;
  cup?: "A" | "B" | "C" | null;
  qualifying_wins?: number; // Количество побед команды в квалификационной части
  wins?: number; // Общее количество побед (qualifying_wins + бонусы за кубки)
  loses?: number; // Общее количество поражений
  created_at: Date;
  updated_at: Date;
  tournament?: Tournament;
  team?: TeamDB;
  // Дополнительные поля, добавляемые при JOIN запросах
  team_name?: string;
  tournament_name?: string;
  tournament_category: TournamentCategory;
  tournament_date?: string;
  team_players?: string; // Строка с именами игроков через запятую
}

// Таблица для рейтинговых очков игроков за турниры
// Простая структура: id | tournament_id | player_id | points
export interface PlayerTournamentPoints {
  id: number;
  tournament_id: number;
  player_id: number;
  points: number;
  created_at: Date;
  updated_at: Date;
  // Дополнительные поля для JOIN запросов
  player_name?: string;
  tournament_name?: string;
  tournament_date?: string;
}

export interface RatingSetting {
  id: number;
  setting_name: string;
  setting_value: string;
  description?: string;
  created_at: Date;
  updated_at: Date;
}

export enum UserRole {
  ADMIN = "ADMIN",
  MANAGER = "MANAGER",
}

export interface User {
  id: number;
  name: string;
  username: string;
  password_hash: string;
  role: UserRole;
  created_at: Date;
  updated_at: Date;
}

// Для обратной совместимости
export interface Admin {
  id: number;
  username: string;
  password_hash: string;
  created_at: Date;
  updated_at: Date;
}

export interface PlayerRating {
  player_id: number | null; // Может быть null для лицензированных игроков без записи в players
  player_name: string;
  gender?: "male" | "female" | null;
  total_points: number;
  best_results: TournamentResultWithTournament[];
  all_results: TournamentResultWithTournament[];
  licensed_name?: string; // Полное имя из лицензионной базы
}

export interface TournamentResultWithTournament
  extends Omit<TournamentResult, "cup_position"> {
  tournament_name: string;
  tournament_date: string;
  tournament_type: TournamentType; // Тип турнира
  is_counted: boolean; // Входит ли результат в топ-8 лучших
  team_players: string; // Строка с именами игроков команды через запятую
  points: number; // Очки за этот результат (добавлено для совместимости с рейтингом)
  cup_position: string; // Причина получения очков (может быть из разных источников)
}

export interface RatingTableRow {
  rank: number;
  player_id: number | null; // Может быть null для лицензированных игроков без записи в players
  player_name: string;
  total_points: number;
}

export interface TournamentUploadData {
  tournament_name: string;
  tournament_date: string;
  tournament_type: TournamentType; // тип турнира
  total_teams?: number; // общее количество команд для расчета очков кубка
  tournament_category?: "1" | "2"; // категория турнира (1 - высшая, 2 - вторая)
  results: Array<{
    player_name: string;
    cup_position: string;
    cup?: Cup | null;
  }>;
}

export interface AuthRequest {
  username: string;
  password: string;
}

export interface AuthResponse {
  success: boolean;
  token?: string;
  message?: string;
  user?: {
    id: number;
    name: string;
    username: string;
    role: UserRole;
  };
}

export interface CreateUserRequest {
  name: string;
  username: string;
  password: string;
  role: UserRole;
}

export interface UpdateUserRequest {
  name?: string;
  username?: string;
  password?: string;
  role?: UserRole;
}

export type TournamentCategory = "FEDERAL" | "REGIONAL";

export enum TournamentCategoryEnum {
  FEDERAL = 1,
  REGIONAL = 2,
}

export enum CupPosition {
  WINNER = "1",
  RUNNER_UP = "2",
  THIRD_PLACE = "3",
  ROUND_OF_4 = "1/2",
  ROUND_OF_8 = "1/4",
  ROUND_OF_16 = "1/8",
}

export interface Team {
  number: number;
  players: string[];
}

export interface PlayersTeam {
  teamId: number;
  players: number[];
}

export type Cup = "A" | "B" | "C";

export interface CupTeamResult {
  team: string;
  cup: Cup;
  cup_position: CupPosition;
}

export interface LicensedPlayer {
  id: number;
  player_id: number;
  license_number: string;
  city: string;
  license_date: Date;
  year: number;
  is_active: boolean;
  created_at: Date;
  updated_at: Date;
}

export interface LicensedPlayerUploadData {
  license_number: string;
  player_name: string; // Имя игрока, будет создан/найден в таблице players
  full_name?: string; // Полное имя для совместимости
  city: string;
  license_date: string;
  year: number;
}

// Типы для команд в БД
export interface TeamDB {
  id: number;
  created_at: Date;
  updated_at: Date;
}

export interface TeamMember {
  id: number;
  team_id: number;
  player_id: number;
  sort_order: number;
  created_at: Date;
  updated_at: Date;
}

export interface TeamWithMembers extends TeamDB {
  // Получение всех участников команды как массив ID игроков
  getPlayerIds(): number[];
  // Получение всех участников команды с именами
  getPlayersWithNames(): Promise<
    Array<{
      player_id: number;
      player_name: string;
      sort_order: number;
    }>
  >;
}

export interface TeamRating {
  team_id: number;
  team_name: string;
  players: string[];
  total_points: number;
  best_results: TournamentResultWithTournament[];
  all_results: TournamentResultWithTournament[];
}

export interface TournamentTeamUploadData {
  tournament_name: string;
  tournament_date: string;
  tournament_type: TournamentType; // тип турнира
  total_teams?: number;
  tournament_category?: "1" | "2";
  results: Array<{
    team_name: string;
    team_players: string[]; // массив имен игроков в команде (1-4)
    cup_position: string;
    cup?: "A" | "B" | null;
  }>;
}

// Типы для стадий турнира
export type StageWithCells = {
  cells: string[];
  position: CupPosition;
};

export type TeamResults = {
  cup?: Cup;
  cupPosition?: CupPosition;
  qualifyingWins: number;
  wins: number;
  loses: number;
  points?: number;
};
