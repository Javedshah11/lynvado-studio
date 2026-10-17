'use client';

import {
  AlertCircle,
  Check,
  Film,
  FolderOpen,
  LoaderCircle,
  LogOut,
  Pencil,
  Plus,
  Trash2,
  X,
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { type FormEvent, useEffect, useState } from 'react';

import {
  apiRequest,
  logoutSession,
  type LynvadoProject,
  type LynvadoUser,
} from '@/lib/api';

function formatDate(value: string): string {
  return new Intl.DateTimeFormat('en', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(new Date(value));
}

export default function DashboardPage() {
  const router = useRouter();
  const [user, setUser] = useState<LynvadoUser | null>(null);
  const [projects, setProjects] = useState<LynvadoProject[]>([]);
  const [loading, setLoading] = useState(true);
  const [loggingOut, setLoggingOut] = useState(false);
  const [creating, setCreating] = useState(false);
  const [projectName, setProjectName] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    Promise.all([
        apiRequest<LynvadoUser>('/auth/me'),
        apiRequest<LynvadoProject[]>('/projects'),
      ])
      .then(([currentUser, currentProjects]) => {
        if (!active) return;

        setUser(currentUser);
        setProjects(currentProjects);
      })
      .catch(() => {
        if (active) router.replace('/login');
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [router]);

  async function handleCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const name = projectName.trim();

    if (!name || creating) return;

    setCreating(true);
    setError(null);

    try {
      const project = await apiRequest<LynvadoProject>('/projects', {
        method: 'POST',
        body: JSON.stringify({ name }),
      });

      setProjects((current) => [project, ...current]);
      setProjectName('');
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not create the project.');
    } finally {
      setCreating(false);
    }
  }

  function beginRename(project: LynvadoProject) {
    setEditingId(project.id);
    setEditingName(project.name);
    setError(null);
  }

  async function handleRename(event: FormEvent<HTMLFormElement>, projectId: string) {
    event.preventDefault();
    const name = editingName.trim();

    if (!name || busyId) return;

    setBusyId(projectId);
    setError(null);

    try {
      const updated = await apiRequest<LynvadoProject>(`/projects/${projectId}`, {
        method: 'PATCH',
        body: JSON.stringify({ name }),
      });

      setProjects((current) =>
        current.map((project) => (project.id === projectId ? updated : project)),
      );
      setEditingId(null);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not rename the project.');
    } finally {
      setBusyId(null);
    }
  }

  async function handleDelete(project: LynvadoProject) {
    if (!window.confirm(`Delete “${project.name}”? This action cannot be undone.`) || busyId) {
      return;
    }

    setBusyId(project.id);
    setError(null);

    try {
      await apiRequest<void>(`/projects/${project.id}`, { method: 'DELETE' });
      setProjects((current) => current.filter(({ id }) => id !== project.id));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not delete the project.');
    } finally {
      setBusyId(null);
    }
  }

  async function handleLogout() {
    if (loggingOut) return;
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
        <LoaderCircle className="mr-3 size-5 animate-spin text-violet-400" />
        Loading your workspace...
      </main>
    );
  }

  if (!user) return null;

  return (
    <main className="min-h-screen bg-[#07090d] text-white">
      <header className="border-b border-white/10 bg-[#07090d]/90 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-5 py-5 sm:px-6">
          <div className="flex items-center gap-3">
            <div className="grid size-9 place-items-center rounded-xl bg-violet-500 text-white shadow-lg shadow-violet-500/20">
              <Film className="size-5" />
            </div>
            <div className="text-lg font-semibold">Lynvado <span className="text-violet-400">Studio</span></div>
          </div>

          <div className="flex items-center gap-3">
            <span className="hidden text-sm text-zinc-400 sm:block">{user.email}</span>
            <button type="button" onClick={() => void handleLogout()} disabled={loggingOut} className="flex items-center gap-2 rounded-xl border border-white/10 px-3 py-2 text-sm text-zinc-300 transition hover:border-white/20 hover:bg-white/5 disabled:opacity-50">
              <LogOut className="size-4" />
              <span className="hidden sm:inline">{loggingOut ? 'Logging out...' : 'Logout'}</span>
            </button>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-7xl px-5 py-10 sm:px-6">
        <div className="grid gap-8 lg:grid-cols-[1fr_360px] lg:items-end">
          <div>
            <p className="text-sm font-medium text-violet-400">Your workspace</p>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">Welcome back, {user.displayName}</h1>
            <p className="mt-3 max-w-2xl text-zinc-400">Organize your videos into projects. Upload and AI processing are the next step.</p>
          </div>

          <form onSubmit={(event) => void handleCreate(event)} className="rounded-2xl border border-violet-400/20 bg-violet-400/5 p-4">
            <label htmlFor="project-name" className="text-sm font-medium text-zinc-200">Create a new project</label>
            <div className="mt-3 flex gap-2">
              <input id="project-name" value={projectName} onChange={(event) => setProjectName(event.target.value)} maxLength={160} placeholder="Podcast episode, product demo..." className="min-w-0 flex-1 rounded-xl border border-white/10 bg-black/30 px-3 py-2.5 text-sm outline-none placeholder:text-zinc-600 focus:border-violet-400/60" />
              <button type="submit" disabled={creating || !projectName.trim()} aria-label="Create project" className="grid size-10 shrink-0 place-items-center rounded-xl bg-violet-500 transition hover:bg-violet-400 disabled:cursor-not-allowed disabled:opacity-40">
                {creating ? <LoaderCircle className="size-4 animate-spin" /> : <Plus className="size-5" />}
              </button>
            </div>
          </form>
        </div>

        {error && (
          <div role="alert" className="mt-6 flex items-center gap-3 rounded-xl border border-red-400/20 bg-red-400/5 px-4 py-3 text-sm text-red-300">
            <AlertCircle className="size-4 shrink-0" />
            {error}
          </div>
        )}

        <section className="mt-10">
          <div className="flex items-end justify-between border-b border-white/10 pb-4">
            <div>
              <h2 className="text-xl font-semibold">Projects</h2>
              <p className="mt-1 text-sm text-zinc-500">{projects.length} {projects.length === 1 ? 'project' : 'projects'}</p>
            </div>
          </div>

          {projects.length === 0 ? (
            <div className="mt-6 flex min-h-72 items-center justify-center rounded-3xl border border-dashed border-white/15 bg-white/2 p-8 text-center">
              <div>
                <div className="mx-auto grid size-14 place-items-center rounded-2xl bg-white/5 text-zinc-400"><FolderOpen className="size-7" /></div>
                <h3 className="mt-5 font-medium">No projects yet</h3>
                <p className="mt-2 text-sm text-zinc-500">Name your first project above to get started.</p>
              </div>
            </div>
          ) : (
            <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {projects.map((project) => (
                <article key={project.id} className="group rounded-2xl border border-white/10 bg-white/3 p-5 transition hover:border-violet-400/30 hover:bg-white/5">
                  <div className="flex items-start justify-between gap-3">
                    <div className="grid size-10 shrink-0 place-items-center rounded-xl bg-violet-400/10 text-violet-300"><Film className="size-5" /></div>
                    <div className="flex gap-1">
                      <button type="button" onClick={() => beginRename(project)} disabled={busyId === project.id} aria-label={`Rename ${project.name}`} className="rounded-lg p-2 text-zinc-500 transition hover:bg-white/10 hover:text-white disabled:opacity-40"><Pencil className="size-4" /></button>
                      <button type="button" onClick={() => void handleDelete(project)} disabled={busyId === project.id} aria-label={`Delete ${project.name}`} className="rounded-lg p-2 text-zinc-500 transition hover:bg-red-400/10 hover:text-red-300 disabled:opacity-40">
                        {busyId === project.id && editingId !== project.id ? <LoaderCircle className="size-4 animate-spin" /> : <Trash2 className="size-4" />}
                      </button>
                    </div>
                  </div>

                  {editingId === project.id ? (
                    <form onSubmit={(event) => void handleRename(event, project.id)} className="mt-5">
                      <input autoFocus value={editingName} onChange={(event) => setEditingName(event.target.value)} maxLength={160} aria-label="Project name" className="w-full rounded-lg border border-violet-400/50 bg-black/30 px-3 py-2 text-sm outline-none" />
                      <div className="mt-2 flex justify-end gap-1">
                        <button type="button" onClick={() => setEditingId(null)} aria-label="Cancel rename" className="rounded-lg p-2 text-zinc-400 hover:bg-white/10"><X className="size-4" /></button>
                        <button type="submit" disabled={!editingName.trim() || busyId === project.id} aria-label="Save project name" className="rounded-lg bg-violet-500 p-2 text-white disabled:opacity-40">
                          {busyId === project.id ? <LoaderCircle className="size-4 animate-spin" /> : <Check className="size-4" />}
                        </button>
                      </div>
                    </form>
                  ) : (
                    <>
                      <h3 className="mt-5 truncate font-medium" title={project.name}>{project.name}</h3>
                      <div className="mt-3 flex items-center justify-between text-xs text-zinc-500">
                        <span className="rounded-full bg-white/5 px-2 py-1 capitalize">{project.status}</span>
                        <time dateTime={project.updatedAt}>Updated {formatDate(project.updatedAt)}</time>
                      </div>
                      <Link href={`/projects/${project.id}`} className="mt-4 flex items-center justify-center rounded-xl border border-violet-400/20 bg-violet-400/10 px-3 py-2 text-sm font-medium text-violet-200 transition hover:bg-violet-400/20">Open editor</Link>
                    </>
                  )}
                </article>
              ))}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
