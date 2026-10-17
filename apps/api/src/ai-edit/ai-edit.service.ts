import { randomUUID } from 'node:crypto';
import { BadGatewayException, BadRequestException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { and, asc, desc, eq } from 'drizzle-orm';
import {
  captionSegments, captionTracks, mediaAssets,
  transcriptSegments, transcripts,
} from '@lynvado/database';

import { DatabaseService } from '../database/database.service.js';
import { EditorService } from '../editor/editor.service.js';
import { ProjectsService } from '../projects/projects.service.js';
import { type AiEditRequest, ollamaEditSchema } from './ai-edit.schema.js';

interface OllamaResponse { message?: { content?: string } }

@Injectable()
export class AiEditService {
  private readonly ollamaUrl: string;
  private readonly model: string;

  constructor(
    private readonly database: DatabaseService,
    private readonly projectsService: ProjectsService,
    private readonly editorService: EditorService,
    config: ConfigService,
  ) {
    this.ollamaUrl = config.getOrThrow<string>('OLLAMA_URL').replace(/\/$/, '');
    this.model = config.getOrThrow<string>('OLLAMA_MODEL');
  }

  async edit(ownerId: string, projectId: string, input: AiEditRequest) {
    await this.projectsService.findOne(ownerId, projectId);
    const [asset] = await this.database.db.select().from(mediaAssets)
      .where(and(eq(mediaAssets.projectId, projectId), eq(mediaAssets.kind, 'proxy')))
      .orderBy(desc(mediaAssets.createdAt)).limit(1);
    if (!asset?.durationMs) throw new BadRequestException('Video processing is not complete yet.');

    const [transcript] = await this.database.db.select().from(transcripts)
      .where(and(eq(transcripts.projectId, projectId), eq(transcripts.status, 'completed')))
      .orderBy(desc(transcripts.updatedAt)).limit(1);
    if (!transcript) throw new BadRequestException('Transcription is not complete yet.');
    const segments = await this.database.db.select().from(transcriptSegments)
      .where(eq(transcriptSegments.transcriptId, transcript.id)).orderBy(asc(transcriptSegments.position));
    const editableSegments = segments.length > 0 ? segments : [{
      startMs: 0,
      endMs: asset.durationMs,
      text: '[Silent video: no spoken audio was detected. Keep the useful visual content.]',
    }];

    const decision = await this.askOllama(input.prompt, input.style, editableSegments.map((segment, index) => (
      `${index}|${segment.startMs}|${segment.endMs}|${segment.text.replaceAll(/\s+/g, ' ').slice(0, 300)}`
    )).join('\n'));
    const clips = decision.selections.map(({ startIndex, endIndex }) => {
      const start = editableSegments[Math.min(startIndex, editableSegments.length - 1)];
      const end = editableSegments[Math.min(Math.max(startIndex, endIndex), editableSegments.length - 1)];
      return { id: randomUUID(), assetId: asset.id, inMs: start.startMs, outMs: Math.min(asset.durationMs!, end.endMs) };
    }).filter((clip) => clip.outMs > clip.inMs);
    if (!clips.length) throw new BadGatewayException('Ollama did not return any valid edit selections.');

    const [track] = await this.database.db.select().from(captionTracks)
      .where(eq(captionTracks.projectId, projectId)).orderBy(desc(captionTracks.updatedAt)).limit(1);
    const captions = track ? await this.database.db.select().from(captionSegments)
      .where(eq(captionSegments.trackId, track.id)).orderBy(asc(captionSegments.position)) : [];
    const saved = await this.editorService.save(ownerId, projectId, {
      expectedVersion: input.expectedVersion,
      timeline: {
        schemaVersion: 1,
        aspectRatio: decision.aspectRatio,
        videoTrack: { clips },
        captionTrack: {
          enabled: decision.captionEnabled,
          items: captions.map(({ id, startMs, endMs, text }) => ({ id, startMs, endMs, text })),
        },
      },
    });
    return { timeline: saved, explanation: decision.explanation, model: this.model };
  }

  private async askOllama(prompt: string, style: AiEditRequest['style'], transcript: string) {
    let response: Response;
    try {
      response = await fetch(`${this.ollamaUrl}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: AbortSignal.timeout(120_000),
        body: JSON.stringify({
          model: this.model,
          stream: false,
          format: 'json',
          options: { temperature: 0.15 },
          messages: [
            { role: 'system', content: 'You are a professional video editor. Return JSON only with aspectRatio (16:9, 9:16, 1:1, or 4:5), captionEnabled, selections (startIndex/endIndex inclusive), and explanation. Select coherent transcript ranges, remove filler, never invent indexes, and keep selections chronological unless the user asks otherwise.' },
            { role: 'user', content: `Editing style: ${style}\nUser command: ${prompt}\nTranscript rows are index|start_ms|end_ms|text:\n${transcript.slice(0, 45_000)}` },
          ],
        }),
      });
    } catch {
      throw new BadGatewayException('Ollama is not running. Start it with: ollama serve');
    }
    if (!response.ok) throw new BadGatewayException(`Ollama returned HTTP ${response.status}.`);
    const result = await response.json() as OllamaResponse;
    let content: unknown;
    try { content = JSON.parse(result.message?.content ?? ''); }
    catch { throw new BadGatewayException('Ollama returned invalid edit instructions.'); }
    const parsed = ollamaEditSchema.safeParse(content);
    if (!parsed.success) throw new BadGatewayException('Ollama returned an invalid edit plan.');
    return parsed.data;
  }
}
