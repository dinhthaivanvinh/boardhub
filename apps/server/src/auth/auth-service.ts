import { randomUUID } from 'node:crypto';
import type { AuthResponse, PublicUser } from '@bg/protocol';
import { HubError } from '../errors';
import type { UserRecord, UserRepo } from '../store/repos';
import { hashPassword, verifyPassword } from './passwords';
import type { TokenService } from './tokens';

// 16 × 16 × 9000 ≈ 2.3 million names. Names are only labels (ids identify people); the room UI
// disambiguates the rare case of two people with the same name.
const GUEST_ADJECTIVES = [
  'Nhanh',
  'Khéo',
  'Lặng',
  'Vui',
  'Tinh',
  'Gan',
  'Bền',
  'Sáng',
  'Hiền',
  'Dũng',
  'Khôn',
  'Lanh',
  'Mạnh',
  'Nhẹ',
  'Tươi',
  'Xinh',
];
const GUEST_NOUNS = [
  'Hổ',
  'Cáo',
  'Ưng',
  'Rồng',
  'Sói',
  'Hạc',
  'Cá',
  'Gấu',
  'Mèo',
  'Ngựa',
  'Voi',
  'Công',
  'Sẻ',
  'Thỏ',
  'Rùa',
  'Cú',
];

export function randomGuestName(rand: () => number = Math.random): string {
  const pick = <T>(arr: T[]) => arr[Math.floor(rand() * arr.length)] as T;
  return `${pick(GUEST_NOUNS)} ${pick(GUEST_ADJECTIVES)} ${Math.floor(rand() * 9000 + 1000)}`;
}

export function toPublicUser(u: UserRecord, admin = false): PublicUser {
  return { id: u.id, kind: u.kind, displayName: u.displayName, email: u.email, admin };
}

/** Moderation hooks (M4b): banned users cannot sign in; admins are flagged for the web. */
export interface AuthPolicy {
  isBanned(userId: string): Promise<boolean>;
  isAdmin(user: UserRecord): Promise<boolean>;
  /** False for an address nobody may sign up with (a listed admin address). */
  mayRegister(email: string): boolean;
  onRegistered(user: UserRecord): Promise<void>;
}

/** "Last active" is written at most this often per account. */
const SEEN_EVERY_MS = 5 * 60_000;

export class AuthService {
  private readonly seen = new Map<string, number>();

  constructor(
    private readonly users: UserRepo,
    private readonly tokens: TokenService,
    private readonly policy?: AuthPolicy,
    private readonly now: () => number = Date.now,
  ) {}

  async publicUser(u: UserRecord): Promise<PublicUser> {
    return toPublicUser(u, (await this.policy?.isAdmin(u)) ?? false);
  }

  /** Remembers when the account was last used. A failure never fails the request. */
  private async markSeen(userId: string): Promise<void> {
    const at = this.now();
    const last = this.seen.get(userId);
    if (last !== undefined && at - last < SEEN_EVERY_MS) return;
    this.seen.set(userId, at);
    await this.users.touch(userId, at).catch(() => this.seen.delete(userId));
  }

  async guest(displayName?: string): Promise<AuthResponse> {
    const user = await this.users.create({
      id: randomUUID(),
      kind: 'guest',
      displayName: displayName ?? randomGuestName(),
      email: null,
      passwordHash: null,
    });
    return this.respond(user);
  }

  /** If `currentUserId` is a guest, the guest account is upgraded so its history is kept (FR-AUTH-03). */
  async register(
    input: { email: string; password: string; displayName: string },
    currentUserId: string | null,
  ): Promise<AuthResponse> {
    // A reserved address answers like a taken one, so the admin list cannot be probed.
    if (this.policy && !this.policy.mayRegister(input.email)) throw new HubError('auth.email_taken');
    if (await this.users.findByEmail(input.email)) throw new HubError('auth.email_taken');
    const passwordHash = await hashPassword(input.password);
    const current = currentUserId ? await this.users.findById(currentUserId) : null;
    const patch = {
      kind: 'registered' as const,
      email: input.email,
      passwordHash,
      displayName: input.displayName,
    };
    const user =
      current?.kind === 'guest'
        ? await this.users.update(current.id, patch)
        : await this.users.create({ id: randomUUID(), ...patch });
    if (!user) throw new HubError('internal');
    await this.policy?.onRegistered(user);
    return this.respond(user);
  }

  async login(input: { email: string; password: string }): Promise<AuthResponse> {
    const user = await this.users.findByEmail(input.email);
    const ok = user?.passwordHash ? await verifyPassword(input.password, user.passwordHash) : false;
    if (!user || !ok) throw new HubError('auth.invalid_credentials');
    if (await this.policy?.isBanned(user.id)) throw new HubError('auth.banned');
    return this.respond(user);
  }

  async me(userId: string): Promise<PublicUser> {
    const user = await this.users.findById(userId);
    if (!user) throw new HubError('auth.required');
    return this.publicUser(user);
  }

  async rename(userId: string, displayName: string): Promise<PublicUser> {
    const user = await this.users.update(userId, { displayName });
    if (!user) throw new HubError('auth.required');
    return this.publicUser(user);
  }

  /** Resolves a bearer token to a user, or null. Throws auth.banned for a banned account. */
  async authenticate(token: string | undefined): Promise<UserRecord | null> {
    if (!token) return null;
    const claims = await this.tokens.verify(token);
    const user = claims ? await this.users.findById(claims.userId) : null;
    if (user && (await this.policy?.isBanned(user.id))) throw new HubError('auth.banned');
    if (user) await this.markSeen(user.id);
    return user;
  }

  private async respond(user: UserRecord): Promise<AuthResponse> {
    await this.markSeen(user.id);
    return { token: await this.tokens.sign({ userId: user.id }), user: await this.publicUser(user) };
  }
}
