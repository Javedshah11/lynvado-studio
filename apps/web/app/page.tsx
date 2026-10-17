import { ArrowRight, Captions, Clapperboard, Cpu, Scissors, Sparkles, UploadCloud } from 'lucide-react';
import Link from 'next/link';

const steps = [
  { icon: UploadCloud, label: 'Upload', detail: 'Direct to private storage' },
  { icon: Cpu, label: 'Understand', detail: 'Local Whisper + Ollama' },
  { icon: Scissors, label: 'Edit', detail: 'Prompt or timeline control' },
  { icon: Clapperboard, label: 'Export', detail: 'Render a finished MP4' },
];

export default function HomePage() {
  return (
    <main className="studio-glow min-h-screen overflow-hidden text-white">
      <div className="studio-grid min-h-screen">
        <nav className="mx-auto flex h-20 max-w-7xl items-center justify-between px-5 sm:px-8">
          <Link href="/" className="flex items-center gap-3">
            <span className="grid size-10 place-items-center rounded-xl border border-violet-300/20 bg-violet-500/15 shadow-[0_0_30px_rgba(139,92,246,.2)]"><Clapperboard className="size-5 text-violet-300" /></span>
            <span className="text-[15px] font-semibold tracking-tight">LYNVADO <span className="text-zinc-500">/ STUDIO</span></span>
          </Link>
          <div className="flex items-center gap-2">
            <Link href="/login" className="rounded-xl px-4 py-2.5 text-sm text-zinc-300 transition hover:bg-white/5 hover:text-white">Sign in</Link>
            <Link href="/register" className="rounded-xl bg-white px-4 py-2.5 text-sm font-semibold text-zinc-950 transition hover:bg-violet-100">Open studio</Link>
          </div>
        </nav>

        <section className="mx-auto grid max-w-7xl items-center gap-14 px-5 pb-20 pt-16 sm:px-8 lg:grid-cols-[1.05fr_.95fr] lg:pb-28 lg:pt-24">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-violet-300/15 bg-violet-400/8 px-3 py-1.5 text-xs font-medium text-violet-200"><span className="size-1.5 rounded-full bg-emerald-400 shadow-[0_0_12px_#34d399]" /> Private, local AI video editing</div>
            <h1 className="mt-7 max-w-3xl text-5xl font-semibold leading-[.98] tracking-[-.055em] sm:text-7xl">Your footage.<br /><span className="bg-linear-to-r from-violet-300 via-fuchsia-200 to-sky-300 bg-clip-text text-transparent">One clear prompt.</span><br />A finished edit.</h1>
            <p className="mt-7 max-w-xl text-base leading-7 text-zinc-400 sm:text-lg">Upload long-form video, describe the story you want, then refine the AI cut with a precise non-destructive timeline. Your models run locally with Ollama and Whisper.</p>
            <div className="mt-9 flex flex-wrap items-center gap-3">
              <Link href="/register" className="group flex items-center gap-2 rounded-xl bg-violet-500 px-5 py-3 text-sm font-semibold shadow-[0_12px_40px_rgba(124,58,237,.28)] transition hover:bg-violet-400">Create your first edit <ArrowRight className="size-4 transition group-hover:translate-x-0.5" /></Link>
              <span className="px-2 text-xs text-zinc-500">No paid AI key required</span>
            </div>
          </div>

          <div className="relative mx-auto w-full max-w-xl">
            <div className="absolute -inset-8 rounded-full bg-violet-500/10 blur-3xl" />
            <div className="relative overflow-hidden rounded-[28px] border border-white/12 bg-[#0c0e14]/95 shadow-2xl shadow-black/50">
              <div className="flex items-center justify-between border-b border-white/8 px-5 py-4">
                <div className="flex items-center gap-2"><span className="size-2 rounded-full bg-red-400/70"/><span className="size-2 rounded-full bg-amber-300/70"/><span className="size-2 rounded-full bg-emerald-400/70"/></div>
                <span className="font-mono text-[10px] uppercase tracking-[.22em] text-zinc-600">AI edit session</span>
                <span className="rounded-full bg-emerald-400/10 px-2 py-1 text-[10px] text-emerald-300">Local</span>
              </div>
              <div className="p-5">
                <div className="relative aspect-video overflow-hidden rounded-2xl border border-white/8 bg-black">
                  <div className="absolute inset-0 bg-[radial-gradient(circle_at_65%_35%,rgba(139,92,246,.28),transparent_34%),linear-gradient(135deg,#111827,#050609)]" />
                  <div className="absolute inset-x-5 bottom-5 rounded-xl border border-white/10 bg-black/60 p-3 backdrop-blur"><div className="flex items-center gap-2 text-xs text-white"><Sparkles className="size-3.5 text-fuchsia-300"/> “Make a 35-second vertical product highlight.”</div></div>
                </div>
                <div className="mt-4 grid grid-cols-3 gap-2">
                  <div className="rounded-xl border border-white/8 bg-white/3 p-3"><Captions className="size-4 text-sky-300"/><p className="mt-3 text-xs font-medium">Captions</p><p className="mt-1 text-[10px] text-zinc-500">Timed and editable</p></div>
                  <div className="rounded-xl border border-violet-300/20 bg-violet-500/10 p-3"><Scissors className="size-4 text-violet-300"/><p className="mt-3 text-xs font-medium">3 clips</p><p className="mt-1 text-[10px] text-zinc-500">AI-selected moments</p></div>
                  <div className="rounded-xl border border-white/8 bg-white/3 p-3"><Clapperboard className="size-4 text-emerald-300"/><p className="mt-3 text-xs font-medium">Ready</p><p className="mt-1 text-[10px] text-zinc-500">1080 × 1920 MP4</p></div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-7xl px-5 pb-20 sm:px-8">
          <div className="grid overflow-hidden rounded-2xl border border-white/8 bg-white/[.025] sm:grid-cols-2 lg:grid-cols-4">
            {steps.map(({ icon: Icon, label, detail }, index) => <div key={label} className="relative border-white/8 p-5 sm:not-last:border-r"><span className="font-mono text-[10px] text-zinc-600">0{index + 1}</span><Icon className="mt-5 size-5 text-violet-300"/><h2 className="mt-3 text-sm font-medium">{label}</h2><p className="mt-1 text-xs text-zinc-500">{detail}</p></div>)}
          </div>
        </section>
      </div>
    </main>
  );
}
