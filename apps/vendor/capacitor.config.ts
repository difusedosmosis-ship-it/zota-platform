import type { CapacitorConfig } from '@capacitor/cli';

const serverUrl = process.env.CAP_SERVER_URL ?? 'https://zota-platform-vendor.vercel.app';

const config: CapacitorConfig = {
  appId: 'com.beautifulmind.vendor',
  appName: 'Zota Business',
  webDir: 'capacitor-shell',
  server: {
    url: serverUrl,
    cleartext: serverUrl.startsWith('http://'),
  },
};

export default config;
