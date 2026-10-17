'use client';

import Link from 'next/link';
import { ArrowRight, Clapperboard, LockKeyhole } from 'lucide-react';
import { useRouter } from 'next/navigation';
import {
  useState,
  type FormEvent,
} from 'react';

import {
  apiRequest,
  saveAccessToken,
  type AuthResponse,
} from '@/lib/api';

export default function LoginPage() {
  const router = useRouter();

  const [email, setEmail] =
    useState('');

  const [password, setPassword] =
    useState('');

  const [error, setError] =
    useState('');

  const [loading, setLoading] =
    useState(false);

  async function handleSubmit(
    event: FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    if (loading) {
      return;
    }

    setLoading(true);
    setError('');

    try {
      const result =
        await apiRequest<AuthResponse>(
          '/auth/login',
          {
            method: 'POST',

            body: JSON.stringify({
              email,
              password,
            }),
          },
        );

      saveAccessToken(
        result.accessToken,
      );

      router.replace(
        '/dashboard',
      );
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Login failed.',
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="studio-glow studio-grid flex min-h-screen items-center justify-center px-5 py-10 text-white">
      <div className="grid w-full max-w-5xl overflow-hidden rounded-[30px] border border-white/10 bg-[#0b0d13]/95 shadow-2xl shadow-black/40 md:grid-cols-[.9fr_1.1fr]">
        <section className="hidden flex-col justify-between border-r border-white/8 bg-violet-500/8 p-10 md:flex">
          <Link href="/" className="flex items-center gap-3 text-sm font-semibold"><span className="grid size-10 place-items-center rounded-xl bg-violet-500/15"><Clapperboard className="size-5 text-violet-300" /></span> LYNVADO / STUDIO</Link>
          <div><LockKeyhole className="size-8 text-violet-300"/><h2 className="mt-6 text-3xl font-semibold tracking-tight">Your studio is ready.</h2><p className="mt-3 max-w-xs text-sm leading-6 text-zinc-400">Return to your projects, local AI edits, transcripts, and exports.</p></div>
          <p className="text-xs text-zinc-600">Private media · Local intelligence</p>
        </section>
        <div className="p-7 sm:p-10 md:p-12">
        <Link
          href="/"
          className="mb-10 inline-flex items-center gap-2 text-sm font-semibold md:hidden"
        >
          <Clapperboard className="size-5 text-violet-300" /> LYNVADO / STUDIO
        </Link>

        <div>
          <h1 className="text-3xl font-semibold">
            Welcome back
          </h1>

          <p className="mt-2 text-sm text-zinc-400">
            Sign in to your Lynvado
            Studio workspace.
          </p>

          <form
            onSubmit={handleSubmit}
            className="mt-8 space-y-5"
          >
            <div>
              <label
                htmlFor="email"
                className="mb-2 block text-sm text-zinc-300"
              >
                Email
              </label>

              <input
                id="email"
                type="email"
                autoComplete="email"
                value={email}
                onChange={(event) =>
                  setEmail(
                    event.target.value,
                  )
                }
                placeholder="you@example.com"
                required
                disabled={loading}
                className="w-full rounded-xl border border-white/10 bg-black/30 px-4 py-3.5 outline-none transition focus:border-violet-400 disabled:opacity-60"
              />
            </div>

            <div>
              <label
                htmlFor="password"
                className="mb-2 block text-sm text-zinc-300"
              >
                Password
              </label>

              <input
                id="password"
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(event) =>
                  setPassword(
                    event.target.value,
                  )
                }
                placeholder="Password"
                required
                disabled={loading}
                className="w-full rounded-xl border border-white/10 bg-black/30 px-4 py-3.5 outline-none transition focus:border-violet-400 disabled:opacity-60"
              />
            </div>

            {error && (
              <div
                role="alert"
                className="rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-300"
              >
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-violet-500 py-3.5 font-semibold text-white transition hover:bg-violet-400 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loading
                ? 'Signing in...'
                : 'Enter studio'} {!loading && <ArrowRight className="size-4" />}
            </button>
          </form>

          <p className="mt-6 text-center text-sm text-zinc-400">
            New to Lynvado?{' '}

            <Link
              href="/register"
              className="text-white hover:underline"
            >
              Create account
            </Link>
          </p>
        </div></div>
      </div>
    </main>
  );
}
