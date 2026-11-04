import { z } from 'zod';

const DisplayName = z.string().trim().min(2).max(24);

export const GuestRequest = z.strictObject({ displayName: DisplayName.optional() });
export const RegisterRequest = z.strictObject({
  email: z.string().trim().toLowerCase().email().max(200),
  password: z.string().min(8).max(200),
  displayName: DisplayName,
});
export const LoginRequest = z.strictObject({
  email: z.string().trim().toLowerCase().email(),
  password: z.string().min(1).max(200),
});
export const RenameRequest = z.strictObject({ displayName: DisplayName });

export type UserKind = 'guest' | 'registered';

export interface PublicUser {
  id: string;
  kind: UserKind;
  displayName: string;
  email: string | null;
}

export interface AuthResponse {
  token: string;
  user: PublicUser;
}

export interface ApiError {
  code: string;
}
