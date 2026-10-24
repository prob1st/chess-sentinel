# Contributing to Chess Sentinel

Contributions, empirical threshold refinements, and Chess.com DOM selector updates are warmly welcome!

## Quick Development Setup

```bash
git clone https://github.com/fatihmehmettezcan5-ops/chess-sentinel.git
cd chess-sentinel
npm install

# Run TypeScript checks & Vitest forensic suite
npm run typecheck
npm test

# Build unpacked extension into ./extension and start interactive preview server
npm run build
npm run demo
```

## Calibration Principles

1. **Minimize False Positives on Legitimate Outliers:** Always test scoring changes against:
   - Established honest players across Bullet, Blitz, and Rapid (`< 20%` risk)
   - Verified FIDE titled players (`GM`, `IM`, `FM`)
   - Players with zero Game-Reviewed games (`accuracies === undefined`)
2. **Strict Chess.com Policy Compliance:** Never introduce features that evaluate active board positions or suggest moves. Only public historical profile & archive data from `api.chess.com/pub` may be used.
