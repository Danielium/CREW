import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.crew.app',
  appName: 'CREW',
  webDir: 'public',
  server: {
    url: 'https://crew-gamma.vercel.app',
    cleartext: true
  }
};

export default config;
