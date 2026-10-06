'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

import {
  apiRequest,
  logoutSession,
  type LynvadoUser,
} from '@/lib/api';

export default function DashboardPage() {
  const router = useRouter();

  const [user, setUser] =
    useState<LynvadoUser | null>(null);

  const [loading, setLoading] =
    useState(true);

  const [loggingOut, setLoggingOut] =
    useState(false);

  useEffect(() => {
    let active = true;

    async function loadUser() {
      try {
        const result =
          await apiRequest<LynvadoUser>(
            '/auth/me',
          );

        if (!active) {
          return;
        }

        setUser(result);
      } catch {
        if (!active) {
          return;
        }

        router.replace('/login');
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    void loadUser();

    return () => {
      active = false;
    };
  }, [router]);

  async function handleLogout() {
    if (loggingOut) {
      return;
    }

    setLoggingOut(true);

    try {
      await logoutSession();
    } finally {
      router.replace('/login');
      router.refresh();
    }
  }

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#07090d] text-zinc-400">
        Loading Lynvado Studio...
      </main>
    );
  }

  if (!user) {
    return null;
  }

  return (
    <main className="min-h-screen bg-[#07090d] text-white">
      <header className="border-b border-white/10">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-5">
          <div className="text-lg font-semibold">
            Lynvado{' '}
            <span className="text-violet-400">
              Studio
            </span>
          </div>

          <div className="flex items-center gap-4">
            <span className="hidden text-sm text-zinc-400 sm:block">
              {user.email}
            </span>

            <button
              type="button"
              onClick={() => {
                void handleLogout();
              }}
              disabled={loggingOut}
              className="rounded-xl border border-white/10 px-4 py-2 text-sm transition hover:bg-white/5 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {loggingOut
                ? 'Logging out...'
                : 'Logout'}
            </button>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-7xl px-6 py-10">
        <div>
          <p className="text-sm text-violet-400">
            Workspace
          </p>

          <h1 className="mt-2 text-4xl font-semibold tracking-tight">
            Welcome, {user.displayName}
          </h1>

          <p className="mt-3 text-zinc-400">
            Create and transform videos
            with Lynvado Studio.
          </p>
        </div>

        <section className="mt-10 grid gap-5 md:grid-cols-3">
          <div className="rounded-3xl border border-violet-400/20 bg-violet-400/6 p-6">
            <div className="text-sm text-violet-300">
              Start a project
            </div>

            <h2 className="mt-3 text-xl font-semibold">
              Upload a video
            </h2>

            <p className="mt-2 text-sm leading-6 text-zinc-400">
              Upload long-form content and
              prepare it for AI analysis.
            </p>

            <button
              type="button"
              disabled
              className="mt-6 rounded-xl bg-white px-4 py-2 text-sm font-medium text-black opacity-50"
            >
              Coming next
            </button>
          </div>

          <div className="rounded-3xl border border-white/10 bg-white/2.5 p-6">
            <div className="text-sm text-zinc-500">
              Projects
            </div>

            <div className="mt-5 text-4xl font-semibold">
              0
            </div>

            <div className="mt-2 text-sm text-zinc-500">
              No projects yet
            </div>
          </div>

          <div className="rounded-3xl border border-white/10 bg-white/2.5 p-6">
            <div className="text-sm text-zinc-500">
              AI processing
            </div>

            <div className="mt-5 text-4xl font-semibold">
              Ready
            </div>

            <div className="mt-2 text-sm text-zinc-500">
              Lynvado intelligence will
              connect here.
            </div>
          </div>
        </section>

        <section className="mt-8 rounded-3xl border border-white/10 bg-white/2.5">
          <div className="border-b border-white/10 px-6 py-5">
            <h2 className="font-medium">
              Recent projects
            </h2>
          </div>

          <div className="flex min-h-48 items-center justify-center p-8 text-center">
            <div>
              <p className="text-zinc-400">
                No video projects yet.
              </p>

              <p className="mt-2 text-sm text-zinc-600">
                Project management and video
                upload are coming in our next
                development batch.
              </p>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
