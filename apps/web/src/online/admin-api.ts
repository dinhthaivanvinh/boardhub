'use client';

import type {
  AdminGameSetting,
  AdminReport,
  GamesStatus,
  ReportCreatePayload,
  ReportResolvePayload,
  SanctionedUser,
  UserSanctions,
} from '@bg/protocol';
import { apiRequest } from './api';
import { ensureToken, useSession } from './session';

const token = () => useSession.getState().token;

export const gamesStatus = () => apiRequest<GamesStatus>('GET', '/api/games/status');

export async function sendReport(payload: ReportCreatePayload) {
  return apiRequest<{ id: string }>('POST', '/api/reports', payload, await ensureToken());
}

export const adminGames = () =>
  apiRequest<{ games: AdminGameSetting[] }>('GET', '/api/admin/games', undefined, token());

export const setGameEnabled = (gameId: string, enabled: boolean) =>
  apiRequest<AdminGameSetting>('PUT', `/api/admin/games/${encodeURIComponent(gameId)}`, { enabled }, token());

export const adminReports = (status: 'open' | 'resolved') =>
  apiRequest<{ reports: AdminReport[] }>('GET', `/api/admin/reports?status=${status}`, undefined, token());

export const resolveReport = (id: string, payload: ReportResolvePayload) =>
  apiRequest<{ report: AdminReport }>('POST', `/api/admin/reports/${id}/resolve`, payload, token());

export const adminSanctioned = () =>
  apiRequest<{ users: SanctionedUser[] }>('GET', '/api/admin/sanctions', undefined, token());

export const setSanctions = (userId: string, patch: Partial<UserSanctions>) =>
  apiRequest<{ sanctions: UserSanctions }>('PUT', `/api/admin/users/${userId}/sanctions`, patch, token());
