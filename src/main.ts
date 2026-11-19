import './styles.css';
import { unlockAudio } from './audio';
import { onBack } from './platform';
import { preloadTheme } from './game/art';
import { profile, refreshPeriods, save } from './save';
import { handleBack, home } from './ui/screens';
import { watchForUpdates } from './update';

refreshPeriods();
save();
// Show the menu once the piece art is ready (or after a short wait on slow phones).
let started = false;
const start = () => { if (!started) { started = true; home(); } };
preloadTheme(profile.settings.theme, start);
setTimeout(start, 1500);
onBack(handleBack);
watchForUpdates();
window.addEventListener('pointerdown', () => unlockAudio(), { once: true });
document.addEventListener('visibilitychange', () => { if (document.hidden) save(); });
