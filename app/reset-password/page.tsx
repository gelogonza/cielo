"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { AuthCard } from "@/components/auth/auth-card";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { createClient } from "@/lib/supabase/client";

/**
 * Reached from the emailed reset link, after /auth/callback has exchanged the
 * code for a session. The session is what authorises the change — there is no
 * token to pass around here.
 */
export default function ResetPasswordPage() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();

    if (password !== confirmation) {
      setError("Those passwords do not match.");
      return;
    }

    setError(null);
    setIsSubmitting(true);

    const supabase = createClient();
    const { error: updateError } = await supabase.auth.updateUser({ password });

    setIsSubmitting(false);

    if (updateError) {
      // Most often the link was already used or has expired, which leaves no
      // session for updateUser to act on.
      setError(updateError.message);
      return;
    }

    router.push("/library");
    router.refresh();
  }

  return (
    <AuthCard title="New password" subtitle="Choose a password for your account">
      <form onSubmit={handleSubmit} className="flex flex-col gap-7">
        <div className="flex flex-col gap-3.5">
          <Field
            type="password"
            required
            minLength={8}
            aria-label="New password"
            placeholder="New password"
            autoComplete="new-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
          />
          <Field
            type="password"
            required
            minLength={8}
            aria-label="Confirm new password"
            placeholder="Confirm new password"
            autoComplete="new-password"
            value={confirmation}
            onChange={(event) => setConfirmation(event.target.value)}
          />
        </div>

        {error && (
          <p role="alert" className="text-center text-sm text-red-600">
            {error}
          </p>
        )}

        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? "Saving..." : "Save password"}
        </Button>
      </form>
    </AuthCard>
  );
}
