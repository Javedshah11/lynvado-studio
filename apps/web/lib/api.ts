const API_URL =
  process.env.NEXT_PUBLIC_API_URL ??
  'http://localhost:4000/api';

export interface LynvadoUser {
  id: string;
  email: string;
  displayName: string;
  createdAt: string;
}

export interface AuthResponse {
  user: LynvadoUser;
  accessToken: string;
}

export type ProjectStatus =
  | 'draft'
  | 'processing'
  | 'ready'
  | 'failed'
  | 'archived';

export interface LynvadoProject {
  id: string;
  ownerId: string;
  name: string;
  status: ProjectStatus;
  createdAt: string;
  updatedAt: string;
}

export type TimelineAspectRatio = '16:9' | '9:16' | '1:1' | '4:5';

export interface TimelineClip {
  id: string;
  assetId: string;
  inMs: number;
  outMs: number;
}

export interface TimelineCaption {
  id: string;
  startMs: number;
  endMs: number;
  text: string;
}

export interface TimelineDocument {
  schemaVersion: 1;
  aspectRatio: TimelineAspectRatio;
  videoTrack: { clips: TimelineClip[] };
  captionTrack: { enabled: boolean; items: TimelineCaption[] };
}

export interface SavedTimeline {
  id: string;
  projectId: string;
  version: number;
  timeline: TimelineDocument;
  createdAt: string;
  updatedAt: string;
}

export interface MediaAsset {
  id: string;
  projectId: string;
  kind: 'original' | 'proxy' | 'thumbnail' | 'audio' | 'export';
  originalFileName: string | null;
  mimeType: string;
  sizeBytes: number;
  durationMs: number | null;
  width: number | null;
  height: number | null;
  createdAt: string;
  downloadUrl: string | null;
}

export interface CaptionTrack {
  segments: Array<{
    id: string;
    startMs: number;
    endMs: number;
    text: string;
  }>;
}

export interface Transcript {
  id: string;
  status: 'processing' | 'completed' | 'failed';
  language: string | null;
  segments: Array<{
    id: string;
    startMs: number;
    endMs: number;
    text: string;
    speaker: string | null;
    confidence: number | null;
  }>;
}

export interface ClipSuggestion {
  id: string;
  startMs: number;
  endMs: number;
  title: string;
  score: number;
  reason: string;
  status: 'suggested' | 'accepted' | 'rejected';
}

export interface ProcessingJob {
  id: string;
  mediaAssetId: string | null;
  type: 'ingestion' | 'transcription' | 'clip_generation' | 'export';
  status: 'queued' | 'processing' | 'completed' | 'failed';
  progress: number;
  error: string | null;
  createdAt: string;
  startedAt: string | null;
  completedAt: string | null;
  updatedAt: string;
}

export interface ExportJob {
  id: string;
  status: 'queued' | 'processing' | 'completed' | 'failed';
  progress: number;
  error: string | null;
  createdAt: string;
  completedAt: string | null;
  downloadable: boolean;
}

interface ApiErrorBody {
  message?: string | string[];
}

let accessToken: string | null = null;

let refreshPromise:
  | Promise<AuthResponse | null>
  | null = null;

export function saveAccessToken(
  token: string,
): void {
  accessToken = token;
}

export function getAccessToken():
  | string
  | null {
  return accessToken;
}

export function clearAccessToken(): void {
  accessToken = null;
}

async function parseError(
  response: Response,
): Promise<Error> {
  let body:
    | ApiErrorBody
    | undefined;

  try {
    body =
      (await response.json()) as
        ApiErrorBody;
  } catch {
    body = undefined;
  }

  const message =
    Array.isArray(body?.message)
      ? body.message.join(', ')
      : body?.message ??
        `Request failed with status ${response.status}.`;

  return new Error(message);
}

export async function refreshSession():
  Promise<AuthResponse | null> {
  if (refreshPromise) {
    return refreshPromise;
  }

  refreshPromise =
    (async () => {
      try {
        const response =
          await fetch(
            `${API_URL}/auth/refresh`,
            {
              method: 'POST',

              credentials:
                'include',

              headers: {
                'Content-Type':
                  'application/json',
              },
            },
          );

        if (!response.ok) {
          clearAccessToken();
          return null;
        }

        const result =
          (await response.json()) as
            AuthResponse;

        saveAccessToken(
          result.accessToken,
        );

        return result;
      } catch {
        clearAccessToken();
        return null;
      } finally {
        refreshPromise = null;
      }
    })();

  return refreshPromise;
}

function canAttemptRefresh(
  path: string,
): boolean {
  return ![
    '/auth/login',
    '/auth/register',
    '/auth/refresh',
    '/auth/logout',
  ].includes(path);
}

export async function apiRequest<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const headers =
    new Headers(
      options.headers,
    );

  if (
    options.body &&
    !headers.has(
      'Content-Type',
    )
  ) {
    headers.set(
      'Content-Type',
      'application/json',
    );
  }

  const token =
    getAccessToken();

  if (
    token &&
    !headers.has(
      'Authorization',
    )
  ) {
    headers.set(
      'Authorization',
      `Bearer ${token}`,
    );
  }

  let response =
    await fetch(
      `${API_URL}${path}`,
      {
        ...options,

        headers,

        credentials:
          'include',
      },
    );

  if (
    response.status === 401 &&
    canAttemptRefresh(path)
  ) {
    const refreshed =
      await refreshSession();

    if (refreshed) {
      headers.set(
        'Authorization',
        `Bearer ${refreshed.accessToken}`,
      );

      response =
        await fetch(
          `${API_URL}${path}`,
          {
            ...options,

            headers,

            credentials:
              'include',
          },
        );
    }
  }

  if (!response.ok) {
    throw await parseError(
      response,
    );
  }

  if (
    response.status === 204
  ) {
    return undefined as T;
  }

  return response.json() as Promise<T>;
}

export async function restoreSession():
  Promise<LynvadoUser | null> {
  const result =
    await refreshSession();

  return result?.user ?? null;
}

export async function logoutSession():
  Promise<void> {
  try {
    await fetch(
      `${API_URL}/auth/logout`,
      {
        method: 'POST',

        credentials:
          'include',

        headers: {
          'Content-Type':
            'application/json',
        },
      },
    );
  } finally {
    clearAccessToken();
  }
}
