import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import {
  getDraftRound,
  getRosterState,
  canPickPlayer,
  SQUAD_SIZE,
} from "@/lib/draft";

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { league_id, player_id } = await request.json();

  // Get league
  const { data: league } = await supabase
    .from("leagues")
    .select("*")
    .eq("id", league_id)
    .single();

  if (!league || league.draft_status !== "in_progress") {
    return NextResponse.json({ error: "Draft not in progress" }, { status: 400 });
  }

  // Check it's this user's turn
  const draftOrder = league.draft_order as string[];
  if (draftOrder[league.current_pick] !== user.id) {
    return NextResponse.json({ error: "Not your turn" }, { status: 400 });
  }

  // Check player isn't already drafted
  const { data: existingPick } = await supabase
    .from("draft_picks")
    .select("id")
    .eq("league_id", league_id)
    .eq("player_id", player_id)
    .single();

  if (existingPick) {
    return NextResponse.json({ error: "Player already drafted" }, { status: 400 });
  }

  // Get player info
  const { data: player } = await supabase
    .from("players")
    .select("*")
    .eq("id", player_id)
    .single();

  if (!player) {
    return NextResponse.json({ error: "Player not found" }, { status: 404 });
  }

  // Get user's current picks to validate constraints
  const { data: myPicks } = await supabase
    .from("draft_picks")
    .select("player_id, players(role, franchise, is_overseas)")
    .eq("league_id", league_id)
    .eq("user_id", user.id);

  const rosterState = getRosterState(
    (myPicks || []).map((p) => {
      const pl = p.players as unknown as { role: string; franchise: string; is_overseas: boolean };
      return {
        role: pl.role as "WK" | "BAT" | "AR" | "BOWL",
        franchise: pl.franchise,
        is_overseas: pl.is_overseas,
      };
    })
  );

  const check = canPickPlayer(rosterState, {
    role: player.role as "WK" | "BAT" | "AR" | "BOWL",
    franchise: player.franchise,
    is_overseas: player.is_overseas,
  });

  if (!check.allowed) {
    return NextResponse.json({ error: check.reason }, { status: 400 });
  }

  const numPlayers = 3;
  const round = getDraftRound(league.current_pick, numPlayers);

  // Insert draft pick
  const { error: pickError } = await supabase.from("draft_picks").insert({
    league_id,
    user_id: user.id,
    player_id,
    pick_number: league.current_pick,
    round,
  });

  if (pickError) {
    return NextResponse.json({ error: pickError.message }, { status: 500 });
  }

  // Add to roster
  await supabase.from("rosters").insert({
    league_id,
    user_id: user.id,
    player_id,
    acquired_via: "draft",
  });

  // Advance pick or complete draft
  const nextPick = league.current_pick + 1;
  const totalPicks = numPlayers * SQUAD_SIZE;

  if (nextPick >= totalPicks) {
    await supabase
      .from("leagues")
      .update({ current_pick: nextPick, draft_status: "completed" })
      .eq("id", league_id);
  } else {
    await supabase
      .from("leagues")
      .update({ current_pick: nextPick })
      .eq("id", league_id);
  }

  return NextResponse.json({
    success: true,
    pick_number: league.current_pick,
    round,
    next_pick: nextPick < totalPicks ? nextPick : null,
    draft_complete: nextPick >= totalPicks,
  });
}
