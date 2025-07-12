import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.porfirio.will',
  appName: 'WILL',
  webDir: 'dist/public',
  server: {
    androidScheme: 'https',
    iosScheme: 'https',
    url: 'https://willbeta.replit.app',
    cleartext: true
  },
  ios: {
    scheme: 'WILL',
    webContentsDebuggingEnabled: true,
    allowsInlineMediaPlayback: true,
    allowsAirPlayForMediaPlayback: true,
    allowsBackForwardNavigationGestures: true,
    allowsLinkPreview: true,
    mediaTypesRequiringUserActionForPlayback: []
  },
  plugins: {
    CapacitorHttp: {
      enabled: true
    },
    Browser: {
      enabled: true,
      presentationStyle: 'fullscreen'
    }
  }
};

export default config;
