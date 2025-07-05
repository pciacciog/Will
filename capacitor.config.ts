import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.will.app',
  appName: 'WILL',
  webDir: 'dist/public',
  server: {
    androidScheme: 'http',
    iosScheme: 'http',
    url: 'http://localhost:5000',
    cleartext: true
  },
  ios: {
    scheme: 'WILL'
  },
  plugins: {
    LiveReload: {
      enabled: true,
      hostname: 'localhost',
      port: 5000
    }
  }
};

export default config;
