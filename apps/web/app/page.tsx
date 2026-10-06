import Link from 'next/link';

export default function HomePage() {
  return (
    <main className="min-h-screen bg-[#07090d] text-white">
      <div className="mx-auto flex min-h-screen max-w-7xl flex-col px-6">
        <nav className="flex h-20 items-center justify-between border-b border-white/10">
          <Link
            href="/"
            className="text-xl font-semibold tracking-tight"
          >
            Lynvado{' '}

            <span className="text-violet-400">
              Studio
            </span>
          </Link>

          <div className="flex items-center gap-3">
            <Link
              href="/login"
              className="rounded-xl px-4 py-2 text-sm text-zinc-300 transition hover:bg-white/5 hover:text-white"
            >
              Sign in
            </Link>

            <Link
              href="/register"
              className="rounded-xl bg-white px-4 py-2 text-sm font-medium text-black transition hover:bg-zinc-200"
            >
              Get started
            </Link>
          </div>
        </nav>

        <section className="flex flex-1 items-center py-24">
          <div className="max-w-4xl">
            <div className="mb-6 inline-flex rounded-full border border-violet-400/20 bg-violet-400/10 px-4 py-2 text-sm text-violet-300">
              AI-native video creation
              &amp; repurposing
            </div>

            <h1 className="max-w-4xl text-5xl font-semibold leading-[1.05] tracking-tight sm:text-7xl">
              Turn long videos into

              <span className="block bg-linear-to-r from-violet-400 to-sky-400 bg-clip-text text-transparent">
                content worth watching.
              </span>
            </h1>

            <p className="mt-8 max-w-2xl text-lg leading-8 text-zinc-400">
              Upload, edit, transcribe,
              generate short clips, add
              captions and control your
              workflow with AI.
            </p>

            <div className="mt-10 flex flex-wrap gap-4">
              <Link
                href="/register"
                className="rounded-2xl bg-white px-6 py-3 font-medium text-black transition hover:bg-zinc-200"
              >
                Start creating
              </Link>

              <Link
                href="/login"
                className="rounded-2xl border border-white/10 bg-white/5 px-6 py-3 font-medium text-white transition hover:bg-white/10"
              >
                Sign in
              </Link>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
