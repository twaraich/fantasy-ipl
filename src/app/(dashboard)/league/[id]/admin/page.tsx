"use client";

import { createClient } from "@/lib/supabase/client";
import { useParams, useRouter } from "next/navigation";
import { useState, useEffect } from "react";

const IPL_TEAMS = ["CSK", "MI", "RCB", "KKR", "RR", "DC", "PBKS", "GT", "LSG", "SRH"];

interface Match {
  id: string;
  matchweek: number;
  team_home: string;
  team_away: string;
  match_date: string;
  status: string;
}

export default function AdminPage() {
  const params = useParams();
  const router = useRouter();
  const leagueId = params.id as string;

  const [isCreator, setIsCreator] = useState(false);
  const [matches, setMatches] = useState<Match[]>([]);
  const [message, setMessage] = useState<string | null>(null);

  // New match form
  const [matchweek, setMatchweek] = useState(1);
  const [teamHome, setTeamHome] = useState(IPL_TEAMS[0]);
  const [teamAway, setTeamAway] = useState(IPL_TEAMS[1]);
  const [matchDate, setMatchDate] = useState("");
  const [addingMatch, setAddingMatch] = useState(false);

  useEffect(() => {
    loadData();
  }, [leagueId]); // eslint-disable-line react-hooks/exhaustive-deps

  async function loadData() {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data: league } = await supabase
      .from("leagues")
      .select("created_by")
      .eq("id", leagueId)
      .single();

    if (!league || league.created_by !== user.id) {
      router.push(`/league/${leagueId}`);
      return;
    }
    setIsCreator(true);

    const { data: matchData } = await supabase
      .from("matches")
      .select("*")
      .eq("league_id", leagueId)
      .order("matchweek")
      .order("match_date");

    if (matchData) setMatches(matchData);
  }

  async function handleAddMatch(e: React.FormEvent) {
    e.preventDefault();
    setAddingMatch(true);
    setMessage(null);

    if (teamHome === teamAway) {
      setMessage("Error: Teams must be different");
      setAddingMatch(false);
      return;
    }

    const res = await fetch("/api/matches", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        league_id: leagueId,
        matchweek,
        team_home: teamHome,
        team_away: teamAway,
        match_date: matchDate,
      }),
    });

    const data = await res.json();
    setAddingMatch(false);

    if (!res.ok) {
      setMessage(`Error: ${data.error}`);
      return;
    }

    setMessage("Match added!");
    loadData();
  }

  async function handleStatusChange(matchId: string, newStatus: string) {
    setMessage(null);
    const res = await fetch(`/api/matches/${matchId}/status`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: newStatus }),
    });

    if (!res.ok) {
      const data = await res.json();
      setMessage(`Error: ${data.error}`);
      return;
    }

    if (newStatus === "completed") {
      setMessage("Match completed! Points recalculated.");
    }
    loadData();
  }

  if (!isCreator) return null;

  const STATUS_STYLES: Record<string, string> = {
    upcoming: "bg-blue-500/20 text-blue-300",
    live: "bg-amber-500/20 text-amber-300",
    completed: "bg-green-500/20 text-green-300",
  };

  // Group matches by matchweek
  const grouped = new Map<number, Match[]>();
  for (const m of matches) {
    if (!grouped.has(m.matchweek)) grouped.set(m.matchweek, []);
    grouped.get(m.matchweek)!.push(m);
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

        <h1 className="text-2xl font-bold text-white">League Admin</h1>

        {message && (
          <p className={`text-sm ${message.startsWith("Error") ? "text-red-400" : "text-green-400"}`}>
            {message}
          </p>
        )}

        {/* Add Match */}
        <div className="rounded-2xl bg-white/5 p-4 space-y-3">
          <h2 className="text-lg font-semibold text-white">Add Match</h2>
          <form onSubmit={handleAddMatch} className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-indigo-300/50">Matchweek</label>
                <input
                  type="number"
                  value={matchweek}
                  onChange={(e) => setMatchweek(Number(e.target.value))}
                  min={1}
                  className="w-full rounded-lg bg-white/10 px-3 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-indigo-400"
                />
              </div>
              <div>
                <label className="text-xs text-indigo-300/50">Date & Time</label>
                <input
                  type="datetime-local"
                  value={matchDate}
                  onChange={(e) => setMatchDate(e.target.value)}
                  required
                  className="w-full rounded-lg bg-white/10 px-3 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-indigo-400"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-indigo-300/50">Home Team</label>
                <select
                  value={teamHome}
                  onChange={(e) => setTeamHome(e.target.value)}
                  className="w-full rounded-lg bg-white/10 px-3 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-indigo-400"
                >
                  {IPL_TEAMS.map((t) => (
                    <option key={t} value={t} className="bg-slate-800">{t}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs text-indigo-300/50">Away Team</label>
                <select
                  value={teamAway}
                  onChange={(e) => setTeamAway(e.target.value)}
                  className="w-full rounded-lg bg-white/10 px-3 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-indigo-400"
                >
                  {IPL_TEAMS.map((t) => (
                    <option key={t} value={t} className="bg-slate-800">{t}</option>
                  ))}
                </select>
              </div>
            </div>
            <button
              type="submit"
              disabled={addingMatch}
              className="w-full rounded-xl bg-indigo-500 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-indigo-400 disabled:opacity-50"
            >
              {addingMatch ? "Adding..." : "Add Match"}
            </button>
          </form>
        </div>

        {/* Match List */}
        <div className="space-y-4">
          <h2 className="text-lg font-semibold text-white">Matches</h2>
          {Array.from(grouped.entries()).map(([mw, mwMatches]) => (
            <div key={mw} className="rounded-2xl bg-white/5 p-4 space-y-2">
              <h3 className="text-sm font-semibold text-indigo-300/60">Matchweek {mw}</h3>
              {mwMatches.map((m) => (
                <div key={m.id} className="flex items-center justify-between rounded-xl bg-white/5 p-3">
                  <div>
                    <p className="text-sm font-medium text-white">
                      {m.team_home} vs {m.team_away}
                    </p>
                    <p className="text-xs text-indigo-300/40">
                      {new Date(m.match_date).toLocaleDateString("en-IN", {
                        day: "numeric",
                        month: "short",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_STYLES[m.status]}`}>
                      {m.status}
                    </span>
                    {m.status === "upcoming" && (
                      <button
                        onClick={() => handleStatusChange(m.id, "live")}
                        className="rounded-lg bg-amber-500/20 px-2 py-1 text-xs text-amber-300 hover:bg-amber-500/30"
                      >
                        Start
                      </button>
                    )}
                    {m.status === "live" && (
                      <button
                        onClick={() => handleStatusChange(m.id, "completed")}
                        className="rounded-lg bg-green-500/20 px-2 py-1 text-xs text-green-300 hover:bg-green-500/30"
                      >
                        Complete
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ))}
          {matches.length === 0 && (
            <p className="text-sm text-indigo-300/40">No matches added yet.</p>
          )}
        </div>
      </div>
    </div>
  );
}
