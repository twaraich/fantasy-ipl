export type PlayerRole = "WK" | "BAT" | "AR" | "BOWL";

export interface League {
  id: string;
  name: string;
  created_by: string;
  draft_status: "pending" | "in_progress" | "completed";
  draft_order: string[]; // user IDs in snake draft order
  current_pick: number;
  season_year: number;
  created_at: string;
}

export interface LeagueMember {
  id: string;
  league_id: string;
  user_id: string;
  team_name: string;
  total_points: number;
  joined_at: string;
}

export interface Player {
  id: string;
  name: string;
  role: PlayerRole;
  franchise: string; // IPL team
  is_overseas: boolean;
  image_url: string | null;
}

export interface DraftPick {
  id: string;
  league_id: string;
  user_id: string;
  player_id: string;
  pick_number: number;
  round: number;
  picked_at: string;
}

export interface Roster {
  id: string;
  league_id: string;
  user_id: string;
  player_id: string;
  is_captain: boolean;
  is_vice_captain: boolean;
  acquired_via: "draft" | "transfer" | "waiver";
}

export interface Match {
  id: string;
  league_id: string;
  matchweek: number;
  team_home: string; // IPL franchise
  team_away: string;
  match_date: string;
  status: "upcoming" | "live" | "completed";
}

export interface PlayerScore {
  id: string;
  match_id: string;
  player_id: string;
  // Batting
  runs: number;
  balls_faced: number;
  fours: number;
  sixes: number;
  // Bowling
  overs_bowled: number;
  maidens: number;
  runs_conceded: number;
  wickets: number;
  // Fielding
  catches: number;
  stumpings: number;
  run_outs: number;
  // Computed
  fantasy_points: number;
  entered_by: string;
  entered_at: string;
}

export interface Transfer {
  id: string;
  league_id: string;
  user_id: string;
  player_in_id: string;
  player_out_id: string;
  matchweek: number;
  is_free: boolean;
  point_cost: number;
  created_at: string;
}
