import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

export default async function Home() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (user) {
    redirect("/dashboard");
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-b from-indigo-950 to-slate-900 px-4">
      <main className="flex flex-col items-center gap-8 text-center">
        <div className="flex flex-col items-center gap-2">
          <span className="text-5xl">🏏</span>
          <h1 className="text-4xl font-bold text-white">Fantasy IPL</h1>
          <p className="text-lg text-indigo-200">
            Draft your squad. Set your captain. Win the league.
          </p>
        </div>

        <div className="flex flex-col gap-3 w-full max-w-xs">
          <Link
            href="/login"
            className="rounded-xl bg-indigo-500 px-6 py-3 text-center font-semibold text-white transition-colors hover:bg-indigo-400"
          >
            Sign In
          </Link>
          <Link
            href="/login?signup=true"
            className="rounded-xl border border-indigo-400/30 px-6 py-3 text-center font-semibold text-indigo-200 transition-colors hover:bg-indigo-900/50"
          >
            Create Account
          </Link>
        </div>

        <p className="text-sm text-indigo-300/60">
          A private fantasy league for you and your friends
        </p>
      </main>
    </div>
  );
}
