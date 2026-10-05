'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

import {
  apiRequest,
  clearAccessToken,
  getAccessToken,
  type LynvadoUser,
} from '@/lib/api';

export default function DashboardPage() {
  const router = useRouter();
  const [user, setUser] = useState<LynvadoUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadUser() {
      const token = getAccessToken();

      if (!token) {
        router.replace('/login');
        return;
      }

      try {
        const result = await apiRequest<LynvadoUser>('/auth/me', {
          headers: { Authorization: `Bearer ${token}` },
        });
        setUser(result);
      } catch {
        clearAccessToken();
        router.replace('/login');
      } finally {
        setLoading(false);
      }
    }

    void loadUser();
  }, [router]);

  function logout() {
    clearAccessToken();
    router.replace('/login');
  }

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#07090d] text-zinc-400">
        Loading Lynvado Studio...
      </main>
    );
  }

  if (!user) return null;

  return (
    <main className="min-h-screen bg-[#07090d] text-white">
      <header className="border-b border-white/10">
        <div className="mx-auto flex h-18 max-w-7xl items-center justify-between px-6 py-5">
          <div className="text-lg font-semibold">
            Lynvado <span className="text-violet-400">Studio</span>
          </div>
          <div className="flex items-center gap-4">
            <span className="hidden text-sm text-zinc-400 sm:block">
              {user.email}
            </span>
            <button
              onClick={logout}
              className="rounded-xl border border-white/10 px-4 py-2 text-sm hover:bg-white/5"
            >
              Logout
            </button>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-7xl px-6 py-10">
        <p className="text-sm text-violet-400">Workspace</p>
        <h1 className="mt-2 text-4xl font-semibold tracking-tight">
          Welcome, {user.displayName}
        </h1>
        <p className="mt-3 text-zinc-400">
          Create and transform videos with Lynvado Studio.
        </p>

        <section className="mt-10 grid gap-5 md:grid-cols-3">
          <div className="rounded-3xl border border-violet-400/20 bg-violet-400/[0.06] p-6">
            <div className="text-sm text-violet-300">Start a project</div>
            <h2 className="mt-3 text-xl font-semibold">Upload a video</h2>
            <p className="mt-2 text-sm leading-6 text-zinc-400">
              Upload long-form content and prepare it for AI analysis.
            </p>
            <button
              disabled
              className="mt-6 rounded-xl bg-white px-4 py-2 text-sm font-medium text-black opacity-50"
            >
              Coming next
            </button>
          </div>
          <div className="rounded-3xl border border-white/10 bg-white/[0.025] p-6">
            <div className="text-sm text-zinc-500">Projects</div>
            <div className="mt-5 text-4xl font-semibold">0</div>
            <div className="mt-2 text-sm text-zinc-500">No projects yet</div>
          </div>
          <div className="rounded-3xl border border-white/10 bg-white/[0.025] p-6">
            <div className="text-sm text-zinc-500">AI processing</div>
            <div className="mt-5 text-4xl font-semibold">Ready</div>
            <div className="mt-2 text-sm text-zinc-500">
              Lynvado intelligence will connect here.
            </div>
          </div>
        </section>

        <section className="mt-8 rounded-3xl border border-white/10 bg-white/[0.025]">
          <div className="border-b border-white/10 px-6 py-5">
            <h2 className="font-medium">Recent projects</h2>
          </div>
          <div className="flex min-h-48 items-center justify-center p-8 text-center">
            <div>
              <p className="text-zinc-400">No video projects yet.</p>
              <p className="mt-2 text-sm text-zinc-600">
                Video upload and project management is our next development
                batch.
              </p>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
