"use client";

import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import { useState } from "react";

export default function JoinLeaguePage() {
  const router = useRouter();
  const [leagueId, setLeagueId] = useState("");
  const [teamName, setTeamName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleJoin(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    // Check league exists and has room (max 3 players)
    const { data: members } = await supabase
      .from("league_members")
      .select("id")
      .eq("league_id", leagueId);

    if (members && members.length >= 3) {
      setError("This league is full (3/3 players).");
      setLoading(false);
      return;
    }

    const { error: joinError } = await supabase
      .from("league_members")
      .insert({
        league_id: leagueId,
        user_id: user.id,
        team_name: teamName,
      });

    if (joinError) {
      setError(joinError.message.includes("violates")
        ? "Already in this league or invalid league ID."
        : joinError.message);
      setLoading(false);
      return;
    }

    router.push(`/league/${leagueId}`);
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-indigo-950 to-slate-900 px-4 py-8">
      <div className="mx-auto max-w-sm space-y-6">
        <button
          onClick={() => router.back()}
          className="text-sm text-indigo-300/60 hover:text-indigo-200"
        >
          ← Back
        </button>

        <h1 className="text-2xl font-bold text-white">Join League</h1>

        <form onSubmit={handleJoin} className="space-y-4">
          <input
            type="text"
            placeholder="League ID"
            value={leagueId}
            onChange={(e) => setLeagueId(e.target.value)}
            required
            className="w-full rounded-xl bg-white/10 px-4 py-3 text-white placeholder:text-indigo-300/50 focus:outline-none focus:ring-2 focus:ring-indigo-400"
          />
          <input
            type="text"
            placeholder="Your Team Name"
            value={teamName}
            onChange={(e) => setTeamName(e.target.value)}
            required
            className="w-full rounded-xl bg-white/10 px-4 py-3 text-white placeholder:text-indigo-300/50 focus:outline-none focus:ring-2 focus:ring-indigo-400"
          />

          {error && <p className="text-sm text-red-400">{error}</p>}

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-xl bg-indigo-500 py-3 font-semibold text-white transition-colors hover:bg-indigo-400 disabled:opacity-50"
          >
            {loading ? "Joining..." : "Join League"}
          </button>
        </form>

        <p className="text-sm text-indigo-300/40">
          Ask the league creator for the league ID.
        </p>
      </div>
    </div>
  );
}
