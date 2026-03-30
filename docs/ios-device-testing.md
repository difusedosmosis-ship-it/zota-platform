# iOS Device Testing

## Current LAN IP

`192.168.100.197`

## Consumer app on a physical iPhone

1. Start backend and consumer app on the Mac:

```bash
cd "/Users/ochigaidoko/Documents/New project"
npm run dev:api
npm run dev:consumer
```

2. Sync Capacitor to the Mac's LAN URL:

```bash
cd "/Users/ochigaidoko/Documents/New project/apps/consumer"
npm run ios:sync:lan
```

3. Open Xcode:

```bash
npm run cap:open:ios
```

4. Run on the iPhone while both devices are on the same Wi-Fi network.

## Vendor app on a physical iPhone

1. Start backend and vendor app:

```bash
cd "/Users/ochigaidoko/Documents/New project"
npm run dev:api
npm run dev:vendor
```

2. Sync Capacitor to the Mac's LAN URL:

```bash
cd "/Users/ochigaidoko/Documents/New project/apps/vendor"
npm run ios:sync:lan
```

3. Open Xcode:

```bash
npm run cap:open:ios
```

## Notes

- `localhost` works for the simulator, not for a real iPhone.
- On a real iPhone, Capacitor must point to your Mac's LAN IP.
- The Next.js apps proxy API requests to the backend on the Mac, so you usually do not need a separate API URL change for local device testing.
- For hosted card payments, use a callback URL on the same LAN-served app during local testing.
