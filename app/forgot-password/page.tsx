"use client";

import Link from "next/link";
import { useState } from "react";
import { AuthCard } from "@/components/auth/auth-card";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { createClient } from "@/lib/supabase/client";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSent, setIsSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setIsSubmitting(true);

    const supabase = createClient();
    const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
      // The link lands on the OAuth callback, which exchanges the code for a
      // session and then forwards to the form that sets the new password.
      redirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent("/reset-password")}`,
    });

    setIsSubmitting(false);

    if (resetError) {
      setError(resetError.message);
      return;
    }

    setIsSent(true);
  }

  if (isSent) {
    return (
      <AuthCard title="Check your email" subtitle={`We sent a reset link to ${email}.`}>
        <p className="text-muted text-base">
          Follow it to choose a new password. The link expires after an hour.
        </p>
        <Link href="/login" className="text-primary-text text-center text-base font-medium">
          Back to log in
        </Link>
      </AuthCard>
    );
  }

  return (
    <AuthCard title="Reset password" subtitle="We'll email you a link to set a new one">
      <form onSubmit={handleSubmit} className="flex flex-col gap-7">
        <Field
          type="email"
          required
          aria-label="Email"
          placeholder="Email"
          autoComplete="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
        />

        {error && (
          <p role="alert" className="text-center text-sm text-red-600">
            {error}
          </p>
        )}

        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? "Sending..." : "Send reset link"}
        </Button>
      </form>

      <p className="text-muted text-center text-base">
        Remembered it?{" "}
        <Link href="/login" className="text-primary-text font-medium">
          Log in
        </Link>
      </p>
    </AuthCard>
  );
}
