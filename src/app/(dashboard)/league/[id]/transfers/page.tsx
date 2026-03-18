"use client";

import { createClient } from "@/lib/supabase/client";
import { useParams, useRouter } from "next/navigation";
import { useState, useEffect } from "react";

interface RosterPlayer {
  player_id: string;
  players: { name: string; role: string; franchise: string; is_overseas: boolean };
}

interface AvailablePlayer {
  id: string;
  name: string;
  role: string;
  franchise: string;
  is_overseas: boolean;
}

interface TransferRecord {
  id: string;
  matchweek: number;
  is_free: boolean;
  point_cost: number;
  created_at: string;
  player_in: { name: string; role: string } | null;
  player_out: { name: string; role: string } | null;
}

const ROLE_COLORS: Record<string, string> = {
  WK: "text-yellow-400", BAT: "text-blue-400", AR: "text-green-400", BOWL: "text-red-400",
};

export default function TransfersPage() {
  const params = useParams();
  const router = useRouter();
  const leagueId = params.id as string;

  const [roster, setRoster] = useState<RosterPlayer[]>([]);
  const [available, setAvailable] = useState<AvailablePlayer[]>([]);
  const [history, setHistory] = useState<TransferRecord[]>([]);
  const [selectedOut, setSelectedOut] = useState<string | null>(null);
  const [selectedIn, setSelectedIn] = useState<string | null>(null);
  const [matchweek, setMatchweek] = useState(1);
  const [transfersUsed, setTransfersUsed] = useState(0);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [filterRole, setFilterRole] = useState("ALL");
  const [search, setSearch] = useState("");

  useEffect(() => {
    loadData();
  }, [leagueId]); // eslint-disable-line react-hooks/exhaustive-deps

  async function loadData() {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    // Load roster
    const { data: rosterData } = await supabase
      .from("rosters")
      .select("player_id, players(name, role, franchise, is_overseas)")
      .eq("league_id", leagueId)
      .eq("user_id", user.id);

    if (rosterData) setRoster(rosterData as unknown as RosterPlayer[]);

    // Load all rostered player IDs in this league
    const { data: allRostered } = await supabase
      .from("rosters")
      .select("player_id")
      .eq("league_id", leagueId);

    const rosteredIds = new Set((allRostered || []).map((r) => r.player_id));

    // Load all players
    const { data: allPlayers } = await supabase
      .from("players")
      .select("id, name, role, franchise, is_overseas")
      .order("name");

    if (allPlayers) {
      setAvailable(allPlayers.filter((p) => !rosteredIds.has(p.id)));
    }

    // Load transfer history
    const { data: transfers } = await supabase
      .from("transfers")
      .select(`
        id, matchweek, is_free, point_cost, created_at,
        player_in:player_in_id(name, role),
        player_out:player_out_id(name, role)
      `)
      .eq("league_id", leagueId)
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });

    if (transfers) setHistory(transfers as unknown as TransferRecord[]);

    // Count transfers this matchweek
    const { count } = await supabase
      .from("transfers")
      .select("id", { count: "exact" })
      .eq("league_id", leagueId)
      .eq("user_id", user.id)
      .eq("matchweek", matchweek);

    setTransfersUsed(count ?? 0);
  }

  async function handleTransfer() {
    if (!selectedOut || !selectedIn) return;
    setLoading(true);
    setMessage(null);

    const res = await fetch("/api/transfers", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        league_id: leagueId,
        player_in_id: selectedIn,
        player_out_id: selectedOut,
        matchweek,
      }),
    });

    const data = await res.json();
    setLoading(false);

    if (!res.ok) {
      setMessage(`Error: ${data.error}`);
      return;
    }

    setMessage(
      data.is_free
        ? "Transfer complete! (Free)"
        : `Transfer complete! (-${data.point_cost} pts)`
    );
    setSelectedOut(null);
    setSelectedIn(null);
    setTransfersUsed(data.transfers_used);
    loadData();
  }

  const filteredAvailable = available.filter((p) => {
    if (filterRole !== "ALL" && p.role !== filterRole) return false;
    if (search && !p.name.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  return (
    <div className="min-h-screen bg-gradient-to-b from-indigo-950 to-slate-900 px-4 py-8">
      <div className="mx-auto max-w-lg space-y-6">
        <button
          onClick={() => router.push(`/league/${leagueId}`)}
          className="text-sm text-indigo-300/60 hover:text-indigo-200"
        >
          ← Back to League
        </button>

        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-white">Transfers</h1>
          <div className="flex items-center gap-2">
            <label className="text-sm text-indigo-300/60">MW</label>
            <input
              type="number"
              value={matchweek}
              onChange={(e) => setMatchweek(Number(e.target.value))}
              min={1}
              className="w-16 rounded-lg bg-white/10 px-2 py-1 text-sm text-white text-center focus:outline-none focus:ring-1 focus:ring-indigo-400"
            />
          </div>
        </div>

        <div className="flex gap-4 text-sm">
          <span className="text-indigo-300/60">
            Free transfers: <span className="text-white font-bold">{Math.max(0, 2 - transfersUsed)}/2</span>
          </span>
          {transfersUsed >= 2 && (
            <span className="text-amber-400">Next transfer: -4 pts</span>
          )}
        </div>

        {message && (
          <p className={`text-sm ${message.startsWith("Error") ? "text-red-400" : "text-green-400"}`}>
            {message}
          </p>
        )}

        {/* Step 1: Select player to drop */}
        <div className="rounded-2xl bg-white/5 p-4 space-y-3">
          <h2 className="text-sm font-semibold text-red-400">Transfer Out</h2>
          <div className="space-y-1">
            {roster.map((r) => (
              <button
                key={r.player_id}
                onClick={() => setSelectedOut(selectedOut === r.player_id ? null : r.player_id)}
                className={`flex w-full items-center justify-between rounded-lg p-3 text-left transition-colors ${
                  selectedOut === r.player_id
                    ? "bg-red-500/20 border border-red-500/30"
                    : "bg-white/5 hover:bg-white/10"
                }`}
              >
                <div>
                  <p className="text-sm font-medium text-white">{r.players.name}</p>
                  <p className="text-xs text-indigo-300/50">
                    {r.players.franchise} {r.players.is_overseas && "· OS"}
                  </p>
                </div>
                <span className={`text-xs font-mono ${ROLE_COLORS[r.players.role]}`}>
                  {r.players.role}
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* Step 2: Select player to add */}
        {selectedOut && (
          <div className="rounded-2xl bg-white/5 p-4 space-y-3">
            <h2 className="text-sm font-semibold text-green-400">Transfer In</h2>

            <div className="flex gap-2">
              <input
                type="text"
                placeholder="Search..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="flex-1 rounded-lg bg-white/10 px-3 py-2 text-sm text-white placeholder:text-indigo-300/40 focus:outline-none focus:ring-1 focus:ring-indigo-400"
              />
              <div className="flex gap-1">
                {["ALL", "WK", "BAT", "AR", "BOWL"].map((r) => (
                  <button
                    key={r}
                    onClick={() => setFilterRole(r)}
                    className={`rounded-lg px-2 py-1 text-xs ${
                      filterRole === r ? "bg-indigo-500 text-white" : "bg-white/5 text-indigo-300/60"
                    }`}
                  >
                    {r}
                  </button>
                ))}
              </div>
            </div>

            <div className="max-h-[30vh] overflow-y-auto space-y-1">
              {filteredAvailable.map((p) => (
                <button
                  key={p.id}
                  onClick={() => setSelectedIn(selectedIn === p.id ? null : p.id)}
                  className={`flex w-full items-center justify-between rounded-lg p-3 text-left transition-colors ${
                    selectedIn === p.id
                      ? "bg-green-500/20 border border-green-500/30"
                      : "hover:bg-white/10"
                  }`}
                >
                  <div>
                    <p className="text-sm font-medium text-white">{p.name}</p>
                    <p className="text-xs text-indigo-300/50">
                      {p.franchise} {p.is_overseas && "· OS"}
                    </p>
                  </div>
                  <span className={`text-xs font-mono ${ROLE_COLORS[p.role]}`}>{p.role}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Confirm */}
        {selectedOut && selectedIn && (
          <button
            onClick={handleTransfer}
            disabled={loading}
            className="w-full rounded-xl bg-indigo-500 py-3 font-semibold text-white transition-colors hover:bg-indigo-400 disabled:opacity-50"
          >
            {loading ? "Processing..." : "Confirm Transfer"}
          </button>
        )}

        {/* Transfer History */}
        {history.length > 0 && (
          <div className="rounded-2xl bg-white/5 p-4 space-y-3">
            <h2 className="text-sm font-semibold text-indigo-300/60">Transfer History</h2>
            {history.map((t) => (
              <div key={t.id} className="flex items-center justify-between text-sm rounded-lg bg-white/5 p-3">
                <div>
                  <p className="text-green-400 text-xs">IN: {t.player_in?.name} ({t.player_in?.role})</p>
                  <p className="text-red-400 text-xs">OUT: {t.player_out?.name} ({t.player_out?.role})</p>
                </div>
                <div className="text-right">
                  <p className="text-xs text-indigo-300/50">MW {t.matchweek}</p>
                  <p className={`text-xs ${t.is_free ? "text-green-400" : "text-amber-400"}`}>
                    {t.is_free ? "Free" : `-${t.point_cost} pts`}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
