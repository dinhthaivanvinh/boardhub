/** Game server URL. Defaults to port 4000 on the same host, so LAN play works without config. */
export function serverUrl(): string {
  const configured = process.env.NEXT_PUBLIC_GAME_SERVER_URL;
  if (configured) return configured;
  if (typeof window === 'undefined') return 'http://localhost:4000';
  return `${window.location.protocol}//${window.location.hostname}:4000`;
}

export type ApiResult<T> = { ok: true; data: T } | { ok: false; code: string };

export async function apiRequest<T>(
  method: 'GET' | 'POST' | 'PATCH',
  path: string,
  body?: unknown,
  token?: string | null,
): Promise<ApiResult<T>> {
  try {
    const res = await fetch(serverUrl() + path, {
      method,
      headers: {
        ...(body !== undefined && { 'content-type': 'application/json' }),
        ...(token && { authorization: `Bearer ${token}` }),
      },
      ...(body !== undefined && { body: JSON.stringify(body) }),
    });
    const data = (await res.json().catch(() => ({}))) as T & { code?: string };
    return res.ok ? { ok: true, data } : { ok: false, code: data.code ?? 'internal' };
  } catch {
    return { ok: false, code: 'network' };
  }
}
