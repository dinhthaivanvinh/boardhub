import { jwtVerify, SignJWT } from 'jose';

const ISSUER = 'boardhub';
const TTL = '30d';

export interface TokenClaims {
  userId: string;
}

export class TokenService {
  private readonly key: Uint8Array;

  constructor(secret: string) {
    if (secret.length < 32) throw new Error('JWT secret must be at least 32 characters');
    this.key = new TextEncoder().encode(secret);
  }

  sign(claims: TokenClaims): Promise<string> {
    return new SignJWT({})
      .setProtectedHeader({ alg: 'HS256' })
      .setSubject(claims.userId)
      .setIssuer(ISSUER)
      .setIssuedAt()
      .setExpirationTime(TTL)
      .sign(this.key);
  }

  /** Returns null for any invalid, expired or tampered token. */
  async verify(token: string): Promise<TokenClaims | null> {
    try {
      const { payload } = await jwtVerify(token, this.key, { issuer: ISSUER, algorithms: ['HS256'] });
      return payload.sub ? { userId: payload.sub } : null;
    } catch {
      return null;
    }
  }
}
