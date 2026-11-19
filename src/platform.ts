import { App } from '@capacitor/app';
import { Capacitor } from '@capacitor/core';
import { Haptics, ImpactStyle } from '@capacitor/haptics';
import { profile } from './save';

export const isNative = Capacitor.isNativePlatform();

/** A short vibration, if the player has it on. */
export function buzz(strong = false) {
  if (!profile.settings.vibration) return;
  if (isNative) {
    Haptics.impact({ style: strong ? ImpactStyle.Heavy : ImpactStyle.Light }).catch(() => {});
  } else if ('vibrate' in navigator) {
    try { navigator.vibrate(strong ? 35 : 10); } catch { /* not supported */ }
  }
}

/** Android back button: the handler returns true when it handled the press. */
export function onBack(handler: () => boolean) {
  if (!isNative) return;
  App.addListener('backButton', () => {
    if (!handler()) App.exitApp();
  });
}

/** Opens a link outside the game (the system browser on Android). */
export function openExternal(url: string) {
  window.open(url, '_blank');
}
