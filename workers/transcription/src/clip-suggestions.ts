export interface SourceSegment {
  start_ms: number;
  end_ms: number;
  text: string;
  confidence: number | null;
}

export interface GeneratedClipSuggestion {
  startMs: number;
  endMs: number;
  title: string;
  score: number;
  reason: string;
  signals: {
    hookStrength: number;
    topicCompleteness: number;
    speechQuality: number;
    semanticImportance: number;
    boundaryQuality: number;
    durationFit: number;
    visualContinuity: number;
  };
}

const hookPattern = /\b(how|why|secret|mistake|never|best|worst|imagine|what if|here's|did you know)\b|\?/i;
const fillerPattern = /\b(um+|uh+|like|you know|basically|actually)\b/gi;

export function generateClipSuggestions(
  segments: SourceSegment[],
): GeneratedClipSuggestion[] {
  const candidates: GeneratedClipSuggestion[] = [];

  for (let start = 0; start < segments.length; start += 2) {
    const window: SourceSegment[] = [];
    for (let index = start; index < segments.length; index += 1) {
      window.push(segments[index]!);
      const duration = window.at(-1)!.end_ms - window[0]!.start_ms;
      if (duration >= 20_000) {
        candidates.push(scoreWindow(window));
      }
      if (duration >= 60_000) break;
    }
  }

  return candidates
    .sort((left, right) => right.score - left.score)
    .filter((candidate, index, all) =>
      all.slice(0, index).every((selected) => overlapRatio(candidate, selected) < 0.6),
    )
    .slice(0, 8);
}

function scoreWindow(window: SourceSegment[]): GeneratedClipSuggestion {
  const first = window[0]!;
  const last = window.at(-1)!;
  const text = window.map((segment) => segment.text.trim()).join(' ');
  const durationSeconds = (last.end_ms - first.start_ms) / 1000;
  const confidences = window
    .map((segment) => segment.confidence)
    .filter((value): value is number => value !== null);
  const words = text.split(/\s+/).filter(Boolean);
  const fillerCount = text.match(fillerPattern)?.length ?? 0;

  const signals = {
    hookStrength: clamp(hookPattern.test(first.text) ? 92 : 55 + Math.min(first.text.length, 30)),
    topicCompleteness: clamp(/[.!?]["']?$/.test(last.text.trim()) ? 90 : 58),
    speechQuality: clamp(
      (confidences.length > 0
        ? confidences.reduce((sum, value) => sum + value, 0) / confidences.length
        : 0.75) * 100 - fillerCount * 3,
    ),
    semanticImportance: clamp(55 + Math.min(35, new Set(words.map((word) => word.toLowerCase())).size / 2)),
    boundaryQuality: clamp(
      (/[A-Z0-9]/.test(first.text.trim().charAt(0)) ? 45 : 30) +
        (/[.!?]["']?$/.test(last.text.trim()) ? 45 : 25),
    ),
    durationFit: clamp(100 - Math.abs(durationSeconds - 35) * 2.5),
    visualContinuity: 70,
  };
  const score = round(
    signals.hookStrength * 0.2 +
      signals.topicCompleteness * 0.2 +
      signals.speechQuality * 0.15 +
      signals.semanticImportance * 0.15 +
      signals.boundaryQuality * 0.1 +
      signals.durationFit * 0.1 +
      signals.visualContinuity * 0.1,
  );
  const strongest = Object.entries(signals)
    .sort(([, left], [, right]) => right - left)
    .slice(0, 2)
    .map(([name]) => name.replace(/[A-Z]/g, (letter) => ` ${letter.toLowerCase()}`));

  return {
    startMs: first.start_ms,
    endMs: last.end_ms,
    title: createTitle(text),
    score,
    reason: `Strong ${strongest[0]} and ${strongest[1]}; ${Math.round(durationSeconds)}s self-contained window.`,
    signals,
  };
}

function createTitle(text: string): string {
  const sentence = text.split(/(?<=[.!?])\s/)[0] ?? text;
  return sentence.length <= 72 ? sentence : `${sentence.slice(0, 69).trimEnd()}...`;
}

function overlapRatio(left: GeneratedClipSuggestion, right: GeneratedClipSuggestion): number {
  const overlap = Math.max(0, Math.min(left.endMs, right.endMs) - Math.max(left.startMs, right.startMs));
  return overlap / Math.min(left.endMs - left.startMs, right.endMs - right.startMs);
}

function clamp(value: number): number {
  return Math.max(0, Math.min(100, round(value)));
}

function round(value: number): number {
  return Math.round(value * 100) / 100;
}
