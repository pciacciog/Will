import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.innercircles.app',
  appName: 'Inner Circles',
  webDir: 'dist/public',
  server: {
    androidScheme: 'https',
    iosScheme: 'https',
    url: 'https://willbeta.replit.app',
    cleartext: true
  },
  ios: {
    scheme: 'Inner Circles'
  }
};

export default config;
