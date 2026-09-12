import { Suspense } from "react";
import { AuthCard } from "@/components/auth/auth-card";
import { LoginForm } from "@/components/auth/login-form";

export default function LoginPage() {
  return (
    <AuthCard title="Log in" subtitle="Welcome back to Cielo">
      {/* LoginForm reads ?next= via useSearchParams, which needs a boundary. */}
      <Suspense fallback={<div className="h-[430px]" />}>
        <LoginForm />
      </Suspense>
    </AuthCard>
  );
}
