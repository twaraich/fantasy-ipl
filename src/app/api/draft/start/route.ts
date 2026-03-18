import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { getSnakeDraftOrder, SQUAD_SIZE } from "@/lib/draft";

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { league_id } = await request.json();

  // Verify user is league creator
  const { data: league } = await supabase
    .from("leagues")
    .select("*")
    .eq("id", league_id)
    .eq("created_by", user.id)
    .single();

  if (!league) {
    return NextResponse.json({ error: "Not found or not authorized" }, { status: 404 });
  }

  if (league.draft_status !== "pending") {
    return NextResponse.json({ error: "Draft already started" }, { status: 400 });
  }

  // Get members
  const { data: members } = await supabase
    .from("league_members")
    .select("user_id")
    .eq("league_id", league_id)
    .order("joined_at");

  if (!members || members.length !== 3) {
    return NextResponse.json({ error: "Need exactly 3 members" }, { status: 400 });
  }

  const memberIds = members.map((m) => m.user_id);
  const draftOrder = getSnakeDraftOrder(memberIds, SQUAD_SIZE);

  const { error } = await supabase
    .from("leagues")
    .update({
      draft_status: "in_progress",
      draft_order: draftOrder,
      current_pick: 0,
    })
    .eq("id", league_id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true, draft_order: draftOrder });
}
