import type { PlayerRole } from "@/types/database";

// Squad constraints
export const SQUAD_SIZE = 11;
export const MAX_PER_FRANCHISE = 7;
export const MAX_OVERSEAS = 4;
export const MIN_ROLE: Record<PlayerRole, number> = {
  WK: 1,
  BAT: 3,
  AR: 1,
  BOWL: 3,
};

// Snake draft: A→B→C, C→B→A, repeat
// 3 players, 11 rounds = 33 picks
export function getSnakeDraftOrder(memberIds: string[], totalRounds: number): string[] {
  const order: string[] = [];
  for (let round = 0; round < totalRounds; round++) {
    if (round % 2 === 0) {
      order.push(...memberIds);
    } else {
      order.push(...[...memberIds].reverse());
    }
  }
  return order;
}

export function getDraftPickUser(draftOrder: string[], pickNumber: number): string {
  return draftOrder[pickNumber] ?? "";
}

export function getDraftRound(pickNumber: number, numPlayers: number): number {
  return Math.floor(pickNumber / numPlayers) + 1;
}

interface RosterState {
  roles: Record<PlayerRole, number>;
  franchises: Record<string, number>;
  overseas: number;
  total: number;
}

export function getRosterState(
  picks: Array<{ role: PlayerRole; franchise: string; is_overseas: boolean }>
): RosterState {
  const state: RosterState = {
    roles: { WK: 0, BAT: 0, AR: 0, BOWL: 0 },
    franchises: {},
    overseas: 0,
    total: picks.length,
  };

  for (const p of picks) {
    state.roles[p.role]++;
    state.franchises[p.franchise] = (state.franchises[p.franchise] || 0) + 1;
    if (p.is_overseas) state.overseas++;
  }

  return state;
}

export function canPickPlayer(
  rosterState: RosterState,
  player: { role: PlayerRole; franchise: string; is_overseas: boolean }
): { allowed: boolean; reason?: string } {
  if (rosterState.total >= SQUAD_SIZE) {
    return { allowed: false, reason: "Squad is full" };
  }

  if (player.is_overseas && rosterState.overseas >= MAX_OVERSEAS) {
    return { allowed: false, reason: "Max 4 overseas players" };
  }

  const franchiseCount = rosterState.franchises[player.franchise] || 0;
  if (franchiseCount >= MAX_PER_FRANCHISE) {
    return { allowed: false, reason: `Max ${MAX_PER_FRANCHISE} from ${player.franchise}` };
  }

  // Check if picking this player would make it impossible to meet minimums
  const remainingPicks = SQUAD_SIZE - rosterState.total - 1;
  let slotsNeeded = 0;
  for (const [role, min] of Object.entries(MIN_ROLE)) {
    const deficit = min - rosterState.roles[role as PlayerRole];
    if (role !== player.role && deficit > 0) {
      slotsNeeded += deficit;
    }
  }
  if (slotsNeeded > remainingPicks) {
    return { allowed: false, reason: "Must fill minimum role requirements" };
  }

  return { allowed: true };
}
