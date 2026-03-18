import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

// Create a match (league creator only)
export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { league_id, matchweek, team_home, team_away, match_date } = await request.json();

  // Verify creator
  const { data: league } = await supabase
    .from("leagues")
    .select("created_by")
    .eq("id", league_id)
    .single();

  if (!league || league.created_by !== user.id) {
    return NextResponse.json({ error: "Not authorized" }, { status: 403 });
  }

  const { data, error } = await supabase
    .from("matches")
    .insert({ league_id, matchweek, team_home, team_away, match_date })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}
