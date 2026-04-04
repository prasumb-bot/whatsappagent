import { supabase } from "@/lib/supabase";

export async function GET() {
  // Single query — gets all conversations + last message in ONE call
  const { data, error } = await supabase.rpc("get_conversations_with_last_message");

  if (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }

  return Response.json(data);
}
