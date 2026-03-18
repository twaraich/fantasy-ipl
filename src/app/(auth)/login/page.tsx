"use client";

import { createClient } from "@/lib/supabase/client";
import { useRouter, useSearchParams } from "next/navigation";
import { useState, Suspense } from "react";

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const isSignUp = searchParams.get("signup") === "true";
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const supabase = createClient();

    const { error } = isSignUp
      ? await supabase.auth.signUp({ email, password })
      : await supabase.auth.signInWithPassword({ email, password });

    if (error) {
      setError(error.message);
      setLoading(false);
      return;
    }

    router.push("/dashboard");
    router.refresh();
  }

  async function handleGoogleSignIn() {
    const supabase = createClient();
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    });
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-b from-indigo-950 to-slate-900 px-4">
      <div className="w-full max-w-sm space-y-6">
        <div className="text-center">
          <span className="text-3xl">🏏</span>
          <h1 className="mt-2 text-2xl font-bold text-white">
            {isSignUp ? "Create Account" : "Welcome Back"}
          </h1>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <input
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            className="w-full rounded-xl bg-white/10 px-4 py-3 text-white placeholder:text-indigo-300/50 focus:outline-none focus:ring-2 focus:ring-indigo-400"
          />
          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={6}
            className="w-full rounded-xl bg-white/10 px-4 py-3 text-white placeholder:text-indigo-300/50 focus:outline-none focus:ring-2 focus:ring-indigo-400"
          />

          {error && (
            <p className="text-sm text-red-400">{error}</p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-xl bg-indigo-500 py-3 font-semibold text-white transition-colors hover:bg-indigo-400 disabled:opacity-50"
          >
            {loading ? "..." : isSignUp ? "Sign Up" : "Sign In"}
          </button>
        </form>

        <div className="relative">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-indigo-400/20" />
          </div>
          <div className="relative flex justify-center text-sm">
            <span className="bg-slate-900 px-2 text-indigo-300/50">or</span>
          </div>
        </div>

        <button
          onClick={handleGoogleSignIn}
          className="w-full rounded-xl border border-indigo-400/30 py-3 font-semibold text-indigo-200 transition-colors hover:bg-indigo-900/50"
        >
          Continue with Google
        </button>

        <p className="text-center text-sm text-indigo-300/60">
          {isSignUp ? "Already have an account?" : "Don't have an account?"}{" "}
          <a
            href={isSignUp ? "/login" : "/login?signup=true"}
            className="text-indigo-300 hover:text-indigo-200"
          >
            {isSignUp ? "Sign In" : "Sign Up"}
          </a>
        </p>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}
