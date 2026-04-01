import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.horsemeninteractive.theassembly',
  appName: 'The Assembly',
  webDir: 'dist',
  server: {
    cleartext: false,
  },
  plugins: {
    CapacitorHttp: {
      enabled: true,
    },
  },
};

export default config;

