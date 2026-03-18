import type { PlayerScore } from "@/types/database";

// Dream11-style scoring rules
const SCORING = {
  // Batting
  run: 1,
  four_bonus: 1, // extra per boundary
  six_bonus: 2, // extra per six
  half_century: 8,
  century: 16,
  duck: -2, // BAT/WK/AR only

  // Strike rate bonus/penalty (min 10 balls)
  sr_above_170: 6,
  sr_150_170: 4,
  sr_130_150: 2,
  sr_60_70: -2,
  sr_50_60: -4,
  sr_below_50: -6,

  // Bowling
  wicket: 25,
  lbw_bowled_bonus: 8, // not tracked separately for now
  three_wickets: 4,
  four_wickets: 8,
  five_wickets: 16,
  maiden: 12,

  // Economy rate bonus/penalty (min 2 overs)
  eco_below_5: 6,
  eco_5_6: 4,
  eco_6_7: 2,
  eco_10_11: -2,
  eco_11_12: -4,
  eco_above_12: -6,

  // Fielding
  catch: 8,
  stumping: 12,
  run_out: 6, // direct hit — simplified

  // Captain/VC multipliers
  captain_multiplier: 2,
  vice_captain_multiplier: 1.5,
} as const;

export function calculateFantasyPoints(score: Omit<PlayerScore, "id" | "match_id" | "player_id" | "fantasy_points" | "entered_by" | "entered_at">): number {
  let points = 0;

  // Batting
  points += score.runs * SCORING.run;
  points += score.fours * SCORING.four_bonus;
  points += score.sixes * SCORING.six_bonus;
  if (score.runs >= 100) points += SCORING.century;
  else if (score.runs >= 50) points += SCORING.half_century;

  // Strike rate (min 10 balls)
  if (score.balls_faced >= 10) {
    const sr = (score.runs / score.balls_faced) * 100;
    if (sr > 170) points += SCORING.sr_above_170;
    else if (sr >= 150) points += SCORING.sr_150_170;
    else if (sr >= 130) points += SCORING.sr_130_150;
    else if (sr >= 60 && sr < 70) points += SCORING.sr_60_70;
    else if (sr >= 50 && sr < 60) points += SCORING.sr_50_60;
    else if (sr < 50) points += SCORING.sr_below_50;
  }

  // Duck (0 runs, faced at least 1 ball)
  if (score.runs === 0 && score.balls_faced > 0) {
    points += SCORING.duck;
  }

  // Bowling
  points += score.wickets * SCORING.wicket;
  if (score.wickets >= 5) points += SCORING.five_wickets;
  else if (score.wickets >= 4) points += SCORING.four_wickets;
  else if (score.wickets >= 3) points += SCORING.three_wickets;
  points += score.maidens * SCORING.maiden;

  // Economy rate (min 2 overs)
  if (score.overs_bowled >= 2) {
    const eco = score.runs_conceded / score.overs_bowled;
    if (eco < 5) points += SCORING.eco_below_5;
    else if (eco < 6) points += SCORING.eco_5_6;
    else if (eco < 7) points += SCORING.eco_6_7;
    else if (eco >= 10 && eco < 11) points += SCORING.eco_10_11;
    else if (eco >= 11 && eco < 12) points += SCORING.eco_11_12;
    else if (eco >= 12) points += SCORING.eco_above_12;
  }

  // Fielding
  points += score.catches * SCORING.catch;
  points += score.stumpings * SCORING.stumping;
  points += score.run_outs * SCORING.run_out;

  return points;
}

export { SCORING };
