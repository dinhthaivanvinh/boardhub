import { z } from 'zod';
import { AvatarSchema } from '@bg/avatars';
import type { OfficeDrawRecord } from '@bg/protocol';
import { apiRequest, type ApiResult } from '@/online/api';

const DrawRecordSchema = z.object({
  drawId: z.string(),
  round: z.number().int(),
  mode: z.string(),
  n: z.number().int(),
  candidates: z.array(z.object({ id: z.string(), name: z.string(), avatar: AvatarSchema })),
  commitment: z.string(),
  seed: z.string(),
  winners: z.array(z.string()),
  startsAt: z.number(),
  revealAt: z.number(),
  revealedAt: z.number(),
});

/** A revealed draw, with its seed, so anyone can check it (docs/office/06 §5). */
export async function fetchDraw(code: string, drawId: string): Promise<ApiResult<OfficeDrawRecord>> {
  const res = await apiRequest<unknown>(
    'GET',
    `/api/office/${encodeURIComponent(code)}/draws/${encodeURIComponent(drawId)}`,
  );
  if (!res.ok) return res;
  const parsed = DrawRecordSchema.safeParse(res.data);
  return parsed.success ? { ok: true, data: parsed.data } : { ok: false, code: 'protocol.bad_response' };
}
