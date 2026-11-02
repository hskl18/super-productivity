import {
  BOOT_SPLASH_HIDING_CLASS,
  BOOT_SPLASH_ID,
  fadeOutBootSplash,
} from './boot-splash';

describe('fadeOutBootSplash', () => {
  let splash: HTMLElement;
  let style: HTMLStyleElement;

  beforeEach(() => {
    style = document.createElement('style');
    style.textContent = `#${BOOT_SPLASH_ID}.${BOOT_SPLASH_HIDING_CLASS} { opacity: 0; transition: opacity 60ms; }`;
    document.head.appendChild(style);
    splash = document.createElement('div');
    splash.id = BOOT_SPLASH_ID;
    document.body.appendChild(splash);
    // Commit the starting style so adding the class starts a transition.
    void getComputedStyle(splash).opacity;
  });

  afterEach(() => {
    splash.remove();
    style.remove();
  });

  const waitMs = (ms: number): Promise<void> =>
    new Promise((resolve) => setTimeout(resolve, ms));

  it('starts the fade and removes the splash only after it has played', async () => {
    fadeOutBootSplash();

    expect(splash.classList).toContain(BOOT_SPLASH_HIDING_CLASS);
    expect(splash.isConnected).toBe(true);

    await waitMs(300);
    expect(splash.isConnected).toBe(false);
  });

  it('removes the splash right away when nothing animates', async () => {
    style.textContent = '';

    fadeOutBootSplash();
    await waitMs(0);

    expect(splash.isConnected).toBe(false);
  });

  it('does not wait for infinite animations inside the splash', async () => {
    style.textContent += ` @keyframes spin { to { opacity: 0.5; } } .pulse { animation: spin 1s infinite; }`;
    const pulse = document.createElement('div');
    pulse.className = 'pulse';
    splash.appendChild(pulse);

    fadeOutBootSplash();
    await waitMs(300);

    expect(splash.isConnected).toBe(false);
  });

  it('does nothing without a splash', () => {
    splash.remove();

    expect(() => fadeOutBootSplash()).not.toThrow();
  });
});
