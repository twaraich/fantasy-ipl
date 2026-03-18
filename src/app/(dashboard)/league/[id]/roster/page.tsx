"use client";

import { createClient } from "@/lib/supabase/client";
import { useParams, useRouter } from "next/navigation";
import { useState, useEffect } from "react";

interface RosterPlayer {
  id: string;
  player_id: string;
  is_captain: boolean;
  is_vice_captain: boolean;
  players: {
    name: string;
    role: string;
    franchise: string;
    is_overseas: boolean;
  };
}

const ROLE_COLORS: Record<string, string> = {
  WK: "text-yellow-400",
  BAT: "text-blue-400",
  AR: "text-green-400",
  BOWL: "text-red-400",
};

export default function RosterPage() {
  const params = useParams();
  const router = useRouter();
  const leagueId = params.id as string;
  const [roster, setRoster] = useState<RosterPlayer[]>([]);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data } = await supabase
        .from("rosters")
        .select("id, player_id, is_captain, is_vice_captain, players(name, role, franchise, is_overseas)")
        .eq("league_id", leagueId)
        .eq("user_id", user.id);

      if (data) setRoster(data as unknown as RosterPlayer[]);
    }
    load();
  }, [leagueId]);

  async function setCaptain(playerId: string, type: "captain" | "vice_captain") {
    setSaving(true);
    setMessage(null);
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const field = type === "captain" ? "is_captain" : "is_vice_captain";
    const otherField = type === "captain" ? "is_vice_captain" : "is_captain";

    // Clear existing
    await supabase
      .from("rosters")
      .update({ [field]: false })
      .eq("league_id", leagueId)
      .eq("user_id", user.id);

    // Check the player isn't already the other role
    const player = roster.find((r) => r.player_id === playerId);
    if (player && player[otherField]) {
      await supabase
        .from("rosters")
        .update({ [otherField]: false })
        .eq("league_id", leagueId)
        .eq("user_id", user.id)
        .eq("player_id", playerId);
    }

    // Set new
    await supabase
      .from("rosters")
      .update({ [field]: true })
      .eq("league_id", leagueId)
      .eq("user_id", user.id)
      .eq("player_id", playerId);

    // Refresh
    const { data } = await supabase
      .from("rosters")
      .select("id, player_id, is_captain, is_vice_captain, players(name, role, franchise, is_overseas)")
      .eq("league_id", leagueId)
      .eq("user_id", user.id);

    if (data) setRoster(data as unknown as RosterPlayer[]);
    setMessage(`${type === "captain" ? "Captain" : "Vice-Captain"} updated!`);
    setSaving(false);
  }

  // Group by role
  const grouped: Record<string, RosterPlayer[]> = { WK: [], BAT: [], AR: [], BOWL: [] };
  for (const r of roster) {
    const role = r.players?.role ?? "BAT";
    if (grouped[role]) grouped[role].push(r);
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-indigo-950 to-slate-900 px-4 py-8">
      <div className="mx-auto max-w-lg space-y-6">
        <button
          onClick={() => router.push(`/league/${leagueId}`)}
          className="text-sm text-indigo-300/60 hover:text-indigo-200"
        >
          ← Back to League
        </button>

        <h1 className="text-2xl font-bold text-white">My Squad</h1>
        <p className="text-sm text-indigo-300/40">Tap C or VC to set Captain (2x) or Vice-Captain (1.5x)</p>

        {message && <p className="text-sm text-green-400">{message}</p>}

        {Object.entries(grouped).map(([role, players]) => (
          <div key={role} className="space-y-2">
            <h2 className={`text-sm font-semibold ${ROLE_COLORS[role]}`}>
              {role === "WK" ? "Wicket-Keeper" : role === "BAT" ? "Batters" : role === "AR" ? "All-Rounders" : "Bowlers"}
            </h2>
            {players.map((r) => (
              <div
                key={r.id}
                className="flex items-center justify-between rounded-xl bg-white/5 p-3"
              >
                <div>
                  <p className="font-medium text-white">
                    {r.players.name}
                    {r.is_captain && <span className="ml-2 text-xs font-bold text-amber-400">(C)</span>}
                    {r.is_vice_captain && <span className="ml-2 text-xs font-bold text-amber-400">(VC)</span>}
                  </p>
                  <p className="text-xs text-indigo-300/50">
                    {r.players.franchise}
                    {r.players.is_overseas && " · Overseas"}
                  </p>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => setCaptain(r.player_id, "captain")}
                    disabled={saving || r.is_captain}
                    className={`rounded-lg px-2 py-1 text-xs font-bold transition-colors ${
                      r.is_captain
                        ? "bg-amber-500 text-black"
                        : "bg-white/10 text-indigo-300 hover:bg-amber-500/20"
                    }`}
                  >
                    C
                  </button>
                  <button
                    onClick={() => setCaptain(r.player_id, "vice_captain")}
                    disabled={saving || r.is_vice_captain}
                    className={`rounded-lg px-2 py-1 text-xs font-bold transition-colors ${
                      r.is_vice_captain
                        ? "bg-amber-500 text-black"
                        : "bg-white/10 text-indigo-300 hover:bg-amber-500/20"
                    }`}
                  >
                    VC
                  </button>
                </div>
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
