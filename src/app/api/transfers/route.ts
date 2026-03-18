import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { getRosterState, canPickPlayer } from "@/lib/draft";
import type { PlayerRole } from "@/types/database";

const FREE_TRANSFERS_PER_WEEK = 2;
const EXTRA_TRANSFER_COST = 4; // points deducted per extra transfer

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { league_id, player_in_id, player_out_id, matchweek } = await request.json();

  // Verify membership
  const { data: membership } = await supabase
    .from("league_members")
    .select("id")
    .eq("league_id", league_id)
    .eq("user_id", user.id)
    .single();

  if (!membership) return NextResponse.json({ error: "Not a league member" }, { status: 403 });

  // Verify draft is complete
  const { data: league } = await supabase
    .from("leagues")
    .select("draft_status")
    .eq("id", league_id)
    .single();

  if (!league || league.draft_status !== "completed") {
    return NextResponse.json({ error: "Draft not completed" }, { status: 400 });
  }

  // Check player_out is in user's roster
  const { data: outRoster } = await supabase
    .from("rosters")
    .select("id, is_captain, is_vice_captain")
    .eq("league_id", league_id)
    .eq("user_id", user.id)
    .eq("player_id", player_out_id)
    .single();

  if (!outRoster) return NextResponse.json({ error: "Player not in your roster" }, { status: 400 });

  // Check player_in is not in any roster in this league
  const { data: inRoster } = await supabase
    .from("rosters")
    .select("id")
    .eq("league_id", league_id)
    .eq("player_id", player_in_id)
    .single();

  if (inRoster) return NextResponse.json({ error: "Player already on a roster" }, { status: 400 });

  // Get player_in details
  const { data: playerIn } = await supabase
    .from("players")
    .select("*")
    .eq("id", player_in_id)
    .single();

  if (!playerIn) return NextResponse.json({ error: "Player not found" }, { status: 404 });

  // Get current roster (excluding outgoing player) to validate constraints
  const { data: currentRoster } = await supabase
    .from("rosters")
    .select("player_id, players(role, franchise, is_overseas)")
    .eq("league_id", league_id)
    .eq("user_id", user.id)
    .neq("player_id", player_out_id);

  const rosterState = getRosterState(
    (currentRoster || []).map((r) => {
      const p = r.players as unknown as { role: string; franchise: string; is_overseas: boolean };
      return { role: p.role as PlayerRole, franchise: p.franchise, is_overseas: p.is_overseas };
    })
  );

  const check = canPickPlayer(rosterState, {
    role: playerIn.role as PlayerRole,
    franchise: playerIn.franchise,
    is_overseas: playerIn.is_overseas,
  });

  if (!check.allowed) {
    return NextResponse.json({ error: check.reason }, { status: 400 });
  }

  // Count transfers this matchweek
  const { count } = await supabase
    .from("transfers")
    .select("id", { count: "exact" })
    .eq("league_id", league_id)
    .eq("user_id", user.id)
    .eq("matchweek", matchweek);

  const transferCount = count ?? 0;
  const isFree = transferCount < FREE_TRANSFERS_PER_WEEK;
  const pointCost = isFree ? 0 : EXTRA_TRANSFER_COST;

  // Record the transfer
  const { error: transferError } = await supabase.from("transfers").insert({
    league_id,
    user_id: user.id,
    player_in_id,
    player_out_id,
    matchweek,
    is_free: isFree,
    point_cost: pointCost,
  });

  if (transferError) return NextResponse.json({ error: transferError.message }, { status: 500 });

  // Remove old player from roster
  await supabase
    .from("rosters")
    .delete()
    .eq("league_id", league_id)
    .eq("user_id", user.id)
    .eq("player_id", player_out_id);

  // Add new player to roster
  await supabase.from("rosters").insert({
    league_id,
    user_id: user.id,
    player_id: player_in_id,
    is_captain: outRoster.is_captain,
    is_vice_captain: outRoster.is_vice_captain,
    acquired_via: "transfer",
  });

  // Deduct points if not free
  if (pointCost > 0) {
    const { data: member } = await supabase
      .from("league_members")
      .select("total_points")
      .eq("league_id", league_id)
      .eq("user_id", user.id)
      .single();

    if (member) {
      await supabase
        .from("league_members")
        .update({ total_points: member.total_points - pointCost })
        .eq("league_id", league_id)
        .eq("user_id", user.id);
    }
  }

  return NextResponse.json({
    success: true,
    is_free: isFree,
    point_cost: pointCost,
    transfers_used: transferCount + 1,
  });
}
