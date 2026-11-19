import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'app.stellardrop.game',
  appName: 'Stellar Drop',
  webDir: 'dist',
  backgroundColor: '#1a1240',
  android: { allowMixedContent: false },
};

export default config;
