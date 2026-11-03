export function createSound(button) {
  const AudioContext = window.AudioContext || window.webkitAudioContext;
  let context;
  let gain;
  let enabled = false;
  let visible = !document.hidden;
  let disposed = false;

  function sync() {
    if (!context || disposed) return;
    if (enabled && visible) void context.resume().catch(() => {});
    else void context.suspend().catch(() => {});
  }

  if (AudioContext) {
    button.hidden = false;
    button.addEventListener('click', async () => {
      button.disabled = true;
      try {
        if (!context) {
          context = new AudioContext();
          gain = context.createGain();
          gain.gain.value = 0;
          gain.connect(context.destination);
          for (const [frequency, volume] of [[43, .19], [57.3, .10], [86.4, .04]]) {
            const oscillator = context.createOscillator();
            const voice = context.createGain();
            oscillator.frequency.value = frequency;
            voice.gain.value = volume;
            oscillator.connect(voice).connect(gain);
            oscillator.start();
          }
        }
        if (!enabled) await context.resume();
        if (disposed) return;
        enabled = !enabled;
        gain.gain.setTargetAtTime(enabled ? .45 : 0, context.currentTime, .07);
        button.setAttribute('aria-pressed', String(enabled));
        button.textContent = enabled ? 'Sound on' : 'Sound off';
        if (!visible) sync();
      } catch {
        button.textContent = 'Retry sound';
      } finally {
        button.disabled = false;
      }
    });
  }
  return {
    setVisible(value) { visible = value; sync(); },
    dispose() {
      disposed = true;
      if (context) void context.close().catch(() => {});
    },
  };
}
