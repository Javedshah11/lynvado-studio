const API_URL =
  process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/api';

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

interface ApiErrorBody {
  message?: string | string[];
}

export async function apiRequest<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const response = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });

  if (!response.ok) {
    let body: ApiErrorBody | undefined;

    try {
      body = (await response.json()) as ApiErrorBody;
    } catch {
      body = undefined;
    }

    const message = Array.isArray(body?.message)
      ? body.message.join(', ')
      : (body?.message ?? 'Something went wrong.');

    throw new Error(message);
  }

  return response.json() as Promise<T>;
}

export function saveAccessToken(token: string): void {
  sessionStorage.setItem('lynvado_access_token', token);
}

export function getAccessToken(): string | null {
  return sessionStorage.getItem('lynvado_access_token');
}

export function clearAccessToken(): void {
  sessionStorage.removeItem('lynvado_access_token');
}
