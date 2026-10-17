import { spawn } from 'node:child_process';

import { workerConfig } from './config.js';

export interface ExportSize { width: number; height: number }

interface ProbeStream {
  codec_type?: string;
  width?: number;
  height?: number;
  duration?: string;
}

interface ProbeOutput {
  streams?: ProbeStream[];
  format?: { duration?: string };
}

export interface MediaMetadata {
  durationMs: number;
  width: number;
  height: number;
  hasAudio: boolean;
}

export async function probeMedia(inputPath: string): Promise<MediaMetadata> {
  const output = await runProcess(workerConfig.FFPROBE_PATH, [
    '-v',
    'error',
    '-show_entries',
    'format=duration:stream=codec_type,width,height,duration',
    '-of',
    'json',
    inputPath,
  ]);
  const parsed = JSON.parse(output) as ProbeOutput;
  const video = parsed.streams?.find((stream) => stream.codec_type === 'video');
  const durationSeconds = Number(parsed.format?.duration ?? video?.duration ?? 0);

  if (!video?.width || !video.height || !Number.isFinite(durationSeconds)) {
    throw new Error('Uploaded file does not contain a valid video stream.');
  }

  return {
    durationMs: Math.max(0, Math.round(durationSeconds * 1000)),
    width: video.width,
    height: video.height,
    hasAudio: parsed.streams?.some((stream) => stream.codec_type === 'audio') ?? false,
  };
}

export async function createProxy(inputPath: string, outputPath: string): Promise<void> {
  await runProcess(workerConfig.FFMPEG_PATH, [
    '-y',
    '-i',
    inputPath,
    '-map',
    '0:v:0',
    '-map',
    '0:a?',
    '-vf',
    "scale='min(1280,iw)':-2",
    '-c:v',
    'libx264',
    '-preset',
    'veryfast',
    '-crf',
    '24',
    '-pix_fmt',
    'yuv420p',
    '-c:a',
    'aac',
    '-b:a',
    '128k',
    '-ac',
    '2',
    '-movflags',
    '+faststart',
    outputPath,
  ]);
}

export async function createThumbnail(
  inputPath: string,
  outputPath: string,
  durationMs: number,
): Promise<void> {
  const seekSeconds = Math.max(0, Math.min(durationMs / 10_000, 30));

  await runProcess(workerConfig.FFMPEG_PATH, [
    '-y',
    '-ss',
    seekSeconds.toFixed(3),
    '-i',
    inputPath,
    '-frames:v',
    '1',
    '-vf',
    "scale='min(640,iw)':-2",
    '-q:v',
    '2',
    outputPath,
  ]);
}

export async function createNormalizedAudio(
  inputPath: string,
  outputPath: string,
  hasAudio: boolean,
): Promise<void> {
  if (!hasAudio) {
    throw new Error('Uploaded video does not contain an audio stream.');
  }

  await runProcess(workerConfig.FFMPEG_PATH, [
    '-y',
    '-i',
    inputPath,
    '-vn',
    '-ac',
    '1',
    '-ar',
    '16000',
    '-c:a',
    'pcm_s16le',
    outputPath,
  ]);
}

export async function renderTimelineSegment(
  inputPath: string,
  outputPath: string,
  inMs: number,
  durationMs: number,
  size: ExportSize,
): Promise<void> {
  await runProcess(workerConfig.FFMPEG_PATH, [
    '-y', '-ss', (inMs / 1000).toFixed(3), '-t', (durationMs / 1000).toFixed(3),
    '-i', inputPath,
    '-map', '0:v:0', '-map', '0:a?',
    '-vf', `scale=${size.width}:${size.height}:force_original_aspect_ratio=decrease,pad=${size.width}:${size.height}:(ow-iw)/2:(oh-ih)/2:black`,
    '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '20', '-pix_fmt', 'yuv420p',
    '-c:a', 'aac', '-b:a', '192k', '-ar', '48000', '-ac', '2',
    outputPath,
  ]);
}

export async function concatenateSegments(
  concatFilePath: string,
  outputPath: string,
): Promise<void> {
  await runProcess(workerConfig.FFMPEG_PATH, [
    '-y', '-f', 'concat', '-safe', '0', '-i', concatFilePath,
    '-c', 'copy', '-movflags', '+faststart', outputPath,
  ]);
}

export async function burnCaptions(
  inputPath: string,
  subtitlePath: string,
  outputPath: string,
): Promise<void> {
  const escaped = subtitlePath
    .replaceAll('\\', '/')
    .replaceAll(':', '\\:')
    .replaceAll("'", "\\'");
  await runProcess(workerConfig.FFMPEG_PATH, [
    '-y', '-i', inputPath,
    '-vf', `subtitles='${escaped}':force_style='FontName=Arial,FontSize=22,PrimaryColour=&H00FFFFFF,OutlineColour=&H80000000,BorderStyle=3,Outline=1,Shadow=0,MarginV=36'`,
    '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '20', '-pix_fmt', 'yuv420p',
    '-c:a', 'copy', '-movflags', '+faststart', outputPath,
  ]);
}

async function runProcess(command: string, args: string[]): Promise<string> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      windowsHide: true,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    const stdout: Buffer[] = [];
    const stderr: Buffer[] = [];

    child.stdout.on('data', (chunk: Buffer) => stdout.push(chunk));
    child.stderr.on('data', (chunk: Buffer) => stderr.push(chunk));
    child.once('error', reject);
    child.once('close', (code) => {
      if (code === 0) {
        resolve(Buffer.concat(stdout).toString('utf8'));
        return;
      }

      reject(
        new Error(
          `${command} exited with code ${code ?? 'unknown'}: ${Buffer.concat(stderr).toString('utf8').slice(-4000)}`,
        ),
      );
    });
  });
}
