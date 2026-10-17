'use client';

import {
  ArrowLeft, Captions, Check, ChevronLeft, ChevronRight, Clapperboard, Download, Film, FileText,
  LoaderCircle, Pause, Play, Redo2, Scissors, Sparkles, Trash2, Undo2, Upload,
} from 'lucide-react';
import Link from 'next/link';
import { use, useCallback, useEffect, useRef, useState } from 'react';

import {
  apiRequest, type CaptionTrack, type ClipSuggestion, type ExportJob, type LynvadoProject,
  type MediaAsset, type ProcessingJob, type SavedTimeline, type TimelineAspectRatio,
  type TimelineDocument, type Transcript,
} from '@/lib/api';

type SaveState = 'clean' | 'dirty' | 'saving' | 'saved' | 'error';
const ratios: TimelineAspectRatio[] = ['16:9', '9:16', '1:1', '4:5'];
const clone = (value: TimelineDocument): TimelineDocument => structuredClone(value);
const formatTime = (ms: number) => {
  const seconds = Math.max(0, ms) / 1000;
  return `${Math.floor(seconds / 60)}:${(seconds % 60).toFixed(1).padStart(4, '0')}`;
};

export default function EditorPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const videoRef = useRef<HTMLVideoElement>(null);
  const versionRef = useRef<number | null>(null);
  const initializedRef = useRef(false);
  const editRevisionRef = useRef(0);
  const saveSequenceRef = useRef<Promise<void>>(Promise.resolve());
  const exportRequestKeyRef = useRef<string | null>(null);
  const [project, setProject] = useState<LynvadoProject | null>(null);
  const [assets, setAssets] = useState<MediaAsset[]>([]);
  const [jobs, setJobs] = useState<ProcessingJob[]>([]);
  const [transcript, setTranscript] = useState<Transcript | null>(null);
  const [suggestions, setSuggestions] = useState<ClipSuggestion[]>([]);
  const [timeline, setTimeline] = useState<TimelineDocument | null>(null);
  const [past, setPast] = useState<TimelineDocument[]>([]);
  const [future, setFuture] = useState<TimelineDocument[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [playheadMs, setPlayheadMs] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [saveState, setSaveState] = useState<SaveState>('clean');
  const [exportJob, setExportJob] = useState<ExportJob | null>(null);
  const [exportBusy, setExportBusy] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [processing, setProcessing] = useState(false);
  const [retryBusy, setRetryBusy] = useState(false);
  const [aiPrompt, setAiPrompt] = useState('Remove filler and pauses, keep the strongest moments, and add captions.');
  const [aiStyle, setAiStyle] = useState<'auto' | 'highlights' | 'social' | 'clean'>('auto');
  const [aiBusy, setAiBusy] = useState(false);
  const [aiExplanation, setAiExplanation] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    Promise.all([
      apiRequest<LynvadoProject>(`/projects/${id}`),
      apiRequest<MediaAsset[]>(`/projects/${id}/media`),
      apiRequest<SavedTimeline | null>(`/projects/${id}/timeline`),
      apiRequest<CaptionTrack>(`/projects/${id}/captions`).catch(() => null),
      apiRequest<ProcessingJob[]>(`/projects/${id}/jobs`),
      apiRequest<Transcript>(`/projects/${id}/transcript`).catch(() => null),
      apiRequest<ClipSuggestion[]>(`/projects/${id}/clips`).catch(() => []),
    ]).then(([currentProject, currentAssets, saved, captions, currentJobs, currentTranscript, currentSuggestions]) => {
      if (!active) return;
      const source = currentAssets.find(({ kind }) => kind === 'proxy')
        ?? currentAssets.find(({ kind }) => kind === 'original');
      const initial: TimelineDocument = saved?.timeline ?? {
        schemaVersion: 1,
        aspectRatio: '16:9',
        videoTrack: { clips: source ? [{ id: crypto.randomUUID(), assetId: source.id, inMs: 0, outMs: Math.max(1, source.durationMs ?? 1) }] : [] },
        captionTrack: {
          enabled: true,
          items: captions?.segments.map((item) => ({ ...item })) ?? [],
        },
      };
      versionRef.current = saved?.version ?? null;
      setProject(currentProject);
      setAssets(currentAssets);
      setJobs(currentJobs);
      setTranscript(currentTranscript);
      setSuggestions(currentSuggestions);
      setTimeline(initial);
      setSelectedId(initial.videoTrack.clips[0]?.id ?? null);
      setProcessing(currentJobs.some((job) => ['ingestion', 'transcription', 'clip_generation'].includes(job.type) && ['queued', 'processing'].includes(job.status)));
      initializedRef.current = true;
      if (!saved && (initial.videoTrack.clips.length || initial.captionTrack.items.length)) setSaveState('dirty');
    }).catch((caught) => setError(caught instanceof Error ? caught.message : 'Could not load the editor.'))
      .finally(() => active && setLoading(false));
    return () => { active = false; };
  }, [id]);

  useEffect(() => {
    if (!processing) return;
    const timer = window.setInterval(() => {
      Promise.all([
        apiRequest<MediaAsset[]>(`/projects/${id}/media`),
        apiRequest<CaptionTrack>(`/projects/${id}/captions`).catch(() => null),
        apiRequest<ProcessingJob[]>(`/projects/${id}/jobs`),
        apiRequest<Transcript>(`/projects/${id}/transcript`).catch(() => null),
        apiRequest<ClipSuggestion[]>(`/projects/${id}/clips`).catch(() => []),
      ]).then(([currentAssets, captions, currentJobs, currentTranscript, currentSuggestions]) => {
        setAssets(currentAssets);
        setJobs(currentJobs);
        setTranscript(currentTranscript);
        setSuggestions(currentSuggestions);
        const processingJobs = currentJobs.filter((job) => ['ingestion', 'transcription', 'clip_generation'].includes(job.type));
        const failedJob = processingJobs.find((job) => job.status === 'failed');
        if (failedJob) {
          setProcessing(false);
          setActionError(`${failedJob.type.replace('_', ' ')} failed: ${failedJob.error ?? 'Unknown processing error.'}`);
          return;
        }
        if (processingJobs.some((job) => ['queued', 'processing'].includes(job.status))) return;
        const proxy = currentAssets.find(({ kind }) => kind === 'proxy');
        if (!proxy || !captions) return;
        setProcessing(false);
        setTimeline((current) => {
          if (current?.videoTrack.clips.length) return current;
          const next: TimelineDocument = {
            schemaVersion: 1,
            aspectRatio: '16:9',
            videoTrack: { clips: [{ id: crypto.randomUUID(), assetId: proxy.id, inMs: 0, outMs: Math.max(1, proxy.durationMs ?? 1) }] },
            captionTrack: { enabled: true, items: captions.segments.map((item) => ({ ...item })) },
          };
          setSelectedId(next.videoTrack.clips[0].id);
          editRevisionRef.current += 1;
          setSaveState('dirty');
          return next;
        });
      }).catch(() => undefined);
    }, 3000);
    return () => window.clearInterval(timer);
  }, [id, processing]);

  useEffect(() => {
    let active = true;
    apiRequest<ExportJob[]>(`/projects/${id}/exports`)
      .then((jobs) => { if (active) setExportJob(jobs[0] ?? null); })
      .catch(() => undefined);
    return () => { active = false; };
  }, [id]);

  useEffect(() => {
    if (!exportJob || !['queued', 'processing'].includes(exportJob.status)) return;
    const timer = window.setInterval(() => {
      apiRequest<ExportJob[]>(`/projects/${id}/exports`)
        .then((jobs) => setExportJob(jobs.find(({ id: jobId }) => jobId === exportJob.id) ?? jobs[0] ?? null))
        .catch(() => undefined);
    }, 2000);
    return () => window.clearInterval(timer);
  }, [exportJob, id]);

  useEffect(() => {
    if (!timeline || !initializedRef.current || saveState !== 'dirty') return;
    const snapshot = clone(timeline);
    const revision = editRevisionRef.current;
    const timer = window.setTimeout(() => {
      saveSequenceRef.current = saveSequenceRef.current.catch(() => undefined).then(async () => {
        setSaveState('saving');
        try {
          const saved = await apiRequest<SavedTimeline>(`/projects/${id}/timeline`, {
            method: 'PUT',
            body: JSON.stringify({ expectedVersion: versionRef.current, timeline: snapshot }),
          });
          versionRef.current = saved.version;
          setSaveState(editRevisionRef.current === revision ? 'saved' : 'dirty');
        } catch {
          setSaveState('error');
        }
      });
    }, 700);
    return () => window.clearTimeout(timer);
  }, [id, saveState, timeline]);

  const commit = useCallback((change: (current: TimelineDocument) => TimelineDocument) => {
    setTimeline((current) => {
      if (!current) return current;
      const next = change(clone(current));
      editRevisionRef.current += 1;
      setPast((items) => [...items.slice(-49), clone(current)]);
      setFuture([]);
      setSaveState('dirty');
      return next;
    });
  }, []);

  const undo = () => setPast((items) => {
    if (!timeline || !items.length) return items;
    const previous = items.at(-1)!;
    editRevisionRef.current += 1;
    setFuture((entries) => [clone(timeline), ...entries]);
    setTimeline(previous);
    setSaveState('dirty');
    return items.slice(0, -1);
  });
  const redo = () => setFuture((items) => {
    if (!timeline || !items.length) return items;
    const next = items[0];
    editRevisionRef.current += 1;
    setPast((entries) => [...entries, clone(timeline)]);
    setTimeline(next);
    setSaveState('dirty');
    return items.slice(1);
  });

  const clips = timeline?.videoTrack.clips ?? [];
  const selectedIndex = clips.findIndex(({ id: clipId }) => clipId === selectedId);
  const selected = selectedIndex >= 0 ? clips[selectedIndex] : null;
  const selectedAsset = assets.find(({ id: assetId }) => assetId === selected?.assetId);
  const totalDuration = clips.reduce((sum, clip) => sum + clip.outMs - clip.inMs, 0);
  const aspectClass = timeline?.aspectRatio === '9:16' ? 'aspect-[9/16]' : timeline?.aspectRatio === '1:1' ? 'aspect-square' : timeline?.aspectRatio === '4:5' ? 'aspect-[4/5]' : 'aspect-video';
  const activeCaption = timeline?.captionTrack.items.find((caption) => playheadMs >= caption.startMs && playheadMs <= caption.endMs);
  const activeProcessingJob = jobs.find((job) => ['ingestion', 'transcription', 'clip_generation'].includes(job.type) && ['queued', 'processing'].includes(job.status));
  const failedIngestionJob = jobs.find((job) => job.type === 'ingestion' && job.status === 'failed');

  const seek = (ms: number) => {
    const safe = selected ? Math.min(selected.outMs, Math.max(selected.inMs, ms)) : 0;
    setPlayheadMs(safe);
    if (videoRef.current) videoRef.current.currentTime = safe / 1000;
  };
  const togglePlay = async () => {
    const video = videoRef.current;
    if (!video || !selected) return;
    if (video.paused) { if (video.currentTime * 1000 < selected.inMs || video.currentTime * 1000 >= selected.outMs) seek(selected.inMs); await video.play(); }
    else video.pause();
  };
  const split = () => {
    if (!selected || playheadMs <= selected.inMs || playheadMs >= selected.outMs) return;
    const leftId = crypto.randomUUID();
    const rightId = crypto.randomUUID();
    commit((draft) => {
      draft.videoTrack.clips.splice(selectedIndex, 1,
        { ...selected, id: leftId, outMs: Math.round(playheadMs) },
        { ...selected, id: rightId, inMs: Math.round(playheadMs) });
      return draft;
    });
    setSelectedId(rightId);
  };
  const remove = () => {
    if (!selected) return;
    const fallback = clips[selectedIndex + 1]?.id ?? clips[selectedIndex - 1]?.id ?? null;
    commit((draft) => { draft.videoTrack.clips.splice(selectedIndex, 1); return draft; });
    setSelectedId(fallback);
  };
  const move = (offset: number) => {
    const target = selectedIndex + offset;
    if (!selected || target < 0 || target >= clips.length) return;
    commit((draft) => { const [item] = draft.videoTrack.clips.splice(selectedIndex, 1); draft.videoTrack.clips.splice(target, 0, item); return draft; });
  };
  const startExport = async () => {
    if (exportBusy || saveState === 'dirty' || saveState === 'saving' || !clips.length) return;
    setExportBusy(true);
    setActionError(null);
    try {
      const requestKey = exportRequestKeyRef.current
        ?? `export:${id}:${versionRef.current ?? 0}:${crypto.randomUUID()}`;
      exportRequestKeyRef.current = requestKey;
      setExportJob(await apiRequest<ExportJob>(`/projects/${id}/exports`, {
        method: 'POST',
        headers: { 'Idempotency-Key': requestKey },
      }));
      exportRequestKeyRef.current = null;
    } catch (caught) {
      setActionError(caught instanceof Error ? caught.message : 'Could not queue the export.');
    } finally {
      setExportBusy(false);
    }
  };
  const downloadExport = async () => {
    if (!exportJob?.downloadable) return;
    setExportBusy(true);
    setActionError(null);
    try {
      const result = await apiRequest<{ fileName: string; downloadUrl: string }>(`/projects/${id}/exports/${exportJob.id}/download`);
      const link = document.createElement('a');
      link.href = result.downloadUrl;
      link.download = result.fileName;
      link.rel = 'noopener';
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (caught) {
      setActionError(caught instanceof Error ? caught.message : 'Could not download the export.');
    } finally {
      setExportBusy(false);
    }
  };
  const uploadVideo = async (file: File) => {
    const mimeType = file.type || (file.name.toLowerCase().endsWith('.mkv') ? 'video/x-matroska' : 'video/mp4');
    setUploading(true);
    setUploadProgress(0);
    setActionError(null);
    try {
      const initialized = await apiRequest<{ uploadId: string; uploadUrl: string; headers: Record<string, string> }>(`/projects/${id}/uploads/init`, {
        method: 'POST',
        body: JSON.stringify({ fileName: file.name, mimeType, sizeBytes: file.size }),
      });
      await new Promise<void>((resolve, reject) => {
        const request = new XMLHttpRequest();
        request.open('PUT', initialized.uploadUrl);
        Object.entries(initialized.headers).forEach(([name, value]) => request.setRequestHeader(name, value));
        request.upload.onprogress = (event) => { if (event.lengthComputable) setUploadProgress(Math.round((event.loaded / event.total) * 100)); };
        request.onload = () => request.status >= 200 && request.status < 300 ? resolve() : reject(new Error(`Storage upload failed with status ${request.status}.`));
        request.onerror = () => reject(new Error('Could not upload the video to storage.'));
        request.send(file);
      });
      await apiRequest(`/projects/${id}/uploads/complete`, {
        method: 'POST', body: JSON.stringify({ uploadId: initialized.uploadId }),
      });
      setProcessing(true);
    } catch (caught) {
      setActionError(caught instanceof Error ? caught.message : 'Video upload failed.');
    } finally {
      setUploading(false);
    }
  };
  const runAiEdit = async () => {
    if (!aiPrompt.trim() || aiBusy || processing) return;
    setAiBusy(true);
    setActionError(null);
    try {
      const result = await apiRequest<{ timeline: SavedTimeline; explanation: string; model: string }>(`/projects/${id}/ai-edit`, {
        method: 'POST',
        body: JSON.stringify({ prompt: aiPrompt, style: aiStyle, expectedVersion: versionRef.current }),
      });
      if (timeline) setPast((items) => [...items.slice(-49), clone(timeline)]);
      versionRef.current = result.timeline.version;
      setTimeline(result.timeline.timeline);
      setSelectedId(result.timeline.timeline.videoTrack.clips[0]?.id ?? null);
      setFuture([]);
      setSaveState('saved');
      setAiExplanation(`${result.explanation} — ${result.model}`);
    } catch (caught) {
      setActionError(caught instanceof Error ? caught.message : 'AI editing failed.');
    } finally {
      setAiBusy(false);
    }
  };

  const retryProcessing = async () => {
    if (!failedIngestionJob || retryBusy) return;
    setRetryBusy(true);
    setActionError(null);
    try {
      const retried = await apiRequest<ProcessingJob>(`/projects/${id}/jobs/${failedIngestionJob.id}/retry`, {
        method: 'POST',
      });
      setJobs((items) => items.map((item) => item.id === retried.id ? retried : item));
      setProcessing(true);
    } catch (caught) {
      setActionError(caught instanceof Error ? caught.message : 'Could not retry video processing.');
    } finally {
      setRetryBusy(false);
    }
  };

  const applySuggestion = async (suggestion: ClipSuggestion) => {
    const source = assets.find(({ kind }) => kind === 'proxy');
    if (!source) return;
    const clipId = crypto.randomUUID();
    commit((draft) => {
      draft.videoTrack.clips = [{
        id: clipId,
        assetId: source.id,
        inMs: suggestion.startMs,
        outMs: Math.min(suggestion.endMs, source.durationMs ?? suggestion.endMs),
      }];
      return draft;
    });
    setSelectedId(clipId);
    setPlayheadMs(suggestion.startMs);
    if (videoRef.current) videoRef.current.currentTime = suggestion.startMs / 1000;
    try {
      const updated = await apiRequest<ClipSuggestion>(`/projects/${id}/clips/${suggestion.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ status: 'accepted' }),
      });
      setSuggestions((items) => items.map((item) => item.id === updated.id ? updated : item));
    } catch (caught) {
      setActionError(caught instanceof Error ? caught.message : 'Could not accept the suggestion.');
    }
  };

  if (loading) return <main className="studio-glow grid min-h-screen place-items-center text-zinc-400"><div className="flex items-center gap-3 rounded-2xl border border-white/8 bg-black/30 px-5 py-4"><LoaderCircle className="size-5 animate-spin text-violet-400" /> Opening studio…</div></main>;
  if (error || !project || !timeline) return <main className="studio-glow grid min-h-screen place-items-center p-6 text-red-300">{error ?? 'Project not found.'}</main>;

  return (
    <main className="min-h-screen bg-[#07080c] text-white">
      <header className="sticky top-0 z-30 flex min-h-16 flex-wrap items-center justify-between gap-3 border-b border-white/8 bg-[#08090d]/90 px-4 py-3 backdrop-blur-xl lg:px-6">
        <div className="flex min-w-0 items-center gap-3">
          <Link href="/dashboard" aria-label="Back to dashboard" className="rounded-xl border border-white/8 p-2 text-zinc-400 transition hover:bg-white/8 hover:text-white"><ArrowLeft className="size-4" /></Link>
          <div className="grid size-9 place-items-center rounded-xl bg-violet-500/12 text-violet-300"><Clapperboard className="size-4"/></div>
          <div className="min-w-0"><h1 className="truncate text-sm font-semibold">{project.name}</h1><p className="font-mono text-[9px] uppercase tracking-[.17em] text-zinc-600">Non-destructive editor</p></div>
        </div>
        <div className="flex items-center gap-2">
          <span className={`mr-1 hidden items-center gap-2 text-xs sm:flex ${saveState === 'error' ? 'text-red-300' : 'text-zinc-500'}`}><span className={`size-1.5 rounded-full ${saveState === 'error' ? 'bg-red-400' : saveState === 'saving' || saveState === 'dirty' ? 'bg-amber-400' : 'bg-emerald-400'}`}/>{saveState === 'saving' ? 'Saving…' : saveState === 'dirty' ? 'Unsaved' : saveState === 'error' ? 'Save failed' : 'Saved'}</span>
          <button onClick={undo} disabled={!past.length} aria-label="Undo" className="rounded-xl border border-white/8 p-2.5 text-zinc-300 transition hover:bg-white/5 disabled:opacity-25"><Undo2 className="size-4" /></button>
          <button onClick={redo} disabled={!future.length} aria-label="Redo" className="rounded-xl border border-white/8 p-2.5 text-zinc-300 transition hover:bg-white/5 disabled:opacity-25"><Redo2 className="size-4" /></button>
          {exportJob?.downloadable ? <button onClick={() => void downloadExport()} disabled={exportBusy} className="flex items-center gap-2 rounded-xl bg-emerald-400 px-4 py-2.5 text-sm font-semibold text-black disabled:opacity-40"><Download className="size-4" /> Download</button> : <button onClick={() => void startExport()} disabled={exportBusy || !clips.length || saveState === 'dirty' || saveState === 'saving' || saveState === 'error' || exportJob?.status === 'queued' || exportJob?.status === 'processing'} className="flex items-center gap-2 rounded-xl bg-violet-500 px-4 py-2.5 text-sm font-semibold shadow-[0_8px_24px_rgba(124,58,237,.22)] transition hover:bg-violet-400 disabled:opacity-40">{exportBusy || exportJob?.status === 'queued' || exportJob?.status === 'processing' ? <LoaderCircle className="size-4 animate-spin" /> : <Upload className="size-4" />} {exportJob?.status === 'processing' ? `Exporting ${exportJob.progress}%` : exportJob?.status === 'queued' ? 'Queued' : 'Export video'}</button>}
        </div>
      </header>

      {exportJob?.status === 'failed' && <div className="border-b border-red-400/20 bg-red-400/5 px-6 py-2 text-xs text-red-300">Export failed: {exportJob.error ?? 'Unknown rendering error.'}</div>}
      {actionError && <div className="border-b border-red-400/20 bg-red-400/5 px-6 py-2 text-xs text-red-300">{actionError}</div>}

      <div className="studio-grid grid min-h-[calc(100vh-65px)] grid-rows-[1fr_auto]">
        <div className="grid items-start gap-4 p-4 lg:grid-cols-[minmax(0,1fr)_360px] lg:p-5 xl:grid-cols-[minmax(0,1fr)_390px]">
          <section className="flex min-h-[520px] flex-col rounded-2xl border border-white/8 bg-[#0d0f15]/95 p-3 shadow-2xl shadow-black/20 lg:min-h-[calc(100vh-238px)]">
            <div className="flex flex-1 items-center justify-center overflow-hidden rounded-xl border border-white/5 bg-black/80 p-4">
              {selectedAsset?.downloadUrl ? <div className={`relative max-h-[60vh] w-full max-w-4xl ${aspectClass}`}>
                <video ref={videoRef} src={selectedAsset.downloadUrl} className="size-full bg-black object-contain" onPlay={() => setPlaying(true)} onPause={() => setPlaying(false)} onTimeUpdate={(event) => {
                  const current = event.currentTarget.currentTime * 1000; setPlayheadMs(current);
                  if (selected && current >= selected.outMs) { event.currentTarget.pause(); seek(selected.inMs); }
                }} />
                {timeline.captionTrack.enabled && activeCaption?.text && <div className="pointer-events-none absolute inset-x-6 bottom-8 text-center"><span className="rounded bg-black/75 px-3 py-1.5 text-sm font-medium shadow">{activeCaption.text}</span></div>}
              </div> : <div className="text-center text-zinc-500"><Film className="mx-auto mb-3 size-10" /><p>No processed video yet.</p><p className="mt-1 text-sm">Upload a video and wait for its proxy to be generated.</p></div>}
            </div>
            <div className="mt-4 flex items-center gap-3">
              <button onClick={() => void togglePlay()} disabled={!selectedAsset} className="grid size-10 place-items-center rounded-full bg-white text-black transition hover:bg-violet-100 disabled:opacity-30">{playing ? <Pause className="size-4" /> : <Play className="ml-0.5 size-4" />}</button>
              <span className="w-14 text-xs tabular-nums text-zinc-400">{formatTime(playheadMs)}</span>
              <input type="range" min={selected?.inMs ?? 0} max={selected?.outMs ?? 1} value={playheadMs} onChange={(event) => seek(Number(event.target.value))} className="w-full accent-violet-500" />
              <span className="w-14 text-right text-xs tabular-nums text-zinc-400">{formatTime(selected?.outMs ?? 0)}</span>
            </div>
          </section>

          <aside className="space-y-3 lg:sticky lg:top-21 lg:max-h-[calc(100vh-100px)] lg:overflow-y-auto lg:pr-1">
            <section className="rounded-2xl border border-violet-400/20 bg-violet-400/5 p-4">
              <h2 className="flex items-center gap-2 text-sm font-semibold"><Upload className="size-4 text-violet-300" /> Video source</h2>
              <label className={`mt-3 flex cursor-pointer items-center justify-center rounded-xl border border-dashed border-violet-400/30 px-3 py-3 text-sm text-violet-200 transition hover:bg-violet-400/10 ${uploading ? 'pointer-events-none opacity-50' : ''}`}>
                <input type="file" accept="video/mp4,video/quicktime,video/webm,video/x-matroska,.mkv" className="hidden" onChange={(event) => { const file = event.target.files?.[0]; if (file) void uploadVideo(file); event.currentTarget.value = ''; }} />
                {uploading ? `Uploading ${uploadProgress}%` : assets.some(({ kind }) => kind === 'original') ? 'Upload another video' : 'Choose a video'}
              </label>
              {processing && <div className="mt-3 flex items-center gap-2 text-xs text-amber-300"><LoaderCircle className="size-3.5 animate-spin" /> {activeProcessingJob ? `${activeProcessingJob.type.replace('_', ' ')} ${activeProcessingJob.progress}%` : 'Starting processing…'}</div>}
              {!processing && failedIngestionJob && <div className="mt-3 rounded-lg border border-red-400/20 bg-red-400/5 p-2.5"><p className="text-xs leading-5 text-red-300">{failedIngestionJob.error ?? 'Video processing failed.'}</p><button onClick={() => void retryProcessing()} disabled={retryBusy} className="mt-2 flex items-center gap-2 text-xs font-medium text-violet-200 disabled:opacity-50">{retryBusy && <LoaderCircle className="size-3 animate-spin" />}Retry processing</button></div>}
            </section>
            <section className="rounded-2xl border border-fuchsia-400/20 bg-gradient-to-br from-violet-500/12 to-fuchsia-500/5 p-5 shadow-xl shadow-black/10">
              <h2 className="flex items-center gap-2 text-sm font-semibold"><Sparkles className="size-4 text-fuchsia-300" /> AI editor · Ollama</h2>
              <div className="mt-3 grid grid-cols-2 gap-2">{(['auto', 'highlights', 'social', 'clean'] as const).map((style) => <button key={style} onClick={() => setAiStyle(style)} className={`rounded-lg border px-2 py-2 text-xs capitalize ${aiStyle === style ? 'border-fuchsia-400 bg-fuchsia-400/15 text-fuchsia-100' : 'border-white/10 text-zinc-400'}`}>{style}</button>)}</div>
              <textarea value={aiPrompt} onChange={(event) => setAiPrompt(event.target.value)} rows={4} maxLength={2000} placeholder="Example: Make a 45-second vertical highlight. Remove filler and keep the product announcement." className="mt-3 w-full resize-none rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm outline-none placeholder:text-zinc-600 focus:border-fuchsia-400/50" />
              <button onClick={() => void runAiEdit()} disabled={aiBusy || processing || !aiPrompt.trim() || !assets.some(({ kind }) => kind === 'proxy')} className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-violet-500 to-fuchsia-500 px-3 py-3 text-sm font-semibold shadow-[0_10px_30px_rgba(168,85,247,.18)] transition hover:brightness-110 disabled:opacity-40">{aiBusy ? <LoaderCircle className="size-4 animate-spin" /> : <Sparkles className="size-4" />}{aiBusy ? 'Ollama is editing…' : 'Generate AI edit'}</button>
              {aiExplanation && <p className="mt-3 text-xs leading-5 text-zinc-400">{aiExplanation}</p>}
            </section>
            <section className="rounded-2xl border border-white/10 bg-white/3 p-4"><h2 className="text-sm font-semibold">Canvas</h2><div className="mt-3 grid grid-cols-4 gap-2">{ratios.map((ratio) => <button key={ratio} onClick={() => commit((draft) => { draft.aspectRatio = ratio; return draft; })} className={`rounded-lg border px-2 py-2 text-xs ${timeline.aspectRatio === ratio ? 'border-violet-400 bg-violet-400/15 text-violet-200' : 'border-white/10 text-zinc-400'}`}>{ratio}</button>)}</div></section>
            <section className="rounded-2xl border border-white/10 bg-white/3 p-4">
              <h2 className="text-sm font-semibold">Clip inspector</h2>
              {selected ? <div className="mt-4 space-y-4">
                <label className="block text-xs text-zinc-400">In point (seconds)<input type="number" min={0} step={0.1} value={(selected.inMs / 1000).toFixed(1)} onChange={(event) => commit((draft) => { draft.videoTrack.clips[selectedIndex].inMs = Math.min(Math.round(Number(event.target.value) * 1000), selected.outMs - 1); return draft; })} className="mt-1 w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-white" /></label>
                <label className="block text-xs text-zinc-400">Out point (seconds)<input type="number" min={(selected.inMs + 1) / 1000} step={0.1} value={(selected.outMs / 1000).toFixed(1)} onChange={(event) => commit((draft) => { draft.videoTrack.clips[selectedIndex].outMs = Math.max(selected.inMs + 1, Math.round(Number(event.target.value) * 1000)); return draft; })} className="mt-1 w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-white" /></label>
                <div className="grid grid-cols-4 gap-2"><button onClick={() => move(-1)} disabled={selectedIndex === 0} aria-label="Move clip left" className="rounded-lg border border-white/10 p-2 disabled:opacity-30"><ChevronLeft className="mx-auto size-4" /></button><button onClick={split} aria-label="Split clip" className="rounded-lg border border-white/10 p-2"><Scissors className="mx-auto size-4" /></button><button onClick={remove} aria-label="Delete clip" className="rounded-lg border border-red-400/20 p-2 text-red-300"><Trash2 className="mx-auto size-4" /></button><button onClick={() => move(1)} disabled={selectedIndex === clips.length - 1} aria-label="Move clip right" className="rounded-lg border border-white/10 p-2 disabled:opacity-30"><ChevronRight className="mx-auto size-4" /></button></div>
              </div> : <p className="mt-3 text-sm text-zinc-500">Select a clip to edit it.</p>}
            </section>
            <section className="max-h-72 overflow-auto rounded-2xl border border-white/10 bg-white/3 p-4">
              <div className="flex items-center justify-between"><h2 className="flex items-center gap-2 text-sm font-semibold"><Captions className="size-4" /> Captions</h2><button onClick={() => commit((draft) => { draft.captionTrack.enabled = !draft.captionTrack.enabled; return draft; })} className="text-xs text-violet-300">{timeline.captionTrack.enabled ? 'Visible' : 'Hidden'}</button></div>
              <div className="mt-3 space-y-2">{timeline.captionTrack.items.length ? timeline.captionTrack.items.map((caption, index) => <label key={caption.id} className="block"><span className="text-[10px] text-zinc-600">{formatTime(caption.startMs)} – {formatTime(caption.endMs)}</span><textarea value={caption.text} rows={2} onChange={(event) => commit((draft) => { draft.captionTrack.items[index].text = event.target.value; return draft; })} className="mt-1 w-full resize-none rounded-lg border border-white/10 bg-black/30 px-2 py-1.5 text-xs outline-none focus:border-violet-400/50" /></label>) : <p className="text-xs text-zinc-500">No captions generated yet.</p>}</div>
            </section>
            <section className="max-h-80 overflow-auto rounded-2xl border border-white/10 bg-white/3 p-4">
              <h2 className="flex items-center gap-2 text-sm font-semibold"><Sparkles className="size-4 text-fuchsia-300" /> Suggested clips</h2>
              <div className="mt-3 space-y-2">{suggestions.length ? suggestions.map((suggestion) => <article key={suggestion.id} className="rounded-xl border border-white/10 bg-black/20 p-3">
                <div className="flex items-start justify-between gap-2"><div><h3 className="text-xs font-medium">{suggestion.title}</h3><p className="mt-1 text-[10px] text-zinc-500">{formatTime(suggestion.startMs)} – {formatTime(suggestion.endMs)} · score {Math.round(suggestion.score)}%</p></div>{suggestion.status === 'accepted' && <Check className="size-4 shrink-0 text-emerald-400" />}</div>
                <p className="mt-2 text-xs leading-5 text-zinc-400">{suggestion.reason}</p>
                <button onClick={() => void applySuggestion(suggestion)} className="mt-2 rounded-lg border border-violet-400/30 px-2.5 py-1.5 text-xs text-violet-200 hover:bg-violet-400/10">Use this clip</button>
              </article>) : <p className="text-xs text-zinc-500">Suggestions appear after transcription finishes.</p>}</div>
            </section>
            <section className="max-h-80 overflow-auto rounded-2xl border border-white/10 bg-white/3 p-4">
              <h2 className="flex items-center gap-2 text-sm font-semibold"><FileText className="size-4" /> Transcript</h2>
              <div className="mt-3 space-y-1">{transcript?.segments.length ? transcript.segments.map((segment) => <button key={segment.id} onClick={() => seek(segment.startMs)} className="block w-full rounded-lg px-2 py-2 text-left hover:bg-white/5"><span className="mr-2 text-[10px] tabular-nums text-violet-300">{formatTime(segment.startMs)}</span><span className="text-xs leading-5 text-zinc-300">{segment.text}</span></button>) : <p className="text-xs text-zinc-500">No transcript generated yet.</p>}</div>
            </section>
          </aside>
        </div>

        <section className="border-t border-white/8 bg-[#090b10]/95 p-4 backdrop-blur lg:px-5">
          <div className="mb-3 flex items-center justify-between"><h2 className="text-sm font-semibold">Timeline</h2><span className="text-xs text-zinc-500">{clips.length} clips · {formatTime(totalDuration)}</span></div>
          <div className="flex min-h-24 gap-1 overflow-x-auto rounded-xl border border-white/10 bg-black/30 p-3">
            {clips.length ? clips.map((clip, index) => <button key={clip.id} onClick={() => { setSelectedId(clip.id); seek(clip.inMs); }} style={{ flexGrow: Math.max(1, clip.outMs - clip.inMs), flexBasis: 90 }} className={`relative min-w-24 overflow-hidden rounded-lg border p-3 text-left ${clip.id === selectedId ? 'border-violet-400 bg-violet-500/25' : 'border-violet-400/20 bg-violet-500/10 hover:bg-violet-500/15'}`}><span className="block truncate text-xs font-medium">Clip {index + 1}</span><span className="mt-2 block text-[10px] text-zinc-400">{formatTime(clip.inMs)} → {formatTime(clip.outMs)}</span></button>) : <div className="grid w-full place-items-center text-sm text-zinc-600">No clips on the timeline</div>}
          </div>
        </section>
      </div>
    </main>
  );
}
