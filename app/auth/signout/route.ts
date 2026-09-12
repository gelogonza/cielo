import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

// POST-only: a GET sign-out would let any cross-site image or link tag log the
// user out. Route Handlers can write cookies, so this is where the session is
// actually cleared (a Server Component could not do it).
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  await supabase.auth.signOut();

  return NextResponse.redirect(new URL("/", request.url), { status: 303 });
}
