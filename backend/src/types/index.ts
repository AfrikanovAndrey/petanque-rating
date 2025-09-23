export interface Player {
  id: number;
  name: string;
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

export interface TournamentResult {
  id: number;
  tournament_id: number;
  player_id: number;
  position: number;
  points: number;
  created_at: Date;
  updated_at: Date;
  tournament?: Tournament;
  player?: Player;
}

export interface RatingSetting {
  id: number;
  setting_name: string;
  setting_value: string;
  description?: string;
  created_at: Date;
  updated_at: Date;
}

export interface PositionPoints {
  id: number;
  position: number;
  points: number;
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
  player_id: number;
  player_name: string;
  total_points: number;
  best_results: TournamentResultWithTournament[];
  all_results: TournamentResultWithTournament[];
}

export interface TournamentResultWithTournament extends TournamentResult {
  tournament_name: string;
  tournament_date: string;
  is_counted: boolean; // Входит ли результат в топ-8 лучших
}

export interface RatingTableRow {
  rank: number;
  player_id: number;
  player_name: string;
  total_points: number;
}

export interface TournamentUploadData {
  tournament_name: string;
  tournament_date: string;
  results: Array<{
    player_name: string;
    position: number;
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
