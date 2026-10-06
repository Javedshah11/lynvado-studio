'use client';

import Link from 'next/link';
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

export default function RegisterPage() {
  const router = useRouter();

  const [
    displayName,
    setDisplayName,
  ] = useState('');

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
          '/auth/register',
          {
            method: 'POST',

            body: JSON.stringify({
              displayName,
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
          : 'Registration failed.',
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#07090d] px-6 py-12 text-white">
      <div className="w-full max-w-md">
        <Link
          href="/"
          className="mb-10 inline-block text-xl font-semibold"
        >
          Lynvado{' '}
          <span className="text-violet-400">
            Studio
          </span>
        </Link>

        <div className="rounded-3xl border border-white/10 bg-white/[0.035] p-8 shadow-2xl">
          <h1 className="text-3xl font-semibold tracking-tight">
            Create your account
          </h1>

          <p className="mt-2 text-sm text-zinc-400">
            Start building AI-powered
            video projects.
          </p>

          <form
            onSubmit={handleSubmit}
            className="mt-8 space-y-5"
          >
            <div>
              <label
                htmlFor="displayName"
                className="mb-2 block text-sm text-zinc-300"
              >
                Name
              </label>

              <input
                id="displayName"
                type="text"
                autoComplete="name"
                value={displayName}
                onChange={(event) =>
                  setDisplayName(
                    event.target.value,
                  )
                }
                required
                disabled={loading}
                className="w-full rounded-xl border border-white/10 bg-black/30 px-4 py-3 outline-none transition focus:border-violet-400 disabled:opacity-60"
                placeholder="Your name"
              />
            </div>

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
                required
                disabled={loading}
                className="w-full rounded-xl border border-white/10 bg-black/30 px-4 py-3 outline-none transition focus:border-violet-400 disabled:opacity-60"
                placeholder="you@example.com"
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
                autoComplete="new-password"
                value={password}
                onChange={(event) =>
                  setPassword(
                    event.target.value,
                  )
                }
                minLength={8}
                required
                disabled={loading}
                className="w-full rounded-xl border border-white/10 bg-black/30 px-4 py-3 outline-none transition focus:border-violet-400 disabled:opacity-60"
                placeholder="Minimum 8 characters"
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
              className="w-full rounded-xl bg-white px-4 py-3 font-medium text-black transition hover:bg-zinc-200 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loading
                ? 'Creating account...'
                : 'Create account'}
            </button>
          </form>

          <p className="mt-6 text-center text-sm text-zinc-400">
            Already have an account?{' '}

            <Link
              href="/login"
              className="text-white hover:underline"
            >
              Sign in
            </Link>
          </p>
        </div>
      </div>
    </main>
  );
}