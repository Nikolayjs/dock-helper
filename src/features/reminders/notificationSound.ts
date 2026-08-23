type AudioContextConstructor = typeof AudioContext;

/** Two-tone chime, synthesized so no audio asset is needed. Best-effort — silently no-ops if audio is unavailable or blocked. */
export function playReminderChime(): void {
  try {
    const Ctx: AudioContextConstructor | undefined =
      window.AudioContext ?? (window as unknown as { webkitAudioContext?: AudioContextConstructor }).webkitAudioContext;
    if (!Ctx) return;

    const ctx = new Ctx();
    const now = ctx.currentTime;

    [880, 1318.5].forEach((freq, i) => {
      const start = now + i * 0.14;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0, start);
      gain.gain.linearRampToValueAtTime(0.18, start + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.35);
      osc.connect(gain).connect(ctx.destination);
      osc.start(start);
      osc.stop(start + 0.4);
    });

    window.setTimeout(() => void ctx.close(), 900);
  } catch {
    // Audio unavailable or blocked by the browser — the visual notification still shows.
  }
}
