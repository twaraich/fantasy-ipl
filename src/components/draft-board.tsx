"use client";

import { useState, useEffect, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { getDraftRound, getRosterState, canPickPlayer } from "@/lib/draft";
import type { PlayerRole } from "@/types/database";

interface DraftPick {
  id: string;
  user_id: string;
  player_id: string;
  pick_number: number;
  round: number;
  players: {
    name: string;
    role: string;
    franchise: string;
    is_overseas: boolean;
  } | null;
}

interface Player {
  id: string;
  name: string;
  role: string;
  franchise: string;
  is_overseas: boolean;
}

interface Props {
  league: {
    id: string;
    name: string;
    draft_status: string;
    draft_order: string[];
    current_pick: number;
    created_by: string;
  };
  members: Array<{ user_id: string; team_name: string }>;
  players: Player[];
  initialPicks: DraftPick[];
  currentUserId: string;
}

const ROLE_COLORS: Record<string, string> = {
  WK: "text-yellow-400",
  BAT: "text-blue-400",
  AR: "text-green-400",
  BOWL: "text-red-400",
};

const ROLE_BG: Record<string, string> = {
  WK: "bg-yellow-400/10",
  BAT: "bg-blue-400/10",
  AR: "bg-green-400/10",
  BOWL: "bg-red-400/10",
};

const PICK_TIMER_SECONDS = 90;

export function DraftBoard({ league, members, players, initialPicks, currentUserId }: Props) {
  const [picks, setPicks] = useState<DraftPick[]>(initialPicks);
  const [currentPick, setCurrentPick] = useState(league.current_pick);
  const [draftStatus, setDraftStatus] = useState(league.draft_status);
  const [filterRole, setFilterRole] = useState<string>("ALL");
  const [searchQuery, setSearchQuery] = useState("");
  const [picking, setPicking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [timer, setTimer] = useState(PICK_TIMER_SECONDS);

  const draftOrder = league.draft_order;
  const isMyTurn = draftStatus === "in_progress" && draftOrder[currentPick] === currentUserId;
  const isCreator = league.created_by === currentUserId;
  const currentPickUserId = draftOrder[currentPick];
  const currentPickerName = members.find((m) => m.user_id === currentPickUserId)?.team_name ?? "Unknown";

  // Draft pick timer
  useEffect(() => {
    if (draftStatus !== "in_progress") return;
    setTimer(PICK_TIMER_SECONDS);
    const interval = setInterval(() => {
      setTimer((t) => (t > 0 ? t - 1 : 0));
    }, 1000);
    return () => clearInterval(interval);
  }, [currentPick, draftStatus]);

  // Real-time subscription for draft picks
  useEffect(() => {
    const supabase = createClient();

    const channel = supabase
      .channel(`draft-${league.id}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "draft_picks",
          filter: `league_id=eq.${league.id}`,
        },
        async (payload) => {
          const newPick = payload.new as { id: string; user_id: string; player_id: string; pick_number: number; round: number };
          const player = players.find((p) => p.id === newPick.player_id);

          setPicks((prev) => [
            ...prev,
            {
              ...newPick,
              players: player
                ? { name: player.name, role: player.role, franchise: player.franchise, is_overseas: player.is_overseas }
                : null,
            },
          ]);
          setCurrentPick(newPick.pick_number + 1);
        }
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "leagues",
          filter: `id=eq.${league.id}`,
        },
        (payload) => {
          const updated = payload.new as { draft_status: string; current_pick: number };
          setDraftStatus(updated.draft_status);
          setCurrentPick(updated.current_pick);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [league.id, players]);

  // Get my picks
  const myPicks = picks.filter((p) => p.user_id === currentUserId);
  const myRosterState = getRosterState(
    myPicks.map((p) => ({
      role: (p.players?.role ?? "BAT") as PlayerRole,
      franchise: p.players?.franchise ?? "",
      is_overseas: p.players?.is_overseas ?? false,
    }))
  );

  // Drafted player IDs
  const draftedIds = new Set(picks.map((p) => p.player_id));

  // Filter available players
  const availablePlayers = players.filter((p) => {
    if (draftedIds.has(p.id)) return false;
    if (filterRole !== "ALL" && p.role !== filterRole) return false;
    if (searchQuery && !p.name.toLowerCase().includes(searchQuery.toLowerCase())) return false;
    return true;
  });

  const handleStartDraft = useCallback(async () => {
    const res = await fetch("/api/draft/start", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ league_id: league.id }),
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error);
      return;
    }
    setDraftStatus("in_progress");
    setCurrentPick(0);
  }, [league.id]);

  const handlePick = useCallback(async (playerId: string) => {
    if (!isMyTurn || picking) return;
    setPicking(true);
    setError(null);

    const res = await fetch("/api/draft/pick", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ league_id: league.id, player_id: playerId }),
    });
    const data = await res.json();
    setPicking(false);

    if (!res.ok) {
      setError(data.error);
      return;
    }

    if (data.draft_complete) {
      setDraftStatus("completed");
    }
  }, [isMyTurn, picking, league.id]);

  if (draftStatus === "completed") {
    return (
      <div className="px-4 py-8">
        <div className="mx-auto max-w-lg space-y-6">
          <h1 className="text-2xl font-bold text-white text-center">Draft Complete!</h1>
          <div className="space-y-4">
            {members.map((m) => {
              const memberPicks = picks
                .filter((p) => p.user_id === m.user_id)
                .sort((a, b) => a.pick_number - b.pick_number);
              return (
                <div key={m.user_id} className="rounded-2xl bg-white/5 p-4 space-y-2">
                  <h3 className="font-semibold text-white">{m.team_name}</h3>
                  {memberPicks.map((p) => (
                    <div key={p.id} className="flex items-center justify-between text-sm">
                      <span className="text-white">{p.players?.name}</span>
                      <span className={`text-xs font-mono ${ROLE_COLORS[p.players?.role ?? ""]}`}>
                        {p.players?.role} · {p.players?.franchise}
                      </span>
                    </div>
                  ))}
                </div>
              );
            })}
          </div>
          <a
            href={`/league/${league.id}`}
            className="block rounded-xl bg-indigo-500 py-3 text-center font-semibold text-white"
          >
            Back to League
          </a>
        </div>
      </div>
    );
  }

  if (draftStatus === "pending") {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center px-4">
        <div className="space-y-6 text-center">
          <h1 className="text-2xl font-bold text-white">Draft Lobby</h1>
          <p className="text-indigo-300/60">
            {members.length}/3 players joined
          </p>
          <div className="space-y-2">
            {members.map((m) => (
              <div key={m.user_id} className="rounded-xl bg-white/5 px-4 py-2 text-white">
                {m.team_name}
              </div>
            ))}
          </div>
          {isCreator && members.length === 3 && (
            <button
              onClick={handleStartDraft}
              className="rounded-xl bg-green-600 px-8 py-3 font-semibold text-white hover:bg-green-500"
            >
              Start Draft
            </button>
          )}
          {members.length < 3 && (
            <p className="text-sm text-indigo-300/40">
              Share league ID: <span className="font-mono text-indigo-300">{league.id}</span>
            </p>
          )}
        </div>
      </div>
    );
  }

  // In progress
  return (
    <div className="px-4 py-4">
      <div className="mx-auto max-w-2xl space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <h1 className="text-lg font-bold text-white">Draft — Round {getDraftRound(currentPick, 3)}</h1>
          <div className="text-right">
            <p className="text-sm text-indigo-300/60">Pick #{currentPick + 1}/33</p>
          </div>
        </div>

        {/* Current Turn Banner */}
        <div className={`rounded-xl p-4 text-center ${isMyTurn ? "bg-green-600/20 border border-green-500/30" : "bg-white/5"}`}>
          <p className="text-sm text-indigo-300/60">
            {isMyTurn ? "YOUR PICK" : `${currentPickerName}'s turn`}
          </p>
          <p className={`text-2xl font-mono font-bold ${timer <= 10 ? "text-red-400" : "text-white"}`}>
            {Math.floor(timer / 60)}:{(timer % 60).toString().padStart(2, "0")}
          </p>
        </div>

        {error && (
          <p className="text-sm text-red-400 text-center">{error}</p>
        )}

        {/* My Squad Summary */}
        <div className="flex gap-2 text-xs">
          {(["WK", "BAT", "AR", "BOWL"] as PlayerRole[]).map((role) => (
            <span
              key={role}
              className={`rounded-lg px-2 py-1 ${ROLE_BG[role]} ${ROLE_COLORS[role]}`}
            >
              {role}: {myRosterState.roles[role]}
            </span>
          ))}
          <span className="rounded-lg bg-white/5 px-2 py-1 text-indigo-300">
            OS: {myRosterState.overseas}/4
          </span>
          <span className="rounded-lg bg-white/5 px-2 py-1 text-indigo-300">
            {myPicks.length}/11
          </span>
        </div>

        {/* Filters */}
        <div className="flex gap-2">
          <input
            type="text"
            placeholder="Search players..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="flex-1 rounded-lg bg-white/10 px-3 py-2 text-sm text-white placeholder:text-indigo-300/40 focus:outline-none focus:ring-1 focus:ring-indigo-400"
          />
          <div className="flex gap-1">
            {["ALL", "WK", "BAT", "AR", "BOWL"].map((role) => (
              <button
                key={role}
                onClick={() => setFilterRole(role)}
                className={`rounded-lg px-2 py-1 text-xs font-medium transition-colors ${
                  filterRole === role
                    ? "bg-indigo-500 text-white"
                    : "bg-white/5 text-indigo-300/60 hover:bg-white/10"
                }`}
              >
                {role}
              </button>
            ))}
          </div>
        </div>

        {/* Player Pool */}
        <div className="space-y-1 max-h-[40vh] overflow-y-auto rounded-xl bg-white/[.02] p-2">
          {availablePlayers.map((player) => {
            const pickCheck = canPickPlayer(myRosterState, {
              role: player.role as PlayerRole,
              franchise: player.franchise,
              is_overseas: player.is_overseas,
            });
            const disabled = !isMyTurn || picking || !pickCheck.allowed;

            return (
              <button
                key={player.id}
                onClick={() => handlePick(player.id)}
                disabled={disabled}
                className={`flex w-full items-center justify-between rounded-lg p-3 text-left transition-colors ${
                  disabled
                    ? "opacity-40 cursor-not-allowed"
                    : "hover:bg-white/10 cursor-pointer"
                }`}
              >
                <div className="flex items-center gap-3">
                  <span className={`text-xs font-mono font-bold ${ROLE_COLORS[player.role]}`}>
                    {player.role}
                  </span>
                  <div>
                    <p className="text-sm font-medium text-white">{player.name}</p>
                    <p className="text-xs text-indigo-300/50">
                      {player.franchise}
                      {player.is_overseas && " · OS"}
                    </p>
                  </div>
                </div>
                {isMyTurn && !pickCheck.allowed && (
                  <span className="text-xs text-red-400/60">{pickCheck.reason}</span>
                )}
              </button>
            );
          })}
        </div>

        {/* Recent Picks */}
        <div className="rounded-xl bg-white/5 p-4 space-y-2">
          <h3 className="text-sm font-semibold text-indigo-300/60">Recent Picks</h3>
          {picks.length === 0 ? (
            <p className="text-sm text-indigo-300/30">No picks yet</p>
          ) : (
            [...picks]
              .reverse()
              .slice(0, 6)
              .map((p) => {
                const pickerName = members.find((m) => m.user_id === p.user_id)?.team_name;
                return (
                  <div key={p.id} className="flex items-center justify-between text-sm">
                    <span className="text-indigo-300/50">#{p.pick_number + 1} {pickerName}</span>
                    <span className="text-white">
                      {p.players?.name}{" "}
                      <span className={`text-xs ${ROLE_COLORS[p.players?.role ?? ""]}`}>
                        {p.players?.role}
                      </span>
                    </span>
                  </div>
                );
              })
          )}
        </div>
      </div>
    </div>
  );
}
