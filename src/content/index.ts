import { DEFAULT_SETTINGS } from '../core/calibration';
import { getSettings, getWatchlist, updateSettings } from '../storage/store';
import {
  CheatAnalysisResult,
  ExtensionMessage,
  GameCallbackHydration,
  LiveMatchClockTelemetry,
  SentinelSettings,
  TimeClass,
} from '../types';
import { playRiskAlertChime } from '../utils/safe-dom';
import { ChessComOpponentDetector, DetectedMatchContext } from './detector';
import { SentinelHudOverlay } from './hud-overlay';
import { removeInlineUsernameBadges, renderInlineUsernameBadge } from './inline-badge';
import { LiveMatchClockMonitor } from './live-clock-monitor';

class SentinelContentController {
  private settings: SentinelSettings = { ...DEFAULT_SETTINGS };
  private hud: SentinelHudOverlay | null = null;
  private detector: ChessComOpponentDetector | null = null;
  private clockMonitor: LiveMatchClockMonitor | null = null;
  private lastCtx: DetectedMatchContext | null = null;
  private cachedCallback: GameCallbackHydration | null = null;
  private targetSide: 'top' | 'bottom' = 'top';
  private activeUsername: string | null = null;
  private latestResult: CheatAnalysisResult | null = null;
  private alertedUsernames = new Set<string>();
  private liveAlertedUsernames = new Set<string>();

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
      onToggleSound: (enabled) => {
        void this.persistSettings({ soundAlerts: enabled });
      },
      onToggleWatchlist: (result) => {
        void this.handleWatchlistToggle(result);
      },
      onSavePosition: (pos) => {
        void this.persistSettings({ hudPosition: pos });
      },
    });

    this.clockMonitor = new LiveMatchClockMonitor((telemetry) => {
      this.handleLiveClockUpdate(telemetry);
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

  private handleLiveClockUpdate(telemetry: LiveMatchClockTelemetry): void {
    this.hud?.updateLiveClock(telemetry);

    if (this.latestResult && this.settings.showInlineBadge) {
      renderInlineUsernameBadge(
        this.latestResult,
        this.targetSide,
        this.settings.language,
        () => this.hud?.expandFromBadge(),
        {
          liveClock: telemetry,
          surface: this.lastCtx?.surface ?? 'live',
        }
      );
    }

    const userKey = telemetry.opponent.toLowerCase();
    if (
      telemetry.isLiveSuspectPacing &&
      !telemetry.isFinishedGame &&
      this.settings.soundAlerts &&
      !this.liveAlertedUsernames.has(userKey)
    ) {
      this.liveAlertedUsernames.add(userKey);
      playRiskAlertChime(true);
    }
  }

  private async persistSettings(patch: Partial<SentinelSettings>): Promise<void> {
    this.settings = await updateSettings(patch);
    this.hud?.updateSettings(this.settings);
    if (this.latestResult && this.settings.showInlineBadge) {
      renderInlineUsernameBadge(
        this.latestResult,
        this.targetSide,
        this.settings.language,
        () => this.hud?.expandFromBadge(),
        {
          liveClock: this.clockMonitor?.getLatestTelemetry(),
          surface: this.lastCtx?.surface ?? 'live',
        }
      );
    }
  }

  private applyCallbackHydrationToSide(target: string, side: 'top' | 'bottom'): void {
    if (!this.cachedCallback || !this.clockMonitor) return;
    const cb = this.cachedCallback;
    const matchTop = cb.topPlayer?.toLowerCase() === target.toLowerCase();
    const matchBottom = cb.bottomPlayer?.toLowerCase() === target.toLowerCase();

    if (matchTop) {
      this.clockMonitor.hydrateServerMoves(
        target,
        cb.topTimesSec,
        cb.topMoveNumbers,
        cb.isFinished,
        cb.gameId
      );
    } else if (matchBottom) {
      this.clockMonitor.hydrateServerMoves(
        target,
        cb.bottomTimesSec,
        cb.bottomMoveNumbers,
        cb.isFinished,
        cb.gameId
      );
    } else if (side === 'top' && cb.topTimesSec.length > 0) {
      this.clockMonitor.hydrateServerMoves(
        target,
        cb.topTimesSec,
        cb.topMoveNumbers,
        cb.isFinished,
        cb.gameId
      );
    } else if (side === 'bottom' && cb.bottomTimesSec.length > 0) {
      this.clockMonitor.hydrateServerMoves(
        target,
        cb.bottomTimesSec,
        cb.bottomMoveNumbers,
        cb.isFinished,
        cb.gameId
      );
    }
  }

  private async fetchAndHydrateGameCallback(gameId: string, target: string): Promise<void> {
    if (this.cachedCallback?.gameId === gameId) {
      this.applyCallbackHydrationToSide(target, this.targetSide);
      return;
    }

    try {
      const resp = (await chrome.runtime.sendMessage({
        type: 'FETCH_GAME_CALLBACK',
        gameId,
      } satisfies ExtensionMessage)) as { ok: boolean; data?: GameCallbackHydration | null };

      if (!resp?.ok || !resp.data) return;
      this.cachedCallback = resp.data;

      if (this.lastCtx?.gameId === gameId) {
        this.hud?.setAbortWindow(resp.data.isAbortable);
        this.hud?.setSurface(resp.data.isFinished ? 'game' : 'live');
        if (this.activeUsername) {
          this.applyCallbackHydrationToSide(this.activeUsername, this.targetSide);
        }
      }
    } catch {
      // Ignore callback unavailable
    }
  }

  private swapTargetSide(): void {
    if (!this.lastCtx || this.lastCtx.surface === 'profile') return;
    const nextSide: 'top' | 'bottom' = this.targetSide === 'top' ? 'bottom' : 'top';
    const candidate =
      nextSide === 'top'
        ? this.lastCtx.topPlayer || this.cachedCallback?.topPlayer || null
        : this.lastCtx.bottomPlayer || this.cachedCallback?.bottomPlayer || null;
    if (!candidate) return;
    this.targetSide = nextSide;
    this.clockMonitor?.setTarget(candidate, nextSide, this.lastCtx.gameId);
    this.applyCallbackHydrationToSide(candidate, nextSide);
    void this.analyzeTarget(candidate, this.lastCtx.detectedFormat, false);
  }

  private handleMatchContext(ctx: DetectedMatchContext): void {
    const prevOpponent = this.lastCtx?.opponent?.toLowerCase();
    const prevGameId = this.lastCtx?.gameId;
    this.lastCtx = ctx;

    if (ctx.gameId !== prevGameId) {
      this.cachedCallback = null;
    }

    if (ctx.opponent.toLowerCase() !== prevOpponent) {
      this.targetSide = ctx.opponentSide;
    }

    const target =
      ctx.surface === 'profile'
        ? ctx.opponent
        : this.targetSide === 'bottom'
          ? ctx.bottomPlayer || ctx.opponent
          : ctx.topPlayer || ctx.opponent;

    if (ctx.surface === 'profile') {
      this.clockMonitor?.stop();
    } else {
      this.clockMonitor?.setTarget(target, this.targetSide, ctx.gameId);
      if (ctx.gameId) {
        void this.fetchAndHydrateGameCallback(ctx.gameId, target);
      }
    }

    this.hud?.setAbortWindow(ctx.isAbortWindowOpen);
    this.hud?.setSurface(ctx.surface);

    if (target.toLowerCase() !== this.activeUsername?.toLowerCase()) {
      void this.analyzeTarget(target, ctx.detectedFormat, false);
    }
  }

  private handleMatchLeft(): void {
    this.activeUsername = null;
    this.latestResult = null;
    this.lastCtx = null;
    this.cachedCallback = null;
    this.clockMonitor?.stop();
    removeInlineUsernameBadges();
    this.hud?.hide();
  }

  private async analyzeTarget(
    username: string,
    preferredFormat: TimeClass | undefined,
    forceRefresh: boolean
  ): Promise<void> {
    this.activeUsername = username;
    const isSelfProfile = Boolean(
      this.lastCtx?.surface === 'profile' && this.lastCtx.isSelfProfile
    );
    const shouldAutoOpenHud = (this.settings.autoShowHud && !isSelfProfile) || forceRefresh;

    if (shouldAutoOpenHud) {
      this.hud?.showLoading(username);
    }

    try {
      const msg: ExtensionMessage = {
        type: 'ANALYZE_PLAYER',
        username,
        preferredFormat: preferredFormat || this.cachedCallback?.detectedFormat,
        forceRefresh,
      };
      const response = (await chrome.runtime.sendMessage(msg)) as {
        ok: boolean;
        result?: CheatAnalysisResult;
        error?: string;
      };

      if (this.activeUsername?.toLowerCase() !== username.toLowerCase()) return;

      if (!response || !response.ok || !response.result) {
        if (shouldAutoOpenHud) {
          this.hud?.showError(username, response?.error || 'Could not load Chess.com data');
        }
        return;
      }

      const result = response.result;
      this.latestResult = result;

      const watchlist = await getWatchlist();
      const isWatched = watchlist.some(
        (w) => w.username.toLowerCase() === result.username.toLowerCase()
      );

      if (
        this.settings.soundAlerts &&
        !isSelfProfile &&
        !this.alertedUsernames.has(result.username.toLowerCase()) &&
        (result.probability >= 75 || result.isBannedFairPlay || isWatched)
      ) {
        this.alertedUsernames.add(result.username.toLowerCase());
        playRiskAlertChime(result.probability >= 88 || result.isBannedFairPlay);
      }

      const surface = this.lastCtx?.surface ?? 'live';
      const liveSnap = this.clockMonitor?.getLatestTelemetry() ?? null;

      if (shouldAutoOpenHud) {
        this.hud?.showResult(
          result,
          isWatched,
          this.lastCtx?.isAbortWindowOpen ?? false,
          surface
        );
        if (liveSnap) this.hud?.updateLiveClock(liveSnap);
      }

      if (this.settings.showInlineBadge) {
        renderInlineUsernameBadge(
          result,
          this.targetSide,
          this.settings.language,
          () => {
            this.hud?.showResult(
              result,
              isWatched,
              this.lastCtx?.isAbortWindowOpen ?? false,
              surface
            );
            const snap = this.clockMonitor?.getLatestTelemetry() ?? null;
            if (snap) this.hud?.updateLiveClock(snap);
            this.hud?.expandFromBadge();
          },
          { liveClock: liveSnap, surface }
        );
      } else {
        removeInlineUsernameBadges();
      }
    } catch {
      // Background asleep or extension reloaded
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
            () => this.hud?.expandFromBadge(),
            {
              liveClock: this.clockMonitor?.getLatestTelemetry(),
              surface: this.lastCtx?.surface ?? 'live',
            }
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
      } else if (msg.type === 'GET_ACTIVE_MATCH_STATE') {
        sendResponse({
          ok: true,
          activeUsername: this.activeUsername,
          result: this.latestResult,
          liveClock: this.clockMonitor?.getLatestTelemetry() ?? null,
        });
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
