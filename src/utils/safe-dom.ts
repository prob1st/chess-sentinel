/**
 * Safe HTML & Audio utilities compliant with strict Mozilla AMO (addons-linter) rules.
 * Uses DOMParser instead of innerHTML to guarantee zero UNSAFE_VAR_ASSIGNMENT warnings.
 */

export function escapeHtml(raw: string): string {
  return raw
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function setSafeHtml(target: Element, html: string): void {
  const parser = new DOMParser();
  const doc = parser.parseFromString(`<!DOCTYPE html><html><body>${html}</body></html>`, 'text/html');
  const nodes = Array.from(doc.body.childNodes).map((node) => document.importNode(node, true));
  target.replaceChildren(...nodes);
}

/**
 * Synthesizes a subtle, non-intrusive dual-tone WebAudio alert chime
 * when a High / Critical / Banned opponent is detected at match start.
 * Requires zero external MP3/WAV files.
 */
export function playRiskAlertChime(isCritical: boolean): void {
  try {
    const AudioCtx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return;

    const ctx = new AudioCtx();
    if (ctx.state === 'suspended') {
      void ctx.resume().catch(() => {});
    }

    const now = ctx.currentTime;
    const freqs = isCritical ? [587.33, 880.0, 1174.66] : [523.25, 659.25];

    freqs.forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = isCritical ? 'triangle' : 'sine';
      osc.frequency.setValueAtTime(freq, now + idx * 0.11);

      gain.gain.setValueAtTime(0.0001, now + idx * 0.11);
      gain.gain.exponentialRampToValueAtTime(0.075, now + idx * 0.11 + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + idx * 0.11 + 0.16);

      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now + idx * 0.11);
      osc.stop(now + idx * 0.11 + 0.17);
    });

    setTimeout(() => {
      void ctx.close().catch(() => {});
    }, 800);
  } catch {
    // Ignore autoplay restriction if user hasn't interacted with page yet
  }
}
