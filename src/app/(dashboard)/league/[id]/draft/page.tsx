import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { DraftBoard } from "@/components/draft-board";

export default async function DraftPage({
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
    { data: players },
    { data: picks },
  ] = await Promise.all([
    supabase.from("leagues").select("*").eq("id", id).single(),
    supabase
      .from("league_members")
      .select("user_id, team_name")
      .eq("league_id", id)
      .order("joined_at"),
    supabase.from("players").select("*").order("name"),
    supabase
      .from("draft_picks")
      .select("*, players(name, role, franchise, is_overseas)")
      .eq("league_id", id)
      .order("pick_number"),
  ]);

  if (!league) redirect("/dashboard");

  return (
    <div className="min-h-screen bg-gradient-to-b from-indigo-950 to-slate-900">
      <DraftBoard
        league={league}
        members={members || []}
        players={players || []}
        initialPicks={picks || []}
        currentUserId={user.id}
      />
    </div>
  );
}
