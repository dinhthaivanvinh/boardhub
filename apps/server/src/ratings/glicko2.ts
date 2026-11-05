/**
 * Glicko-2 rating system (Mark Glickman, "Example of the Glicko-2 system", 2013).
 * Ratings are on the familiar 1500 scale; internally converted to the Glicko-2 scale (÷ 173.7178).
 * Each finished ranked game is treated as its own rating period, as most online game sites do.
 */

export interface Glicko {
  rating: number;
  /** Rating deviation: uncertainty. 350 for a new player, shrinks as they play. */
  rd: number;
  /** Volatility: how erratic the player's results are. */
  volatility: number;
}

export interface GameOutcome {
  opponent: Glicko;
  /** 1 = win, 0.5 = draw, 0 = loss. */
  score: number;
}

export const DEFAULT_RATING: Glicko = { rating: 1500, rd: 350, volatility: 0.06 };

/** System constant: how much volatility may change. 0.3–1.2; smaller is more stable. */
const TAU = 0.5;
const SCALE = 173.7178;
const EPSILON = 0.000001;
/** RD never drops below this, so ratings can still move for very active players. */
const MIN_RD = 30;

const g = (phi: number) => 1 / Math.sqrt(1 + (3 * phi * phi) / (Math.PI * Math.PI));
const expected = (mu: number, muJ: number, phiJ: number) => 1 / (1 + Math.exp(-g(phiJ) * (mu - muJ)));

/** New rating after a rating period with these outcomes (an empty list only increases RD). */
export function updateRating(player: Glicko, outcomes: readonly GameOutcome[]): Glicko {
  const mu = (player.rating - 1500) / SCALE;
  const phi = player.rd / SCALE;
  const sigma = player.volatility;

  if (outcomes.length === 0) {
    const phiStar = Math.sqrt(phi * phi + sigma * sigma);
    return { rating: player.rating, rd: Math.min(350, phiStar * SCALE), volatility: sigma };
  }

  const opp = outcomes.map((o) => ({
    mu: (o.opponent.rating - 1500) / SCALE,
    phi: o.opponent.rd / SCALE,
    score: o.score,
  }));

  // Step 3: estimated variance of the rating from the game outcomes.
  let vInv = 0;
  for (const o of opp) {
    const e = expected(mu, o.mu, o.phi);
    vInv += g(o.phi) ** 2 * e * (1 - e);
  }
  const v = 1 / vInv;

  // Step 4: estimated improvement.
  let sum = 0;
  for (const o of opp) sum += g(o.phi) * (o.score - expected(mu, o.mu, o.phi));
  const delta = v * sum;

  // Step 5: new volatility (Illinois algorithm).
  const a = Math.log(sigma * sigma);
  const f = (x: number) => {
    const ex = Math.exp(x);
    return (
      (ex * (delta * delta - phi * phi - v - ex)) / (2 * (phi * phi + v + ex) ** 2) - (x - a) / (TAU * TAU)
    );
  };
  let A = a;
  let B: number;
  if (delta * delta > phi * phi + v) {
    B = Math.log(delta * delta - phi * phi - v);
  } else {
    let k = 1;
    while (f(a - k * TAU) < 0) k++;
    B = a - k * TAU;
  }
  let fA = f(A);
  let fB = f(B);
  while (Math.abs(B - A) > EPSILON) {
    const C = A + ((A - B) * fA) / (fB - fA);
    const fC = f(C);
    if (fC * fB <= 0) {
      A = B;
      fA = fB;
    } else {
      fA /= 2;
    }
    B = C;
    fB = fC;
  }
  const newSigma = Math.exp(A / 2);

  // Steps 6–8: new deviation and rating.
  const phiStar = Math.sqrt(phi * phi + newSigma * newSigma);
  const newPhi = 1 / Math.sqrt(1 / (phiStar * phiStar) + 1 / v);
  const newMu = mu + newPhi * newPhi * sum;

  return {
    rating: newMu * SCALE + 1500,
    rd: Math.max(MIN_RD, Math.min(350, newPhi * SCALE)),
    volatility: newSigma,
  };
}

/** Both players' new ratings after one game between them. */
export function rateGame(a: Glicko, b: Glicko, scoreA: number): [Glicko, Glicko] {
  return [
    updateRating(a, [{ opponent: b, score: scoreA }]),
    updateRating(b, [{ opponent: a, score: 1 - scoreA }]),
  ];
}

/** A rating is provisional until its deviation is small enough to trust (shown with a "?"). */
export const isProvisional = (r: Pick<Glicko, 'rd'>) => r.rd > 110;
