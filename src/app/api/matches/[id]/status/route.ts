import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { status } = await request.json();

  if (!["upcoming", "live", "completed"].includes(status)) {
    return NextResponse.json({ error: "Invalid status" }, { status: 400 });
  }

  // Get the match to find the league
  const { data: match } = await supabase
    .from("matches")
    .select("league_id")
    .eq("id", id)
    .single();

  if (!match) return NextResponse.json({ error: "Match not found" }, { status: 404 });

  // Verify creator
  const { data: league } = await supabase
    .from("leagues")
    .select("created_by")
    .eq("id", match.league_id)
    .single();

  if (!league || league.created_by !== user.id) {
    return NextResponse.json({ error: "Not authorized" }, { status: 403 });
  }

  const { error } = await supabase
    .from("matches")
    .update({ status })
    .eq("id", id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // If completed, recalculate points for all league members
  if (status === "completed") {
    await recalculateLeaguePoints(supabase, match.league_id);
  }

  return NextResponse.json({ success: true });
}

async function recalculateLeaguePoints(
  supabase: Awaited<ReturnType<typeof createClient>>,
  leagueId: string
) {
  // Get all members
  const { data: members } = await supabase
    .from("league_members")
    .select("user_id")
    .eq("league_id", leagueId);

  if (!members) return;

  // Get all completed matches for this league
  const { data: completedMatches } = await supabase
    .from("matches")
    .select("id")
    .eq("league_id", leagueId)
    .eq("status", "completed");

  if (!completedMatches || completedMatches.length === 0) return;
  const matchIds = completedMatches.map((m) => m.id);

  for (const member of members) {
    // Get roster with captain/vc info
    const { data: roster } = await supabase
      .from("rosters")
      .select("player_id, is_captain, is_vice_captain")
      .eq("league_id", leagueId)
      .eq("user_id", member.user_id);

    if (!roster) continue;

    const playerIds = roster.map((r) => r.player_id);

    // Get all scores for roster players in completed matches
    const { data: scores } = await supabase
      .from("player_scores")
      .select("player_id, fantasy_points")
      .in("match_id", matchIds)
      .in("player_id", playerIds);

    if (!scores) continue;

    // Build captain/vc lookup
    const captainId = roster.find((r) => r.is_captain)?.player_id;
    const vcId = roster.find((r) => r.is_vice_captain)?.player_id;

    let totalPoints = 0;
    for (const score of scores) {
      let pts = score.fantasy_points;
      if (score.player_id === captainId) pts *= 2;
      else if (score.player_id === vcId) pts *= 1.5;
      totalPoints += pts;
    }

    await supabase
      .from("league_members")
      .update({ total_points: totalPoints })
      .eq("league_id", leagueId)
      .eq("user_id", member.user_id);
  }
}
