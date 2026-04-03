# Deploying Fairwallet to TestFlight for iOS

This guide is written for a teammate who will do the iOS upload from a Mac.

It is specific to this repository:

- App name: `Fairwallet`
- Current bundle ID: `org.cardanofoundation.idw`
- Current version: `1.1.0`
- Current iOS build number: `1`
- iOS deployment target in the Podfile: `18.0`
- Default beta/demo web build command: `npm run build`
- iOS project to open in Xcode: `ios/App/App.xcworkspace`

## Short answer first

Yes, TestFlight distribution is possible for this project.

No, a Windows-only laptop is not enough to do the full iOS TestFlight pipeline locally for this repo. The actual iOS archive/sign/upload flow for this Capacitor app depends on Xcode and macOS.

What you can do from Windows:

- edit the code
- manage the repo
- prepare the `.env`
- push the branch
- review App Store Connect metadata in the browser

What still needs a Mac:

- running Xcode
- code signing
- creating the iOS archive
- uploading the archive to App Store Connect/TestFlight

If you only have Windows, the practical options are:

- hand the branch to a teammate with a Mac
- use a macOS CI/build service later

## Before starting

Your teammate should confirm all of this before doing anything else.

### Apple account and permissions

They need:

- an Apple Developer Program team that can sign iOS apps
- access to the app in App Store Connect
- an App Store Connect role that can work with TestFlight builds

If the app record does not exist yet in App Store Connect, someone with the right role must create it first.

### Mac tools

Install:

- the latest stable Xcode that supports iOS 18 SDKs
- Xcode Command Line Tools
- CocoaPods
- Node.js 20
- npm

Helpful checks:

```bash
node -v
npm -v
xcodebuild -version
pod --version
```

## Important repo-specific notes

### 1. The web app build reads `.env`

Webpack loads environment variables from the repo root `.env` file.

That means your teammate needs the correct `.env` before building for iOS. Do not let them invent values. Share the correct file or a safe copy through your normal secure team channel.

At minimum, they should verify:

- `APP_TEAM_ID` is the correct Apple Team ID for the signing account
- any `REACT_APP_*` backend URLs are the ones you want the demo build to use
- they do not commit `.env`

### 2. This repo already has a checked-in iOS project

This is not an Expo/TestFlight workflow.

The flow is:

1. build the web assets
2. sync them into Capacitor iOS
3. open Xcode
4. sign, archive, and upload

### 3. There is a repo-specific iOS release helper

After syncing iOS, run:

```bash
npm run build:ios:flags
```

This copies custom release `xcconfig` overrides into the generated Pods support files. It is worth doing before archive builds on Mac.

## Step-by-step: first-time TestFlight setup

### Step 1. Clone the repo on the Mac

```bash
git clone <your-repo-url>
cd fairway-veridian-wallet
git checkout <branch-to-ship>
```

### Step 2. Add the correct `.env`

Create the repo root `.env` from your team-approved values.

If they do not already have it, they can start from:

```bash
cp .env.example .env
```

Then replace placeholder values with the real ones.

Important:

- set `APP_TEAM_ID` correctly
- verify the backend URLs are right for the demo
- keep the file local and uncommitted

### Step 3. Install dependencies

```bash
npm install
```

If npm fails because of a local environment mismatch, fix that first before going to Xcode.

### Step 4. Build the web app for the beta/demo environment

Recommended first pass for a demo/TestFlight build:

```bash
npm run build
```

Why this is the safe default:

- it uses the repo's `remote` environment
- the checked-in `remote.yaml` points to hosted Fairwallet services
- it is the simplest non-local build path already defined in `package.json`

If you specifically want a production-like configuration with `rasp.enabled: true`, use:

```bash
npx cross-env ENVIRONMENT=prod webpack --config webpack.prod.cjs
```

Only choose that if you intentionally want the stricter production configuration and your `APP_TEAM_ID` plus signing setup are already correct.

### Step 5. Sync the iOS native project

```bash
npx cap sync ios
```

This step copies the fresh web build into the iOS app and refreshes native dependencies.

### Step 6. Apply the iOS release xcconfig overrides

```bash
npm run build:ios:flags
```

### Step 7. Open the iOS workspace in Xcode

Either run:

```bash
npx cap open ios
```

Or open this file directly:

```text
ios/App/App.xcworkspace
```

Always open the `.xcworkspace`, not only the `.xcodeproj`.

## Step-by-step: configure signing in Xcode

### Step 8. Select the correct target and team

In Xcode:

1. Select the `App` project in the navigator.
2. Select the `App` target.
3. Open `Signing & Capabilities`.
4. Sign in with the Apple account if needed.
5. Turn on automatic signing if it is not already enabled.
6. Choose the correct Team.

### Step 9. Confirm the bundle identifier

The repo is currently configured for:

```text
org.cardanofoundation.idw
```

If the Apple account already owns this app and this bundle ID, leave it as-is.

If the teammate is uploading under a different Apple team and does not own that bundle ID, they must use a new unique bundle ID instead.

If you change the bundle ID for iOS, do not change it in only one place. This repo has related references in:

- `capacitor.config.ts`
- `ios/App/App.xcodeproj/project.pbxproj`
- `ios/App/App/Info.plist`
- `src/security/freerasp.ts`
- `src/ui/App.tsx`
- `src/ui/pages/faydaFlow/faydaModal.tsx`

If you need that bundle-ID rewrite, make it as a separate code change before archiving.

### Step 10. Set version and build number

In Xcode, open the `General` tab for the `App` target and check:

- Version: currently `1.1.0`
- Build: currently `1`

Rules:

- keep the version the same if this is another build for the same beta cycle
- increment the build number every time you upload a new archive for that version

Example:

- first upload: version `1.1.0`, build `1`
- second upload: version `1.1.0`, build `2`
- third upload: version `1.1.0`, build `3`

If you forget to increment the build number, App Store Connect will reject the upload.

### Step 11. Choose a real archive destination

At the top of Xcode, choose a generic device target such as:

```text
Any iOS Device (arm64)
```

Do not archive while a simulator destination is selected.

## Step-by-step: validate locally before upload

### Step 12. Do one clean build in Xcode

Recommended:

1. `Product` -> `Clean Build Folder`
2. `Product` -> `Build`

If the build fails, fix that before attempting an archive.

### Step 13. Optional but strongly recommended: run on one physical iPhone

Before pushing to TestFlight, it is smart to:

1. plug in a real iPhone
2. select it as the run destination
3. run the app once from Xcode
4. confirm launch, onboarding, login/connect flow, and at least one key demo path

This catches signing/device/runtime problems earlier than TestFlight does.

## Step-by-step: archive and upload

### Step 14. Archive the app

In Xcode:

1. `Product` -> `Archive`
2. wait for Xcode Organizer to open
3. select the new archive

### Step 15. Distribute to App Store Connect

In Organizer:

1. click `Distribute App`
2. choose `App Store Connect`
3. choose `Upload`
4. continue through the signing/options screens
5. let Xcode validate
6. upload

If validation fails, fix the reported issue before retrying.

## Step-by-step: finish the TestFlight setup in App Store Connect

### Step 16. Wait for Apple processing

After upload:

- the build will not appear instantly
- Apple processes it first
- Apple sends a processing email when it is done

If it still is not visible, wait longer before assuming something is broken.

### Step 17. Resolve compliance prompts

This app uses encryption-related components, so expect App Store Connect export compliance questions.

Do not skip them.

If App Store Connect shows a compliance warning or a `Missing Compliance` build status, answer the export compliance questions before expecting normal TestFlight distribution.

### Step 18. Internal TestFlight testing

Internal testing is the fastest way to start.

In App Store Connect:

1. open the app
2. open the `TestFlight` tab
3. create or choose an internal tester group
4. add the processed build to that group
5. add teammates as internal testers

Use this first if you only want your own team to install the app.

### Step 19. External TestFlight testing

If you want to send the app to people outside the App Store Connect team, do this after internal testing works.

In App Store Connect:

1. open the app
2. open `TestFlight`
3. open `Test Information`
4. fill in the beta app description, feedback email, and any other required fields
5. create or choose an external group
6. add the processed build to the external group
7. submit the build for TestFlight App Review
8. wait for approval
9. invite testers or enable a public link

External testing is slower because Apple reviews the beta build before those testers can install it.

## Recommended handoff checklist for your teammate

Send this checklist with the branch name:

1. Pull the correct branch on Mac.
2. Add the correct `.env`.
3. Confirm `APP_TEAM_ID`.
4. Run `npm install`.
5. Run `npm run build`.
6. Run `npx cap sync ios`.
7. Run `npm run build:ios:flags`.
8. Open `ios/App/App.xcworkspace`.
9. Set the signing team in Xcode.
10. Confirm bundle ID.
11. Increment the iOS build number.
12. Build once locally.
13. Archive.
14. Upload to App Store Connect.
15. Wait for processing.
16. Resolve export compliance if prompted.
17. Add the build to internal testers first.
18. Only after that, move to external testers if needed.

## Common failure points

### Bundle ID already taken

Symptom:

- Xcode signing fails
- App Store Connect upload associates with the wrong app

Fix:

- use the Apple team that owns `org.cardanofoundation.idw`, or
- create a new bundle ID and update all related code references before archiving

### Build number rejected

Symptom:

- upload fails because the build number already exists

Fix:

- increment the iOS build number in Xcode and archive again

### Build never appears in TestFlight immediately

Symptom:

- upload succeeded but nothing is visible yet

Fix:

- wait for Apple processing
- check the email from App Store Connect
- refresh after processing completes

### Missing compliance

Symptom:

- build shows a compliance warning/status

Fix:

- complete the encryption/export compliance answers in App Store Connect

### Release archive fails after syncing pods

Symptom:

- Xcode archive/build fails in Pod-related release settings

Fix:

1. rerun `npm run build:ios:flags`
2. clean the build folder
3. build again

### freeRASP or prod security configuration behaves unexpectedly

Symptom:

- a production-style build behaves differently than the normal demo build

Fix:

- verify `APP_TEAM_ID`
- verify whether you intended `remote` or `prod`
- for the first demo build, prefer `npm run build` unless you explicitly need the stricter prod path

## Windows answer in plain language

### Can this be done from Windows only?

Not fully for this repo.

Because this project uses a native iOS Capacitor project, the final iOS distribution steps need Xcode on macOS.

### Can Windows still help?

Yes.

You can do all of this from Windows:

- write code
- prepare the branch
- prepare or review `.env`
- check version numbers in code
- hand off precise instructions
- manage App Store Connect metadata in a browser

### Best practical workflow if you mainly use Windows

1. Do your code changes on Windows.
2. Push the branch.
3. Send this guide plus the branch name to the teammate with the Mac.
4. Let them do the build, signing, archive, and upload.
5. Once the TestFlight build is live, both of you can help with tester management and feedback.

## Official references

- Apple: Add a new app  
  https://developer.apple.com/help/app-store-connect/create-an-app-record/add-a-new-app/
- Apple: Upload builds  
  https://developer.apple.com/help/app-store-connect/manage-builds/upload-builds/
- Apple: Add internal testers  
  https://developer.apple.com/help/app-store-connect/test-a-beta-version/add-internal-testers
- Apple: Provide test information  
  https://developer.apple.com/help/app-store-connect/test-a-beta-version/provide-test-information/
- Apple: Overview of export compliance  
  https://developer.apple.com/help/app-store-connect/manage-app-information/overview-of-export-compliance
- Apple: Preparing your app for distribution  
  https://developer.apple.com/documentation/xcode/preparing-your-app-for-distribution/

## Repo references

- `package.json`
- `capacitor.config.ts`
- `ios/App/Podfile`
- `ios/App/App.xcodeproj/project.pbxproj`
- `ios/App/App/Info.plist`
- `src/security/freerasp.ts`
- `docs/Running-in-an-Emulator.md`
