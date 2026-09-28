import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'cu.cubapos.universal',
  appName: 'Cuba POS Universal',
  webDir: 'dist',
  server: {
    androidScheme: 'https'
  },
  android: {
    minWebViewVersion: 61,
    allowMixedContent: true
  },
  plugins: {
    CapacitorHttp: {
      enabled: true
    }
  }
};

export default config;
