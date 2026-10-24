import { DEFAULT_SETTINGS } from '../core/calibration';
import { getSettings, getWatchlist, updateSettings } from '../storage/store';
import {
  CheatAnalysisResult,
  ExtensionMessage,
  SentinelSettings,
  TimeClass,
} from '../types';
import { ChessComOpponentDetector, DetectedMatchContext } from './detector';
import { SentinelHudOverlay } from './hud-overlay';
import { removeInlineUsernameBadges, renderInlineUsernameBadge } from './inline-badge';

class SentinelContentController {
  private settings: SentinelSettings = { ...DEFAULT_SETTINGS };
  private hud: SentinelHudOverlay | null = null;
  private detector: ChessComOpponentDetector | null = null;
  private lastCtx: DetectedMatchContext | null = null;
  private targetSide: 'top' | 'bottom' = 'top';
  private activeUsername: string | null = null;
  private latestResult: CheatAnalysisResult | null = null;

  async init(): Promise<void> {
    this.settings = await getSettings();

    this.hud = new SentinelHudOverlay(this.settings, {
      onSwapTarget: () => this.swapTargetSide(),
      onRefresh: () => {
        if (this.activeUsername) {
          void this.analyzeTarget(this.activeUsername, this.lastCtx?.detectedFormat, true);
        } else {
          this.detector?.forceRecheck();
        }
      },
      onToggleLanguage: (nextLang) => {
        void this.persistSettings({ language: nextLang });
      },
      onToggleWatchlist: (result) => {
        void this.handleWatchlistToggle(result);
      },
      onSavePosition: (pos) => {
        void this.persistSettings({ hudPosition: pos });
      },
    });

    this.detector = new ChessComOpponentDetector(
      (ctx) => this.handleMatchContext(ctx),
      () => this.handleMatchLeft()
    );
    this.detector.start();

    this.setupKeyboardShortcut();
    this.setupStorageSync();
    this.setupRuntimeMessages();
  }

  private async persistSettings(patch: Partial<SentinelSettings>): Promise<void> {
    this.settings = await updateSettings(patch);
    this.hud?.updateSettings(this.settings);
    if (this.latestResult && this.settings.showInlineBadge) {
      renderInlineUsernameBadge(
        this.latestResult,
        this.targetSide,
        this.settings.language,
        () => this.hud?.expandFromBadge()
      );
    }
  }

  private swapTargetSide(): void {
    if (!this.lastCtx) return;
    const nextSide: 'top' | 'bottom' = this.targetSide === 'top' ? 'bottom' : 'top';
    const candidate = nextSide === 'top' ? this.lastCtx.topPlayer : this.lastCtx.bottomPlayer;
    if (!candidate) return;
    this.targetSide = nextSide;
    void this.analyzeTarget(candidate, this.lastCtx.detectedFormat, false);
  }

  private handleMatchContext(ctx: DetectedMatchContext): void {
    const prevOpponent = this.lastCtx?.opponent?.toLowerCase();
    this.lastCtx = ctx;

    // Reset target side to detected opponent side whenever a new opponent appears
    if (ctx.opponent.toLowerCase() !== prevOpponent) {
      this.targetSide = ctx.opponentSide;
    }

    const target =
      this.targetSide === 'bottom'
        ? ctx.bottomPlayer || ctx.opponent
        : ctx.topPlayer || ctx.opponent;

    this.hud?.setAbortWindow(ctx.isAbortWindowOpen);

    if (target.toLowerCase() !== this.activeUsername?.toLowerCase()) {
      void this.analyzeTarget(target, ctx.detectedFormat, false);
    }
  }

  private handleMatchLeft(): void {
    this.activeUsername = null;
    this.latestResult = null;
    this.lastCtx = null;
    removeInlineUsernameBadges();
    this.hud?.hide();
  }

  private async analyzeTarget(
    username: string,
    preferredFormat: TimeClass | undefined,
    forceRefresh: boolean
  ): Promise<void> {
    this.activeUsername = username;

    if (this.settings.autoShowHud || forceRefresh) {
      this.hud?.showLoading(username);
    }

    try {
      const msg: ExtensionMessage = {
        type: 'ANALYZE_PLAYER',
        username,
        preferredFormat,
        forceRefresh,
      };
      const response = (await chrome.runtime.sendMessage(msg)) as {
        ok: boolean;
        result?: CheatAnalysisResult;
        error?: string;
      };

      // Guard against race if opponent changed while request was in flight
      if (this.activeUsername?.toLowerCase() !== username.toLowerCase()) return;

      if (!response || !response.ok || !response.result) {
        this.hud?.showError(username, response?.error || 'Could not retrieve Chess.com telemetry');
        return;
      }

      const result = response.result;
      this.latestResult = result;

      const watchlist = await getWatchlist();
      const isWatched = watchlist.some(
        (w) => w.username.toLowerCase() === result.username.toLowerCase()
      );

      if (this.settings.autoShowHud || forceRefresh) {
        this.hud?.showResult(result, isWatched, this.lastCtx?.isAbortWindowOpen ?? false);
      }

      if (this.settings.showInlineBadge) {
        renderInlineUsernameBadge(result, this.targetSide, this.settings.language, () => {
          this.hud?.showResult(result, isWatched, this.lastCtx?.isAbortWindowOpen ?? false);
          this.hud?.expandFromBadge();
        });
      } else {
        removeInlineUsernameBadges();
      }
    } catch {
      // Service worker asleep or extension reloaded
    }
  }

  private async handleWatchlistToggle(result: CheatAnalysisResult): Promise<void> {
    try {
      const pf = result.formats[result.primaryFormat];
      const msg: ExtensionMessage = {
        type: 'TOGGLE_WATCHLIST',
        entry: {
          username: result.username,
          initialProbability: result.probability,
          ratingAtSave: pf.currentRating,
          format: result.primaryFormat,
          avatarUrl: result.avatarUrl,
          isBannedFairPlay: result.isBannedFairPlay,
          accountStatus: result.accountStatus,
        },
      };
      const resp = (await chrome.runtime.sendMessage(msg)) as { ok: boolean; added?: boolean };
      if (resp && resp.ok) {
        this.hud?.setWatchedState(Boolean(resp.added));
      }
    } catch {
      // Ignore
    }
  }

  private setupKeyboardShortcut(): void {
    window.addEventListener('keydown', (e: KeyboardEvent) => {
      if (e.altKey && (e.key === 's' || e.key === 'S')) {
        e.preventDefault();
        if (!this.latestResult && this.lastCtx?.opponent) {
          void this.analyzeTarget(this.lastCtx.opponent, this.lastCtx.detectedFormat, true);
        } else {
          this.hud?.toggleVisibility();
        }
      }
    });
  }

  private setupStorageSync(): void {
    if (typeof chrome === 'undefined' || !chrome.storage?.onChanged) return;
    chrome.storage.onChanged.addListener(() => {
      void (async () => {
        this.settings = await getSettings();
        this.hud?.updateSettings(this.settings);
        if (!this.settings.showInlineBadge) {
          removeInlineUsernameBadges();
        } else if (this.latestResult) {
          renderInlineUsernameBadge(
            this.latestResult,
            this.targetSide,
            this.settings.language,
            () => this.hud?.expandFromBadge()
          );
        }
      })();
    });
  }

  private setupRuntimeMessages(): void {
    if (typeof chrome === 'undefined' || !chrome.runtime?.onMessage) return;
    chrome.runtime.onMessage.addListener((msg: ExtensionMessage, _sender, sendResponse) => {
      if (msg.type === 'TOGGLE_HUD_FROM_POPUP') {
        if (!this.latestResult && this.lastCtx?.opponent) {
          void this.analyzeTarget(this.lastCtx.opponent, this.lastCtx.detectedFormat, true);
        } else {
          this.hud?.toggleVisibility();
        }
        sendResponse({ ok: true });
      }
      return false;
    });
  }
}

const controller = new SentinelContentController();
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => void controller.init());
} else {
  void controller.init();
}
