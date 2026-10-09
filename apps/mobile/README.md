# @music-cloud/mobile

React Native mobile client for **Music Cloud**, built with **Expo SDK 57**, **React Navigation**, and **react-native-track-player** for background audio playback on iOS, iPadOS, and Android.

---

## Overview

This package delivers the native mobile experience for Music Cloud:

- **Audio Streaming & Background Playback**: Native media playback controls, lock screen metadata, notification controls, and audio session management via `react-native-track-player`.
- **Navigation & Library Browsing**: Bottom-tab navigation for Home, Search, and Library catalog views.
- **Universal Tablet Support**: Native iPadOS multi-orientation tablet support and responsive layout.
- **Continuous Native Generation (CNG)**: Managed Expo workflow using config plugins (`plugins/withIosSceneLifecycle.js`) to generate native iOS and Android projects cleanly without manual native code edits.

---

## Environment Setup

Create `.env` inside `apps/mobile/` (or copy `.env.example`):

```bash
cp .env.example .env
```

Configure `EXPO_PUBLIC_API_BASE_URL` based on your target runtime environment:

- **iOS Simulator**: `http://localhost:8000`
- **Android Emulator**: `http://10.0.2.2:8000`
- **Physical Device**: `http://<YOUR_LAN_IP>:8000` (e.g. `http://192.168.1.5:8000`)

---

## How to Run

> **Note**: Because this project uses `react-native-track-player` for background audio services, it requires native development builds (or prebuilt native apps), rather than standard Expo Go.

### From Monorepo Root

Start the Expo bundler:

```bash
npm run dev:mobile
```

### From `apps/mobile` Directory

Install dependencies (from workspace root if not already done):

```bash
npm install
```

#### Run on iOS Simulator

```bash
npm run ios
```

#### Run on Android Emulator / Connected Device

```bash
npm run android
```

#### Start Metro Bundler

```bash
npm start
```

---

## Cloud Builds (EAS)

Build standalone APKs or internal distribution binaries via Expo Application Services (EAS):

```bash
# Android APK preview build
eas build --platform android --profile preview

# iOS internal distribution build
eas build --platform ios --profile preview
```
