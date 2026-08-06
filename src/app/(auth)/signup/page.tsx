"use client";

import { Suspense, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { AlertCircle, Loader2, Ticket } from "lucide-react";
import { authClient } from "@/lib/auth/client";
import { BrandMark } from "@/components/layout/brand";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const signupSchema = z.object({
  name: z.string().max(40, "Keep your name under 40 characters"),
  email: z.string().min(1, "Enter your email").email("Enter a valid email"),
  password: z.string().min(8, "Use at least 8 characters"),
});

type SignupValues = z.infer<typeof signupSchema>;

function fieldError(msg?: string) {
  return msg ? (
    <p role="alert" className="text-xs font-medium text-destructive">
      {msg}
    </p>
  ) : null;
}

function SignupForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const inviteToken = searchParams.get("invite") ?? undefined;
  const [authError, setAuthError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<SignupValues>({
    resolver: zodResolver(signupSchema),
    defaultValues: { name: "", email: "", password: "" },
  });

  async function onSubmit(values: SignupValues) {
    setAuthError(null);
    // The backend reads `inviteToken` from the body to enforce the allow-list /
    // invite. It isn't part of Better Auth's typed arg, so we attach it as an
    // extra field and cast to the expected parameter type.
    const payload = {
      email: values.email,
      password: values.password,
      name: values.name.trim(),
      ...(inviteToken ? { inviteToken } : {}),
    } as Parameters<typeof authClient.signUp.email>[0];
    const { error } = await authClient.signUp.email(payload);
    if (error) {
      setAuthError(error.message ?? "Couldn’t create your account. Please try again.");
      return;
    }
    router.push("/");
  }

  return (
    <div className="rounded-3xl bg-background/95 p-7 text-foreground shadow-2xl backdrop-blur sm:p-8">
      <header className="mb-6 space-y-1.5 text-center">
        <h1 className="font-heading text-2xl font-semibold">Create your account</h1>
        <p className="text-sm text-muted-foreground">Start tracking your money with Ledgerly.</p>
      </header>

      {inviteToken ? (
        <div className="mb-5 flex items-start gap-2 rounded-xl border border-border bg-accent/50 px-3.5 py-2.5 text-sm text-accent-foreground">
          <Ticket className="mt-0.5 size-4 shrink-0" />
          <span>You’re signing up with an invite. It’ll be applied automatically.</span>
        </div>
      ) : null}

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-5" noValidate>
        {authError ? (
          <div
            role="alert"
            className="flex items-start gap-2 rounded-xl border border-destructive/30 bg-destructive/10 px-3.5 py-2.5 text-sm font-medium text-destructive"
          >
            <AlertCircle className="mt-0.5 size-4 shrink-0" />
            <span>{authError}</span>
          </div>
        ) : null}

        <div className="space-y-1.5">
          <Label htmlFor="name">Name</Label>
          <Input
            id="name"
            type="text"
            autoComplete="name"
            placeholder="Your name (optional)"
            autoFocus
            aria-invalid={!!errors.name}
            {...register("name")}
          />
          {fieldError(errors.name?.message)}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            type="email"
            autoComplete="email"
            placeholder="you@example.com"
            aria-invalid={!!errors.email}
            {...register("email")}
          />
          {fieldError(errors.email?.message)}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="password">Password</Label>
          <Input
            id="password"
            type="password"
            autoComplete="new-password"
            placeholder="At least 8 characters"
            aria-invalid={!!errors.password}
            {...register("password")}
          />
          {fieldError(errors.password?.message)}
        </div>

        <Button type="submit" size="lg" className="w-full gap-2" disabled={isSubmitting}>
          {isSubmitting ? <Loader2 className="size-4 animate-spin" /> : null}
          Create account
        </Button>
      </form>

      <p className="mt-6 text-center text-sm text-muted-foreground">
        Already have an account?{" "}
        <Link href="/login" className="font-medium text-primary underline-offset-2 hover:underline">
          Sign in
        </Link>
      </p>
    </div>
  );
}

export default function SignupPage() {
  return (
    <div className="surface-hero surface-grain relative flex min-h-dvh items-center justify-center px-5 py-10">
      <div className="relative z-10 w-full max-w-md">
        <div className="mb-6 flex flex-col items-center text-center">
          <BrandMark className="size-14 rounded-2xl" />
        </div>
        <Suspense fallback={null}>
          <SignupForm />
        </Suspense>
      </div>
    </div>
  );
}
