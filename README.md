<div align="center">
  <a href="https://fairwallet.et">
    <img src="src/assets/icon-only.png" alt="Fairwallet logo" height="128" />
  </a>

  <h1>Fairwallet</h1>

  <p>
    A secure self-sovereign identity wallet for issuing, holding, and presenting verifiable credentials.
  </p>

  <p>
    <a href="https://fairwallet.et"><strong>fairwallet.et</strong></a>
    |
    <a href="#quick-start">Quick start</a>
    |
    <a href="#resources">Resources</a>
    |
    <a href="./docs/Running-in-an-Emulator.md">Run on device</a>
  </p>

  <p>
    <img alt="Version" src="https://img.shields.io/badge/version-1.1.0-022339" />
    <img alt="Platforms" src="https://img.shields.io/badge/platforms-Android%20%7C%20iOS%20%7C%20Web-0f766e" />
    <img alt="Capacitor" src="https://img.shields.io/badge/Capacitor-7.x-119eff" />
    <img alt="License" src="https://img.shields.io/badge/license-Apache--2.0-6b7280" />
  </p>
</div>

---

## Overview

Fairwallet is the Fairwallet-branded digital identity wallet in this repository. It is based on the open-source Veridian Wallet/KERI stack and has been updated for the current Fairwallet flow: hosted Fairwallet agent endpoints, student-friendly onboarding, Fayda and Candour identity verification, and a credential issuance dashboard for issuers and verifiers.

The wallet lets a holder create a secure identity, connect with an issuer, verify identity attributes, accept signed credentials, and present proofs when a verifier asks for them. The supporting services in this repo provide KERIA-backed credential issuance, dashboard authentication, issuer templates, presentation requests, notifications, and admin workflows.

## Current Version

| Area                         | Current value                                    |
| ---------------------------- | ------------------------------------------------ |
| Wallet product name          | `Fairwallet`                                     |
| Root package version         | `1.1.0`                                          |
| Android version              | `1.1.0`, version code `1`                        |
| iOS marketing version        | `1.1.0`, build `1`                               |
| Web/PWA manifest             | `Fairwallet`                                     |
| Hosted wallet KERIA endpoint | `https://connect.fairwallet.et`                  |
| Hosted wallet boot endpoint  | `https://boot.fairwallet.et`                     |
| Public site                  | [`https://fairwallet.et`](https://fairwallet.et) |

> Native package identifiers still include legacy Veridian/Cardano Foundation values in a few project files for compatibility with existing mobile signing and deep-link behavior. Treat those as release/signing details, not user-facing branding.

## What Ships Here

- **Mobile wallet**: Ionic React + Capacitor app for Android, iOS, and web preview.
- **Wallet security**: local encrypted storage, passcode and biometric unlock, privacy screen protection, freeRASP checks in production, recovery phrase flows, and device compatibility checks.
- **KERI identity layer**: Signify/KERIA cloud-agent connection, autonomic identifiers, witnesses, OOBI resolution, and ACDC credential exchange.
- **Identity verification**: Fayda OAuth/eSignet flow and Candour session flow for pending wallet connections.
- **Credential issuance API**: Express service for schemas, contacts, credential issuance, revocation, presentation requests, realtime events, and OpenAPI docs.
- **Issuer/verifier dashboard**: Vite + React dashboard for credential templates, issuance, presentation requests, Google sign-in, admin users, and notifications.
- **Local infrastructure**: Docker Compose setup for KERIA, witnesses, Postgres, credential issuance API, and dashboard UI.

## Student Onboarding Journey

Fairwallet is designed so a student can move through the wallet without needing to understand the underlying SSI stack:

1. Download the official Android APK or iOS TestFlight build from Fairwallet channels.
2. Create the wallet, set a passcode, enable biometrics, and save the recovery phrase.
3. Scan an issuer QR code or open an issuer link from a university, employer, or service provider.
4. Complete identity verification through Fayda or Candour when the issuer requires it.
5. Receive signed academic credentials such as student IDs, transcripts, degrees, certificates, scholarships, or awards.
6. Review and accept credentials into local encrypted storage.
7. Present selected credential attributes to employers, scholarship committees, campus services, financial institutions, or other verifiers.
8. Track credential history, sharing activity, and revocation/suspension alerts from inside the wallet.

## Architecture

<p align="center">
  <a href="./docs/images/readme/Architecture-Diagram.svg">
    <img src="./docs/images/readme/Architecture-Diagram.svg" alt="Fairwallet architecture diagram" />
  </a>
</p>

At a high level:

- The **edge wallet** runs on the holder's phone and controls keys, identifiers, approvals, and credential storage.
- **KERIA** acts as the cloud agent for wallet connectivity, recovery sync, OOBI resolution, and credential messaging.
- The **credential issuance server** manages issuer runtime state, templates, schemas, contacts, credential lifecycle operations, presentation requests, notifications, and identity-verification results.
- The **dashboard UI** gives issuers, verifiers, and admins a browser interface for operational workflows.
- External identity providers such as **Fayda** and **Candour** can verify holder attributes before a connection is finalized or a credential is issued.

## Repository Map

| Path                                                               | Purpose                                                                                                        |
| ------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------- |
| [`src`](./src)                                                     | Wallet app, routes, UI pages, KERI agent integration, storage, security, translations, and tests.              |
| [`services/credential-server`](./services/credential-server)       | Express credential issuance API, tenant store, auth, Fayda/Candour integrations, migrations, OpenAPI document. |
| [`services/credential-server-ui`](./services/credential-server-ui) | Issuer/verifier/admin dashboard built with React, Vite, MUI, and Redux Toolkit.                                |
| [`configs`](./configs)                                             | Wallet runtime configuration for local, remote, and production environments.                                   |
| [`android`](./android)                                             | Capacitor Android project and release configuration.                                                           |
| [`ios`](./ios)                                                     | Capacitor iOS project and release configuration.                                                               |
| [`docs`](./docs)                                                   | Emulator, testing, TestFlight, icons/splash, email, and Google sign-in guides.                                 |
| [`tests`](./tests)                                                 | WebdriverIO/Appium end-to-end test features, page objects, and step definitions.                               |

## Requirements

- Node.js 20
- npm
- Docker and Docker Compose
- Android Studio for Android builds/emulators
- Xcode, CocoaPods, and macOS for iOS builds/TestFlight
- Capacitor CLI through `npx cap ...`

For native setup details, see the [Capacitor environment setup guide](https://capacitorjs.com/docs/getting-started/environment-setup).

## Quick Start

Clone and install:

```bash
git clone <your-repo-url>
cd fairway-veridian-wallet
npm install
git config core.hooksPath .githooks
```

Start the local wallet infrastructure:

```bash
docker compose up -d --build
```

This exposes the main local services:

| Service                        | URL                     |
| ------------------------------ | ----------------------- |
| KERIA admin API                | `http://localhost:3901` |
| KERIA boot API                 | `http://localhost:3903` |
| Credential issuance API        | `http://localhost:3001` |
| Credential dashboard container | `http://localhost:3002` |

Run the wallet web preview:

```bash
npm run dev
```

Open [`http://localhost:3000`](http://localhost:3000).

## Environment Configuration

Start from the example file:

```bash
cp .env.example .env
```

Important wallet variables:

| Variable                                | Purpose                                                                      |
| --------------------------------------- | ---------------------------------------------------------------------------- |
| `ENVIRONMENT`                           | Selects `configs/local.yaml`, `configs/remote.yaml`, or `configs/prod.yaml`. |
| `DEV_SKIP_ONBOARDING`                   | Controls whether local builds skip onboarding.                               |
| `REACT_APP_CREDENTIAL_SERVER_API`       | Base URL for the credential issuance server used by verification callbacks.  |
| `REACT_APP_VERIFICATION_PROVIDER`       | Selects `fayda` or `candour` for pending connection verification.            |
| `REACT_APP_CANDOUR_ISSUER_API`          | Optional Candour-specific credential server base URL.                        |
| `REACT_APP_FAYDA_REDIRECT_URI`          | Fayda native callback URI override.                                          |
| `REACT_APP_CANDOUR_WEB_REDIRECT_URI`    | Candour browser callback URI override.                                       |
| `REACT_APP_CANDOUR_NATIVE_REDIRECT_URI` | Candour native callback URI override.                                        |
| `APP_TEAM_ID`                           | Apple Team ID for iOS signing.                                               |

Optional release metadata shown inside the wallet support screen:

```env
REACT_APP_RELEASE_DESCRIPTION=Signed Android release for Fairwallet.
REACT_APP_RELEASE_DATE=2026-03-30
REACT_APP_ANDROID_APK_SIZE=28.4 MB
REACT_APP_ANDROID_APK_SHA256=abc123...
REACT_APP_RELEASE_CHANGELOG=Updated Fairwallet branding|Fixed wallet scrolling
```

## Common Commands

| Command                     | What it does                                                                               |
| --------------------------- | ------------------------------------------------------------------------------------------ |
| `npm run dev`               | Starts the wallet web preview on port `3000`.                                              |
| `npm run build`             | Builds the wallet with the `remote` configuration.                                         |
| `npm run build:local`       | Builds the wallet with local KERIA settings.                                               |
| `npm run build:cap`         | Builds wallet assets, updates Android Capacitor files, and copies web assets into Android. |
| `npm run android:run:fresh` | Builds, installs, clears app data, and launches Android.                                   |
| `npm test`                  | Runs Jest unit tests.                                                                      |
| `npm run eslint`            | Runs wallet TypeScript linting.                                                            |
| `npm run prettier`          | Formats wallet and service source files.                                                   |

## Credential Server

Run locally without Docker:

```bash
cd services/credential-server
npm install
npm run dev
```

Default API port: [`http://localhost:3001`](http://localhost:3001)

API docs are served by the backend:

- Swagger UI: [`http://localhost:3001/api-docs`](http://localhost:3001/api-docs)
- OpenAPI JSON: [`http://localhost:3001/api-docs.json`](http://localhost:3001/api-docs.json)

The server includes:

- tenant and issuer bootstrapping
- dashboard auth, refresh tokens, Google login, password reset, and admin user management
- templates and credential issuance APIs under `/api/v2`
- contact, schema, OOBI, revocation, notification, presentation request, and realtime event endpoints
- Fayda internal gateway routes and Candour session/finalize/status routes
- Postgres migrations and encrypted issuer bran storage

For email and Google setup, see [Credential Server UI: Email and Google Sign-In Setup](./docs/Credential-Server-Email-and-Google-Setup.md).

## Dashboard UI

Run the dashboard locally:

```bash
cd services/credential-server-ui
npm install
npm run dev
```

Vite opens on [`http://localhost:5173`](http://localhost:5173) by default. Set `VITE_SERVER_URL=http://localhost:3001` when connecting it to the local credential server.

Dashboard capabilities include:

- issuer and verifier login
- Google sign-in and verifier self-registration
- admin users and issuer-access request review
- connections, credentials, credential templates, and issuance
- presentation requests for verifier workflows
- realtime notifications from the credential server

## Native Builds

Android:

```bash
npm run build:cap
npx cap open android
```

iOS:

```bash
npm run build
npx cap sync ios
npm run build:ios:flags
npx cap open ios
```

Full native guides:

- [Running in an Emulator](./docs/Running-in-an-Emulator.md)
- [Deploying Fairwallet to TestFlight for iOS](./docs/Deploying-to-TestFlight-iOS.md)
- [Customizing Splash Screens and Icons](./docs/Customizing-Splash-and-Icons.md)

## Testing

Unit tests:

```bash
npm test
```

End-to-end tests are under [`tests`](./tests) and use WebdriverIO/Appium. See [Testing Guide](./docs/Testing.md) for emulator setup, `.env` values, and report generation.

## Resources

Fairwallet:

- [Fairwallet website](https://fairwallet.et)
- [Hosted wallet connect endpoint](https://connect.fairwallet.et)
- [Hosted wallet boot endpoint](https://boot.fairwallet.et)
- [Dashboard deployment domain](https://dashboard.fairwallet.et)

Repo guides:

- [Running in an Emulator](./docs/Running-in-an-Emulator.md)
- [Testing Guide](./docs/Testing.md)
- [Deploying Fairwallet to TestFlight for iOS](./docs/Deploying-to-TestFlight-iOS.md)
- [Credential Server Email and Google Setup](./docs/Credential-Server-Email-and-Google-Setup.md)
- [Contributing](./CONTRIBUTING.md)
- [Security](./SECURITY.md)
- [Attributions](./ATTRIBUTIONS.md)

Identity and credential standards:

- [W3C Verifiable Credentials Data Model](https://www.w3.org/TR/vc-data-model/)
- [Key Event Receipt Infrastructure](https://keri.one/)
- [KERI resources](https://keri.one/keri-resources/)
- [Authentic Chained Data Container specification](https://trustoverip.github.io/tswg-acdc-specification/)
- [Composable Event Streaming Representation](https://weboftrust.github.io/ietf-cesr/draft-ssmith-cesr.html)
- [Trust over IP Foundation](https://trustoverip.org/)

Implementation resources:

- [KERIA cloud agent](https://github.com/cardano-foundation/keria)
- [Signify TypeScript client](https://github.com/WebOfTrust/signify-ts)
- [Cardano Backer](https://github.com/cardano-foundation/cardano-backer)
- [Cardano CIP-45](https://cips.cardano.org/cip/CIP-0045)
- [Capacitor documentation](https://capacitorjs.com/docs)
- [Ionic React documentation](https://ionicframework.com/docs/react)

Identity verification:

- [Fayda](https://id.gov.et/)
- [MOSIP eSignet](https://esignet.io/)
- [Candour](https://candour.fi/)

## Contributing

Contributions are welcome. Please read [CONTRIBUTING.md](./CONTRIBUTING.md), follow the existing code style, and keep changes scoped to the wallet, service, or dashboard area you are touching.

## License

This project is licensed under Apache-2.0. Earlier upstream versions were available under MPL-2.0 up to commit `49f9811c363bb1c05a5349d4aa3434793a1b3a39`.

See [LICENSE](./LICENSE) and [ATTRIBUTIONS.md](./ATTRIBUTIONS.md).
