import { AvatarSchema, type AvatarData } from '@bg/avatars';
import { apiRequest, type ApiResult } from '@/online/api';

/** The signed-in user's saved avatar, or null if they never made one. */
export async function fetchMyAvatar(token: string): Promise<ApiResult<AvatarData | null>> {
  const res = await apiRequest<{ avatar: unknown }>('GET', '/api/me/avatar', undefined, token);
  if (!res.ok) return res;
  const parsed = AvatarSchema.safeParse(res.data.avatar);
  return { ok: true, data: parsed.success ? parsed.data : null };
}

export async function saveMyAvatar(token: string, avatar: AvatarData): Promise<ApiResult<unknown>> {
  return apiRequest('PUT', '/api/me/avatar', { avatar }, token);
}
