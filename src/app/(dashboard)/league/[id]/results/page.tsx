import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";

export default async function ResultsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // Get league members
  const { data: members } = await supabase
    .from("league_members")
    .select("user_id, team_name")
    .eq("league_id", id);

  if (!members?.some((m) => m.user_id === user.id)) redirect("/dashboard");

  // Get completed matches
  const { data: matches } = await supabase
    .from("matches")
    .select("*")
    .eq("league_id", id)
    .eq("status", "completed")
    .order("matchweek", { ascending: false });

  // Get all rosters with captain info
  const { data: allRosters } = await supabase
    .from("rosters")
    .select("user_id, player_id, is_captain, is_vice_captain")
    .eq("league_id", id);

  // Get all scores for completed matches
  const matchIds = (matches || []).map((m) => m.id);
  const { data: allScores } = matchIds.length > 0
    ? await supabase
        .from("player_scores")
        .select("match_id, player_id, fantasy_points")
        .in("match_id", matchIds)
    : { data: [] };

  // Build matchweek breakdown
  type MatchweekResult = {
    matchweek: number;
    matches: Array<{ team_home: string; team_away: string }>;
    scores: Record<string, number>; // user_id -> points
  };

  const matchweekMap = new Map<number, MatchweekResult>();

  for (const match of matches || []) {
    if (!matchweekMap.has(match.matchweek)) {
      matchweekMap.set(match.matchweek, {
        matchweek: match.matchweek,
        matches: [],
        scores: {},
      });
    }
    const mw = matchweekMap.get(match.matchweek)!;
    mw.matches.push({ team_home: match.team_home, team_away: match.team_away });

    // Calculate points for each member for this match
    for (const member of members) {
      const memberRoster = (allRosters || []).filter((r) => r.user_id === member.user_id);
      const rosterPlayerIds = new Set(memberRoster.map((r) => r.player_id));
      const captainId = memberRoster.find((r) => r.is_captain)?.player_id;
      const vcId = memberRoster.find((r) => r.is_vice_captain)?.player_id;

      const matchScores = (allScores || []).filter(
        (s) => s.match_id === match.id && rosterPlayerIds.has(s.player_id)
      );

      let pts = 0;
      for (const s of matchScores) {
        let p = s.fantasy_points;
        if (s.player_id === captainId) p *= 2;
        else if (s.player_id === vcId) p *= 1.5;
        pts += p;
      }

      mw.scores[member.user_id] = (mw.scores[member.user_id] || 0) + pts;
    }
  }

  const matchweeks = Array.from(matchweekMap.values()).sort(
    (a, b) => b.matchweek - a.matchweek
  );

  return (
    <div className="min-h-screen bg-gradient-to-b from-indigo-950 to-slate-900 px-4 py-8">
      <div className="mx-auto max-w-lg space-y-6">
        <Link
          href={`/league/${id}`}
          className="text-sm text-indigo-300/60 hover:text-indigo-200"
        >
          ← Back to League
        </Link>

        <h1 className="text-2xl font-bold text-white">Match Results</h1>

        {matchweeks.length === 0 ? (
          <p className="text-indigo-300/60 text-sm">No completed matches yet.</p>
        ) : (
          matchweeks.map((mw) => {
            // Sort members by matchweek score
            const sorted = [...members].sort(
              (a, b) => (mw.scores[b.user_id] || 0) - (mw.scores[a.user_id] || 0)
            );

            return (
              <div key={mw.matchweek} className="rounded-2xl bg-white/5 p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <h2 className="font-semibold text-white">Matchweek {mw.matchweek}</h2>
                  <span className="text-xs text-indigo-300/40">
                    {mw.matches.map((m) => `${m.team_home} v ${m.team_away}`).join(", ")}
                  </span>
                </div>

                {sorted.map((m, i) => {
                  const pts = mw.scores[m.user_id] || 0;
                  return (
                    <div
                      key={m.user_id}
                      className={`flex items-center justify-between rounded-xl p-3 ${
                        i === 0 ? "bg-amber-500/10" : "bg-white/5"
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <span className={`text-lg font-bold ${i === 0 ? "text-amber-400" : "text-indigo-300/50"}`}>
                          #{i + 1}
                        </span>
                        <span className="text-white font-medium">{m.team_name}</span>
                      </div>
                      <span className="text-lg font-bold text-white">{pts} pts</span>
                    </div>
                  );
                })}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
