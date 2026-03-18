"use client";

import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import { useState } from "react";

export default function CreateLeaguePage() {
  const router = useRouter();
  const [leagueName, setLeagueName] = useState("");
  const [teamName, setTeamName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    // Create league
    const { data: league, error: leagueError } = await supabase
      .from("leagues")
      .insert({ name: leagueName, created_by: user.id })
      .select()
      .single();

    if (leagueError) {
      setError(leagueError.message);
      setLoading(false);
      return;
    }

    // Join as first member
    const { error: memberError } = await supabase
      .from("league_members")
      .insert({
        league_id: league.id,
        user_id: user.id,
        team_name: teamName,
      });

    if (memberError) {
      setError(memberError.message);
      setLoading(false);
      return;
    }

    router.push(`/league/${league.id}`);
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

        <h1 className="text-2xl font-bold text-white">Create League</h1>

        <form onSubmit={handleCreate} className="space-y-4">
          <input
            type="text"
            placeholder="League Name"
            value={leagueName}
            onChange={(e) => setLeagueName(e.target.value)}
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
            {loading ? "Creating..." : "Create League"}
          </button>
        </form>

        <p className="text-sm text-indigo-300/40">
          After creating, share the league ID with your friends so they can join.
        </p>
      </div>
    </div>
  );
}
