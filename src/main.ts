import './styles.css';
import { unlockAudio } from './audio';
import { onBack } from './platform';
import { refreshPeriods, save } from './save';
import { handleBack, home } from './ui/screens';
import { watchForUpdates } from './update';

refreshPeriods();
save();
home();
onBack(handleBack);
watchForUpdates();
window.addEventListener('pointerdown', () => unlockAudio(), { once: true });
document.addEventListener('visibilitychange', () => { if (document.hidden) save(); });
