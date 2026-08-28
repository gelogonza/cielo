import { createClient } from "@/lib/supabase/server";

export interface AuthUser {
  id: string;
  email: string;
}

// Uses getClaims() rather than getUser(): it verifies the JWT against the
// project's cached JWKS instead of round-tripping to the Auth server on
// every call, per Supabase's current guidance for protecting routes/data.
export async function getSessionUser(): Promise<AuthUser | null> {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getClaims();

  if (error || !data?.claims.email) {
    return null;
  }

  return { id: data.claims.sub, email: data.claims.email };
}
