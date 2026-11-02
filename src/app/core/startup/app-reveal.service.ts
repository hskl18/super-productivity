import { DOCUMENT } from '@angular/common';
import {
  afterNextRender,
  DestroyRef,
  inject,
  Injectable,
  Injector,
  signal,
} from '@angular/core';
import {
  NavigationCancel,
  NavigationEnd,
  NavigationError,
  Router,
} from '@angular/router';
import { TranslateService } from '@ngx-translate/core';
import { firstValueFrom } from 'rxjs';
import { filter, take } from 'rxjs/operators';
import { T } from '../../t.const';
import { MaterialIconsLoaderService } from '../../ui/material-icons-loader.service';
import { Log } from '../log';

/** Id of the boot splash in `src/index.html`; a sibling of `<app-root>`. */
export const APP_SPLASH_ID = 'app-splash';
/** Added to the splash to start its fade-out (styles live in `src/index.html`). */
export const APP_SPLASH_HIDING_CLASS = 'is-hiding';

/**
 * Upper bound for keeping the splash up. Startup dialogs (repair, encryption
 * password, …) render above the splash, so this only matters if boot stalls
 * entirely: then the user still gets the shell instead of a frozen splash.
 */
export const APP_REVEAL_MAX_WAIT_MS = 10000;
/** Must cover the splash fade in `src/index.html`; removes it if no transitionend fires. */
export const APP_SPLASH_REMOVE_FALLBACK_MS = 800;
/** Covers the staggered shell entrance in `app.component.scss`. */
export const APP_ENTRANCE_DURATION_MS = 900;

/**
 * Hands over from the static boot splash to the app on cold start.
 *
 * Angular renders the shell long before the first route has data, labels and
 * icons, so revealing on bootstrap shows an empty shell that fills in piece by
 * piece. Instead the splash stays up until the first route has rendered with
 * translations and the icon font, then fades out while the shell plays one
 * entrance animation.
 */
@Injectable({ providedIn: 'root' })
export class AppRevealService {
  private readonly _document = inject(DOCUMENT);
  private readonly _router = inject(Router);
  private readonly _injector = inject(Injector);
  private readonly _translateService = inject(TranslateService);
  private readonly _materialIconsLoaderService = inject(MaterialIconsLoaderService);
  private readonly _destroyRef = inject(DestroyRef);

  /** True once the splash starts fading out; the shell may animate from here on. */
  readonly isRevealed = signal(false);
  /** True while the shell's entrance animation runs. */
  readonly isEntrance = signal(false);
  /** True once the entrance has finished; late arrivals (hints) wait for this. */
  readonly isSettled = signal(false);

  private _isInitialized = false;
  private _timeoutIds: ReturnType<typeof setTimeout>[] = [];

  init(): void {
    if (this._isInitialized) {
      return;
    }
    this._isInitialized = true;
    this._destroyRef.onDestroy(() => this._timeoutIds.forEach(clearTimeout));

    this._later(() => {
      if (!this.isRevealed()) {
        Log.warn('[Boot] Revealing app after max splash wait');
        this._reveal();
      }
    }, APP_REVEAL_MAX_WAIT_MS);

    void this._waitUntilReady()
      .catch((err) => Log.warn('[Boot] Reveal readiness check failed', err))
      .then(() => this._reveal());
  }

  private async _waitUntilReady(): Promise<void> {
    // The first navigation waits for the initial data load (see app.guard.ts).
    await firstValueFrom(
      this._router.events.pipe(
        filter(
          (ev) =>
            ev instanceof NavigationEnd ||
            ev instanceof NavigationCancel ||
            ev instanceof NavigationError,
        ),
        take(1),
      ),
    );
    await Promise.all([
      // `get` waits for a pending translation load; the shell's labels need it.
      firstValueFrom(this._translateService.get(T.MH.ADD_NEW_TASK)),
      this._materialIconsLoaderService.ensureFontReady(),
      new Promise<void>((resolve) =>
        afterNextRender(() => resolve(), { injector: this._injector }),
      ),
    ]);
    // Let the rendered route paint once before the splash starts fading.
    await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
  }

  private _reveal(): void {
    if (this.isRevealed()) {
      return;
    }
    this.isRevealed.set(true);
    this.isEntrance.set(true);
    this._later(() => {
      this.isEntrance.set(false);
      this.isSettled.set(true);
    }, APP_ENTRANCE_DURATION_MS);
    this._hideSplash();
  }

  private _hideSplash(): void {
    const splash = this._document.getElementById(APP_SPLASH_ID);
    if (!splash) {
      return;
    }
    const remove = (): void => splash.remove();
    splash.addEventListener('transitionend', (ev) => {
      if (ev.target === splash) {
        remove();
      }
    });
    // Also covers disabled animations, where no transitionend fires.
    this._later(remove, APP_SPLASH_REMOVE_FALLBACK_MS);
    splash.classList.add(APP_SPLASH_HIDING_CLASS);
  }

  private _later(fn: () => void, ms: number): void {
    this._timeoutIds.push(setTimeout(fn, ms));
  }
}
