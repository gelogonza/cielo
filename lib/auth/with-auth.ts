import { NextResponse, type NextRequest } from "next/server";
import { getSessionUser, type AuthUser } from "@/lib/auth/session";

type AuthenticatedHandler<Context> = (
  request: NextRequest,
  context: Context,
  user: AuthUser,
) => Promise<Response>;

// The shared auth guard every protected API route handler must wrap itself
// in — this is the actual enforcement point (see api-contract.md's AUTH_MW
// and docs/engineering-standards.md Section 3). proxy.ts only refreshes the
// session cookie; it is not a substitute for this check.
export function withAuth<Context = unknown>(handler: AuthenticatedHandler<Context>) {
  return async (request: NextRequest, context: Context): Promise<Response> => {
    const user = await getSessionUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    return handler(request, context, user);
  };
}
