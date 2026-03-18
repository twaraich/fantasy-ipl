import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import { SignOutButton } from "@/components/sign-out-button";

export default async function DashboardPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  // Fetch leagues the user is part of
  const { data: memberships } = await supabase
    .from("league_members")
    .select("*, leagues(*)")
    .eq("user_id", user.id);

  return (
    <div className="min-h-screen bg-gradient-to-b from-indigo-950 to-slate-900 px-4 py-8">
      <div className="mx-auto max-w-lg space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-white">🏏 Fantasy IPL</h1>
          <SignOutButton />
        </div>

        <div className="rounded-2xl bg-white/5 p-6 space-y-4">
          <h2 className="text-lg font-semibold text-white">Your Leagues</h2>

          {(!memberships || memberships.length === 0) ? (
            <p className="text-indigo-300/60 text-sm">
              You haven&apos;t joined any leagues yet.
            </p>
          ) : (
            <div className="space-y-3">
              {memberships.map((m) => (
                <Link
                  key={m.id}
                  href={`/league/${m.league_id}`}
                  className="block rounded-xl bg-white/5 p-4 transition-colors hover:bg-white/10"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium text-white">
                        {(m.leagues as { name: string })?.name}
                      </p>
                      <p className="text-sm text-indigo-300/60">
                        {m.team_name}
                      </p>
                    </div>
                    <p className="text-lg font-bold text-indigo-300">
                      {m.total_points} pts
                    </p>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>

        <div className="flex gap-3">
          <Link
            href="/league/create"
            className="flex-1 rounded-xl bg-indigo-500 py-3 text-center font-semibold text-white transition-colors hover:bg-indigo-400"
          >
            Create League
          </Link>
          <Link
            href="/league/join"
            className="flex-1 rounded-xl border border-indigo-400/30 py-3 text-center font-semibold text-indigo-200 transition-colors hover:bg-indigo-900/50"
          >
            Join League
          </Link>
        </div>
      </div>
    </div>
  );
}
