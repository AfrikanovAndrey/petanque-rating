export interface Player {
  id: number;
  name: string;
  gender?: "male" | "female" | null;
  created_at: Date;
  updated_at: Date;
}

export interface Tournament {
  id: number;
  name: string;
  date: string;
  created_at: Date;
  updated_at: Date;
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
}

// Функция для преобразования старых значений cup_position в PointsReason
export function convertCupPositionToPointsReason(
  cupPosition: string
): PointsReason {
  // Квалификация
  if (cupPosition === "Квалификация >=3 побед")
    return PointsReason.QUALIFYING_HIGH;
  if (cupPosition === "Квалификация 1-2 победы")
    return PointsReason.QUALIFYING_LOW;

  // Позиции кубков
  if (cupPosition === "1") return PointsReason.CUP_WINNER;
  if (cupPosition === "2") return PointsReason.CUP_RUNNER_UP;
  if (cupPosition === "3") return PointsReason.CUP_THIRD_PLACE;
  if (cupPosition === "1/2") return PointsReason.CUP_SEMI_FINAL;
  if (cupPosition === "1/4") return PointsReason.CUP_QUARTER_FINAL;

  // По умолчанию
  return PointsReason.CUP_QUARTER_FINAL;
}

// Функция для преобразования PointsReason в читаемый текст
export function getPointsReasonText(
  reason: PointsReason,
  cup?: "A" | "B" | null
): string {
  switch (reason) {
    case PointsReason.QUALIFYING_HIGH:
      return "Квалификация >=3 побед";
    case PointsReason.QUALIFYING_LOW:
      return "Квалификация 1-2 победы";
    case PointsReason.CUP_WINNER:
      return cup ? `1 место ${cup}` : "1 место";
    case PointsReason.CUP_RUNNER_UP:
      return cup ? `2 место ${cup}` : "2 место";
    case PointsReason.CUP_THIRD_PLACE:
      return cup ? `3 место ${cup}` : "3 место";
    case PointsReason.CUP_SEMI_FINAL:
      return cup ? `Полуфинал ${cup}` : "Полуфинал";
    case PointsReason.CUP_QUARTER_FINAL:
      return cup ? `Четвертьфинал ${cup}` : "Четвертьфинал";
    default:
      return reason;
  }
}

export interface TournamentResult {
  id: number;
  tournament_id: number;
  team_id: number;
  points_reason: PointsReason;
  cup?: "A" | "B" | null;
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

export interface TournamentResultWithTournament extends TournamentResult {
  tournament_name: string;
  tournament_date: string;
  is_counted: boolean; // Входит ли результат в топ-8 лучших
  team_players: string; // Строка с именами игроков команды через запятую
  points: number; // Очки за этот результат (добавлено для совместимости с рейтингом)
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
  total_teams?: number; // общее количество команд для расчета очков кубка
  tournament_category?: "1" | "2"; // категория турнира (1 - высшая, 2 - вторая)
  results: Array<{
    player_name: string;
    points_reason: string;
    cup?: "A" | "B" | null;
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
}
export enum CupPosition {
  WINNER = "1",
  RUNNER_UP = "2",
  THIRD_PLACE = "3",
  SEMI_FINAL = "1/2",
  QUARTER_FINAL = "1/4",
}

export interface Team {
  number: number;
  players: string[];
}

export interface CupTeamResult {
  team: Team;
  cup: "A" | "B";
  points_reason: string;
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
  total_teams?: number;
  tournament_category?: "1" | "2";
  results: Array<{
    team_name: string;
    team_players: string[]; // массив имен игроков в команде (1-4)
    points_reason: string;
    cup?: "A" | "B" | null;
  }>;
}

// Типы для стадий турнира
export interface StageWithCells {
  cells: string[];
  position: CupPosition;
}

export interface StageWithRange {
  range: string;
  position: CupPosition;
}

export type StageInfo = StageWithCells | StageWithRange;
