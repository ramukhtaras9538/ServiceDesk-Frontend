# Welcome to your Expo app 👋

This is an [Expo](https://expo.dev) project created with [`create-expo-app`](https://www.npmjs.com/package/create-expo-app).

## Get started

1. Install dependencies

   ```bash
   npm install
   ```

2. Start the app

   ```bash
   npx expo start
   ```

In the output, you'll find options to open the app in a

- [development build](https://docs.expo.dev/develop/development-builds/introduction/)
- [Android emulator](https://docs.expo.dev/workflow/android-studio-emulator/)
- [iOS simulator](https://docs.expo.dev/workflow/ios-simulator/)
- [Expo Go](https://expo.dev/go), a limited sandbox for trying out app development with Expo

You can start developing by editing the files inside the **app** directory. This project uses [file-based routing](https://docs.expo.dev/router/introduction).

## Secure API configuration

Development builds can use the automatically detected local API address. For a native Android development build that connects to a local HTTP API, set `APP_VARIANT=development` while generating the native project; this enables cleartext traffic only for that development build through an Android manifest config plugin. Preview and production builds explicitly disable Android cleartext traffic and require an HTTPS API origin.

## Automated checks

Run `npm test` for session-hydration regression tests, `npm run test:ui` for Jest/jest-expo tests, `npm run lint` for lint, and `npx tsc --noEmit` for type checking.

## Dependency audit note

The current Expo SDK 57 dependency tree has unresolved high-severity advisories in Expo CLI's build/signature-verification dependencies: `node-forge@1.4.0` (the registry currently has no patched release) and the CLI's Zod 3 dependency (the advisory's fix is in Zod 4.6.6, which is not a compatible drop-in override for this CLI dependency). `npm audit` suggests Expo 54, which would downgrade this SDK 57 app. Do not force that downgrade or override these packages without compatibility testing. Treat the Expo dependency advisories as a release blocker until a compatible Expo patch is available or a deliberate SDK migration has been built and tested.

The branded app icon is configured for iOS, the standard Android launcher icon, Android adaptive icons, and Android themed monochrome icons. Replace `assets/images/service-desk-icon.png` and the companion adaptive icon assets with approved brand artwork before publishing if PSG requires different marks. Add the organization's unique Android package name and iOS bundle identifier to `app.json` before creating store builds.

## Android and iOS store builds

The app uses `edu.psgtech.servicedesk` as the confirmed Android package name and iOS bundle identifier. The `eas.json` profiles produce an internal Android APK for preview and a store-ready Android App Bundle plus iOS store build for production. Before the first build, sign in to an Expo account and link this project with `npx eas-cli@latest build:configure`. Set `EXPO_PUBLIC_API_URL` in the EAS preview and production environments to the deployed HTTPS API origin; release configuration intentionally refuses a missing or non-HTTPS API origin.

Build both production binaries with `npx eas-cli@latest build --platform all --profile production`. Submit builds with `npx eas-cli@latest submit --platform android --profile production` or `npx eas-cli@latest submit --platform ios --profile production`. App Store Connect and Google Play developer accounts, store listing details, screenshots, privacy declarations, and signing credentials are still required. Upload `assets/images/service-desk-play-store-icon.png` as the Google Play listing icon.

Before creating a production web or native build, configure `EXPO_PUBLIC_API_URL` in the matching EAS `preview` or `production` environment to the HTTPS origin of the deployed API (for example, `https://api.example.com`). The build profile sets `APP_VARIANT` automatically; do not rely on a local `.env` for EAS builds. The production build rejects missing or non-HTTPS API origins, and the app enforces HTTPS at runtime. Do not put credentials or other secrets in `EXPO_PUBLIC_*` variables; they are embedded in the client.

## Get a fresh project

When you're ready, run:

```bash
npm run reset-project
```

This command will move the starter code to the **app-example** directory and create a blank **app** directory where you can start developing.

### Other setup steps

- To set up ESLint for linting, run `npx expo lint`, or follow our guide on ["Using ESLint and Prettier"](https://docs.expo.dev/guides/using-eslint/)
- If you'd like to set up unit testing, follow our guide on ["Unit Testing with Jest"](https://docs.expo.dev/develop/unit-testing/)
- Learn more about the TypeScript setup in this template in our guide on ["Using TypeScript"](https://docs.expo.dev/guides/typescript/)

## Learn more

To learn more about developing your project with Expo, look at the following resources:

- [Expo documentation](https://docs.expo.dev/): Learn fundamentals, or go into advanced topics with our [guides](https://docs.expo.dev/guides).
- [Learn Expo tutorial](https://docs.expo.dev/tutorial/introduction/): Follow a step-by-step tutorial where you'll create a project that runs on Android, iOS, and the web.

## Join the community

Join our community of developers creating universal apps.

- [Expo on GitHub](https://github.com/expo/expo): View our open source platform and contribute.
- [Discord community](https://chat.expo.dev): Chat with Expo users and ask questions.
