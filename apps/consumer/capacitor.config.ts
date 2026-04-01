import type { CapacitorConfig } from '@capacitor/cli';

const serverUrl = process.env.CAP_SERVER_URL ?? 'https://zota-platform-consumer.vercel.app';

const config: CapacitorConfig = {
  appId: 'com.beautifulmind.consumer',
  appName: 'Zota',
  webDir: 'capacitor-shell',
  server: {
    url: serverUrl,
    cleartext: serverUrl.startsWith('http://'),
  },
};

export default config;
