import { ApplicationRef } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { NavigationEnd, Router } from '@angular/router';
import { TranslateService } from '@ngx-translate/core';
import { Subject } from 'rxjs';
import { MaterialIconsLoaderService } from '../../ui/material-icons-loader.service';
import {
  APP_ENTRANCE_DURATION_MS,
  APP_REVEAL_MAX_WAIT_MS,
  APP_SPLASH_HIDING_CLASS,
  APP_SPLASH_ID,
  APP_SPLASH_REMOVE_FALLBACK_MS,
  AppRevealService,
} from './app-reveal.service';

describe('AppRevealService', () => {
  let routerEvents$: Subject<unknown>;
  let translation$: Subject<string>;
  let resolveFont: () => void;
  let splash: HTMLElement;
  let service: AppRevealService;

  const nextFrame = (): Promise<void> =>
    new Promise((resolve) => requestAnimationFrame(() => resolve()));

  /** Drives render hooks and frames until the service reveals (or gives up). */
  const settle = async (): Promise<void> => {
    const appRef = TestBed.inject(ApplicationRef);
    for (let i = 0; i < 20 && !service.isRevealed(); i++) {
      appRef.tick();
      await nextFrame();
    }
  };

  beforeEach(() => {
    routerEvents$ = new Subject();
    translation$ = new Subject();
    const fontReady = new Promise<void>((resolve) => (resolveFont = resolve));

    splash = document.createElement('div');
    splash.id = APP_SPLASH_ID;
    document.body.appendChild(splash);

    TestBed.configureTestingModule({
      providers: [
        { provide: Router, useValue: { events: routerEvents$ } },
        { provide: TranslateService, useValue: { get: () => translation$ } },
        {
          provide: MaterialIconsLoaderService,
          useValue: { ensureFontReady: () => fontReady },
        },
      ],
    });
    service = TestBed.inject(AppRevealService);
  });

  afterEach(() => {
    splash.remove();
    jasmine.clock().uninstall();
  });

  it('keeps the splash until the first route, translations and icon font are ready', async () => {
    service.init();

    routerEvents$.next(new NavigationEnd(1, '/', '/'));
    await settle();
    expect(service.isRevealed()).toBe(false);

    translation$.next('Add task');
    await settle();
    expect(service.isRevealed()).toBe(false);

    resolveFont();
    await settle();

    expect(service.isRevealed()).toBe(true);
    expect(service.isEntrance()).toBe(true);
    expect(splash.classList).toContain(APP_SPLASH_HIDING_CLASS);
  });

  it('reveals after the max wait even if boot never finishes', () => {
    jasmine.clock().install();
    service.init();

    jasmine.clock().tick(APP_REVEAL_MAX_WAIT_MS - 1);
    expect(service.isRevealed()).toBe(false);

    jasmine.clock().tick(1);
    expect(service.isRevealed()).toBe(true);
    expect(splash.classList).toContain(APP_SPLASH_HIDING_CLASS);
  });

  it('removes the splash and settles the entrance without relying on transitionend', () => {
    jasmine.clock().install();
    service.init();
    jasmine.clock().tick(APP_REVEAL_MAX_WAIT_MS);

    jasmine.clock().tick(APP_SPLASH_REMOVE_FALLBACK_MS);
    expect(document.getElementById(APP_SPLASH_ID)).toBeNull();

    jasmine.clock().tick(APP_ENTRANCE_DURATION_MS);
    expect(service.isEntrance()).toBe(false);
    expect(service.isSettled()).toBe(true);
  });

  it('removes the splash when its own fade ends', () => {
    jasmine.clock().install();
    service.init();
    jasmine.clock().tick(APP_REVEAL_MAX_WAIT_MS);

    splash.dispatchEvent(new Event('transitionend'));

    expect(document.getElementById(APP_SPLASH_ID)).toBeNull();
  });
});
