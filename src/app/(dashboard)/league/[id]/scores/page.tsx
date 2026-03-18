"use client";

import { createClient } from "@/lib/supabase/client";
import { useParams, useRouter } from "next/navigation";
import { useState, useEffect } from "react";
import { calculateFantasyPoints } from "@/lib/scoring";

interface Player {
  id: string;
  name: string;
  role: string;
  franchise: string;
}

interface Match {
  id: string;
  matchweek: number;
  team_home: string;
  team_away: string;
  match_date: string;
  status: string;
}

export default function ScoresPage() {
  const params = useParams();
  const router = useRouter();
  const leagueId = params.id as string;
  const [matches, setMatches] = useState<Match[]>([]);
  const [selectedMatch, setSelectedMatch] = useState<string | null>(null);
  const [matchPlayers, setMatchPlayers] = useState<Player[]>([]);
  const [selectedPlayer, setSelectedPlayer] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  // Score form state
  const [runs, setRuns] = useState(0);
  const [ballsFaced, setBallsFaced] = useState(0);
  const [fours, setFours] = useState(0);
  const [sixes, setSixes] = useState(0);
  const [oversBowled, setOversBowled] = useState(0);
  const [maidens, setMaidens] = useState(0);
  const [runsConceded, setRunsConceded] = useState(0);
  const [wickets, setWickets] = useState(0);
  const [catches, setCatches] = useState(0);
  const [stumpings, setStumpings] = useState(0);
  const [runOuts, setRunOuts] = useState(0);

  useEffect(() => {
    async function loadMatches() {
      const supabase = createClient();
      const { data } = await supabase
        .from("matches")
        .select("*")
        .eq("league_id", leagueId)
        .order("match_date", { ascending: false });
      if (data) setMatches(data);
    }
    loadMatches();
  }, [leagueId]);

  useEffect(() => {
    if (!selectedMatch) return;
    async function loadPlayers() {
      const supabase = createClient();
      const match = matches.find((m) => m.id === selectedMatch);
      if (!match) return;

      const { data } = await supabase
        .from("players")
        .select("id, name, role, franchise")
        .in("franchise", [match.team_home, match.team_away])
        .order("name");
      if (data) setMatchPlayers(data);
    }
    loadPlayers();
  }, [selectedMatch, matches]);

  function resetForm() {
    setRuns(0); setBallsFaced(0); setFours(0); setSixes(0);
    setOversBowled(0); setMaidens(0); setRunsConceded(0); setWickets(0);
    setCatches(0); setStumpings(0); setRunOuts(0);
  }

  async function handleSaveScore() {
    if (!selectedMatch || !selectedPlayer) return;
    setSaving(true);
    setMessage(null);

    const stats = {
      runs, balls_faced: ballsFaced, fours, sixes,
      overs_bowled: oversBowled, maidens, runs_conceded: runsConceded, wickets,
      catches, stumpings, run_outs: runOuts,
    };

    const fantasyPoints = calculateFantasyPoints(stats);

    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { error } = await supabase.from("player_scores").upsert(
      {
        match_id: selectedMatch,
        player_id: selectedPlayer,
        ...stats,
        fantasy_points: fantasyPoints,
        entered_by: user.id,
      },
      { onConflict: "match_id,player_id" }
    );

    setSaving(false);

    if (error) {
      setMessage(`Error: ${error.message}`);
    } else {
      setMessage(`Saved! ${matchPlayers.find((p) => p.id === selectedPlayer)?.name}: ${fantasyPoints} pts`);
      resetForm();
      setSelectedPlayer(null);
    }
  }

  const previewPoints = calculateFantasyPoints({
    runs, balls_faced: ballsFaced, fours, sixes,
    overs_bowled: oversBowled, maidens, runs_conceded: runsConceded, wickets,
    catches, stumpings, run_outs: runOuts,
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

        <h1 className="text-2xl font-bold text-white">Enter Scores</h1>

        {message && (
          <p className={`text-sm ${message.startsWith("Error") ? "text-red-400" : "text-green-400"}`}>
            {message}
          </p>
        )}

        {/* Match selection */}
        <select
          value={selectedMatch ?? ""}
          onChange={(e) => { setSelectedMatch(e.target.value || null); setSelectedPlayer(null); resetForm(); }}
          className="w-full rounded-xl bg-white/10 px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-indigo-400"
        >
          <option value="" className="bg-slate-800">Select Match</option>
          {matches.map((m) => (
            <option key={m.id} value={m.id} className="bg-slate-800">
              MW{m.matchweek}: {m.team_home} vs {m.team_away}
            </option>
          ))}
        </select>

        {/* Player selection */}
        {selectedMatch && (
          <select
            value={selectedPlayer ?? ""}
            onChange={(e) => { setSelectedPlayer(e.target.value || null); resetForm(); }}
            className="w-full rounded-xl bg-white/10 px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-indigo-400"
          >
            <option value="" className="bg-slate-800">Select Player</option>
            {matchPlayers.map((p) => (
              <option key={p.id} value={p.id} className="bg-slate-800">
                {p.name} ({p.role})
              </option>
            ))}
          </select>
        )}

        {/* Score form */}
        {selectedPlayer && (
          <div className="space-y-4">
            <div className="rounded-xl bg-white/5 p-4 space-y-3">
              <h3 className="text-sm font-semibold text-blue-400">Batting</h3>
              <div className="grid grid-cols-2 gap-3">
                <NumberInput label="Runs" value={runs} onChange={setRuns} />
                <NumberInput label="Balls Faced" value={ballsFaced} onChange={setBallsFaced} />
                <NumberInput label="4s" value={fours} onChange={setFours} />
                <NumberInput label="6s" value={sixes} onChange={setSixes} />
              </div>
            </div>

            <div className="rounded-xl bg-white/5 p-4 space-y-3">
              <h3 className="text-sm font-semibold text-red-400">Bowling</h3>
              <div className="grid grid-cols-2 gap-3">
                <NumberInput label="Overs" value={oversBowled} onChange={setOversBowled} step={0.1} />
                <NumberInput label="Maidens" value={maidens} onChange={setMaidens} />
                <NumberInput label="Runs Given" value={runsConceded} onChange={setRunsConceded} />
                <NumberInput label="Wickets" value={wickets} onChange={setWickets} />
              </div>
            </div>

            <div className="rounded-xl bg-white/5 p-4 space-y-3">
              <h3 className="text-sm font-semibold text-green-400">Fielding</h3>
              <div className="grid grid-cols-3 gap-3">
                <NumberInput label="Catches" value={catches} onChange={setCatches} />
                <NumberInput label="Stumpings" value={stumpings} onChange={setStumpings} />
                <NumberInput label="Run Outs" value={runOuts} onChange={setRunOuts} />
              </div>
            </div>

            <div className="flex items-center justify-between rounded-xl bg-indigo-500/10 border border-indigo-400/20 p-4">
              <span className="text-indigo-200 font-medium">Fantasy Points</span>
              <span className="text-2xl font-bold text-white">{previewPoints}</span>
            </div>

            <button
              onClick={handleSaveScore}
              disabled={saving}
              className="w-full rounded-xl bg-indigo-500 py-3 font-semibold text-white transition-colors hover:bg-indigo-400 disabled:opacity-50"
            >
              {saving ? "Saving..." : "Save Score"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function NumberInput({
  label,
  value,
  onChange,
  step = 1,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  step?: number;
}) {
  return (
    <div>
      <label className="text-xs text-indigo-300/50">{label}</label>
      <input
        type="number"
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        min={0}
        step={step}
        className="w-full rounded-lg bg-white/10 px-3 py-2 text-white text-sm focus:outline-none focus:ring-1 focus:ring-indigo-400"
      />
    </div>
  );
}
