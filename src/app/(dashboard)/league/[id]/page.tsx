import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";

export default async function LeaguePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const [
    { data: league },
    { data: members },
    { data: myRoster },
  ] = await Promise.all([
    supabase.from("leagues").select("*").eq("id", id).single(),
    supabase
      .from("league_members")
      .select("*")
      .eq("league_id", id)
      .order("total_points", { ascending: false }),
    supabase
      .from("rosters")
      .select("*, players(*)")
      .eq("league_id", id)
      .eq("user_id", user.id),
  ]);

  if (!league) redirect("/dashboard");

  const isMember = members?.some((m) => m.user_id === user.id);
  if (!isMember) redirect("/dashboard");

  const isCreator = league.created_by === user.id;

  return (
    <div className="min-h-screen bg-gradient-to-b from-indigo-950 to-slate-900 px-4 py-8">
      <div className="mx-auto max-w-lg space-y-6">
        <div className="flex items-center justify-between">
          <Link
            href="/dashboard"
            className="text-sm text-indigo-300/60 hover:text-indigo-200"
          >
            ← Dashboard
          </Link>
        </div>

        <div>
          <h1 className="text-2xl font-bold text-white">{league.name}</h1>
          <p className="text-sm text-indigo-300/40 font-mono">ID: {id}</p>
        </div>

        {/* Leaderboard */}
        <div className="rounded-2xl bg-white/5 p-5 space-y-3">
          <h2 className="text-lg font-semibold text-white">Leaderboard</h2>
          {members?.map((m, i) => (
            <div
              key={m.id}
              className="flex items-center justify-between rounded-xl bg-white/5 p-3"
            >
              <div className="flex items-center gap-3">
                <span className="text-lg font-bold text-indigo-300">
                  #{i + 1}
                </span>
                <div>
                  <p className="font-medium text-white">{m.team_name}</p>
                </div>
              </div>
              <p className="text-lg font-bold text-indigo-300">
                {m.total_points} pts
              </p>
            </div>
          ))}
          {members && members.length < 3 && (
            <p className="text-sm text-indigo-300/40">
              Waiting for {3 - members.length} more player(s) to join...
            </p>
          )}
        </div>

        {/* My Squad */}
        <div className="rounded-2xl bg-white/5 p-5 space-y-3">
          <h2 className="text-lg font-semibold text-white">My Squad</h2>
          {(!myRoster || myRoster.length === 0) ? (
            <p className="text-sm text-indigo-300/60">
              {league.draft_status === "completed"
                ? "No players in your squad."
                : "Draft hasn't started yet."}
            </p>
          ) : (
            <div className="space-y-2">
              {myRoster.map((r) => {
                const player = r.players as { name: string; role: string; franchise: string } | null;
                return (
                  <div
                    key={r.id}
                    className="flex items-center justify-between rounded-lg bg-white/5 p-3"
                  >
                    <div>
                      <p className="font-medium text-white">
                        {player?.name}
                        {r.is_captain && (
                          <span className="ml-2 text-xs text-amber-400">(C)</span>
                        )}
                        {r.is_vice_captain && (
                          <span className="ml-2 text-xs text-amber-400">(VC)</span>
                        )}
                      </p>
                      <p className="text-xs text-indigo-300/50">
                        {player?.role} · {player?.franchise}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex flex-col gap-3">
          {league.draft_status === "pending" && isCreator && members && members.length === 3 && (
            <Link
              href={`/league/${id}/draft`}
              className="rounded-xl bg-green-600 py-3 text-center font-semibold text-white transition-colors hover:bg-green-500"
            >
              Start Draft
            </Link>
          )}
          {league.draft_status === "in_progress" && (
            <Link
              href={`/league/${id}/draft`}
              className="rounded-xl bg-amber-600 py-3 text-center font-semibold text-white transition-colors hover:bg-amber-500"
            >
              Continue Draft
            </Link>
          )}
          {league.draft_status === "completed" && (
            <>
              <Link
                href={`/league/${id}/roster`}
                className="rounded-xl bg-indigo-500 py-3 text-center font-semibold text-white transition-colors hover:bg-indigo-400"
              >
                Manage Roster
              </Link>
              <Link
                href={`/league/${id}/scores`}
                className="rounded-xl border border-indigo-400/30 py-3 text-center font-semibold text-indigo-200 transition-colors hover:bg-indigo-900/50"
              >
                Enter Scores
              </Link>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
