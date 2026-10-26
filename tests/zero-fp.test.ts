import { describe, expect, it } from 'vitest';
import { getAccuracyBand } from '../src/core/calibration';
import { analyzePlayerBundle } from '../src/core/engine';
import { ChessComGame, PlayerRawBundle, TimeClass } from '../src/types';

// Deterministic Mulberry32 PRNG for reproducible Monte Carlo testing
function createPrng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function buildOrganicHumanPgn(rng: () => number, baseSec: number, moveCount = 26): string {
  let wc = baseSec;
  let bc = baseSec;
  const moves: string[] = [];
  for (let i = 0; i < moveCount; i++) {
    // Realistic log-normal / heavy-tailed human move durations (instant recaptures + deep thinks)
    const u = rng();
    const dt =
      u < 0.24
        ? 0.4 + rng() * 1.3
        : u < 0.72
          ? 2.0 + rng() * 6.5
          : 9.0 + rng() * 24.0;
    if (i > 0) {
      wc = Math.max(25, wc - dt);
      bc = Math.max(25, bc - (1.0 + rng() * 7.0));
    }
    const fmt = (sec: number) =>
      `0:${String(Math.floor(sec / 60)).padStart(2, '0')}:${(sec % 60).toFixed(1).padStart(4, '0')}`;
    moves.push(`${i + 1}. e4 {[%clk ${fmt(wc)}]} ${i + 1}... e5 {[%clk ${fmt(bc)}]}`);
  }
  return `[TimeControl "${baseSec}"]\n\n${moves.join(' ')}`;
}

describe('Zero-False-Positive (α -> 0) Neyman-Pearson Guarantee Suite v3.1', () => {
  const nowSec = 1793000000;
  const nowMs = nowSec * 1000;

  it('produces 0 / 10,000 (0.000%) false positives across diverse Monte Carlo honest human & smurf edge cases', () => {
    const rng = createPrng(20261026);
    const formats: TimeClass[] = ['bullet', 'blitz', 'rapid'];
    let falsePositives = 0;
    let maxHonestProbability = 0;

    for (let p = 0; p < 10000; p++) {
      const fmt = formats[p % 3];
      const baseSec = fmt === 'bullet' ? 60 : fmt === 'blitz' ? 180 : 600;
      const archetype = p % 5;
      // Archetypes:
      // 0: Normal club player (800-2300 Elo)
      // 1: Brand-new returning OTB strong human smurf (2-day-old account, 90% win rate, human clock/CAPS2!)
      // 2: Free-tier user cherry-picking Game Review only on best wins + 15-move miniatures
      // 3: Calm positional thinker (slower average move times, occasional fast recaptures)
      // 4: Lucky weekend hot-streak player (12 consecutive wins at normal CAPS2)

      const rating = Math.round(850 + rng() * 1550);
      const band = getAccuracyBand(fmt, rating);
      const ageDays = archetype === 1 ? 2 + Math.floor(rng() * 6) : 30 + Math.floor(rng() * 1500);
      const gamesCount = 12 + Math.floor(rng() * 20);

      const recentGames: ChessComGame[] = [];
      let wins = 0;
      let losses = 0;

      for (let g = 0; g < gamesCount; g++) {
        const winProb =
          archetype === 1 ? 0.90 : archetype === 4 && g < 12 ? 0.95 : 0.48 + rng() * 0.1;
        const won = rng() < winProb;
        if (won) wins++;
        else losses++;

        const isShortTrap = archetype === 2 && won && g % 3 === 0;
        const moveCount = isShortTrap ? 14 : 24 + Math.floor(rng() * 12);
        const pgn = buildOrganicHumanPgn(rng, baseSec, moveCount);

        let accuracies: { white: number; black: number } | undefined = undefined;
        if (archetype === 2) {
          // Only review wins! Short traps get 97%, long wins get expected + up to +4.5%
          if (won && rng() < 0.45) {
            const acc = isShortTrap
              ? 96.5 + rng() * 2.5
              : Math.min(96, band.expected + 1.5 + (rng() - 0.3) * 6.0);
            accuracies = { white: Number(acc.toFixed(1)), black: 76.0 };
          }
        } else if (rng() < 0.65) {
          // Normal Gaussian-like human CAPS2 variance around band.expected
          const gauss = (rng() + rng() + rng() - 1.5) * 5.2;
          const acc = Math.max(55, Math.min(95.5, band.expected + gauss));
          accuracies = { white: Number(acc.toFixed(1)), black: 78.0 };
        }

        const oppRating = Math.max(400, Math.round(rating + (rng() - 0.5) * 140));
        recentGames.push({
          time_class: fmt,
          rated: true,
          end_time: nowSec - g * 2400,
          pgn,
          accuracies,
          white: {
            username: `HonestUser_${p}`,
            rating,
            result: won ? 'win' : 'resigned',
          },
          black: {
            username: `Peer_${g}`,
            rating: oppRating,
            result: won ? 'resigned' : 'win',
          },
        });
      }

      const lifetimeMult = archetype === 1 ? 1 : 4 + Math.floor(rng() * 20);
      const bundle: PlayerRawBundle = {
        username: `honestuser_${p}`,
        fetchedAt: nowMs,
        profile: {
          username: `HonestUser_${p}`,
          joined: nowSec - ageDays * 86400,
          status: 'basic',
        },
        stats: {
          [`chess_${fmt}`]: {
            last: { rating, rd: archetype === 1 ? 95 : 42 },
            best: { rating: rating + 35 },
            record: {
              win: wins * lifetimeMult,
              loss: Math.max(1, losses * lifetimeMult),
              draw: Math.floor(gamesCount * 0.08),
            },
          },
          tactics: { highest: { rating: 400 }, lowest: { rating: 400 } },
        },
        recentGames,
      };

      const res = analyzePlayerBundle(bundle, {
        preferredFormat: fmt,
        sensitivity: 'balanced',
        nowMs,
      });

      if (res.probability > maxHonestProbability) {
        maxHonestProbability = res.probability;
      }
      // Any score >= 55% ('elevated' / 'high' / 'critical') on an unassisted human is a False Positive
      if (res.probability >= 55) {
        falsePositives++;
      }
    }

    expect(falsePositives).toBe(0);
    expect(maxHonestProbability).toBeLessThan(48);
  });
});
