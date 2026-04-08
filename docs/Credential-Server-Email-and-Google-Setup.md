# Credential Server UI: Email and Google Sign-In Setup

This guide covers two things for the dashboard stack:

1. Connecting `notifications@fairwallet.et` so the backend can send transactional emails
2. Enabling Google Sign-In for the `credential-server-ui` login page

This update is isolated to dashboard auth and email flows. It does **not** change KERIA or Signify runtime provisioning.

## What this setup enables

After configuration, the dashboard can:

- Send password reset emails
- Send account-created emails when an admin creates a dashboard user
- Accept Google Sign-In for existing dashboard users whose email already exists in the Fairway dashboard database

## 1. Mail setup for `notifications@fairwallet.et`

The backend now expects SMTP settings. You need the SMTP details for the mailbox that owns `notifications@fairwallet.et`.

### Values you need from your mail provider

Collect these first:

- SMTP host
- SMTP port
- whether the connection is `secure` (`true` for implicit TLS, usually port `465`)
- full SMTP username
- SMTP password or app password
- sender name you want displayed in emails

### Backend environment variables

Set these for `services/credential-server`:

```env
SMTP_HOST=smtp.your-provider.com
SMTP_PORT=465
SMTP_SECURE=true
SMTP_USER=notifications@fairwallet.et
SMTP_PASSWORD=your-app-password-or-smtp-password
MAIL_FROM_NAME=Fairway
MAIL_FROM_ADDRESS=notifications@fairwallet.et
DASHBOARD_UI_URL=https://your-dashboard-domain
PASSWORD_RESET_TTL_SECONDS=3600
GOOGLE_CLIENT_ID=your-google-oauth-client-id
```

### Common provider examples

If `notifications@fairwallet.et` is on Google Workspace:

```env
SMTP_HOST=smtp.gmail.com
SMTP_PORT=465
SMTP_SECURE=true
SMTP_USER=notifications@fairwallet.et
SMTP_PASSWORD=<Google App Password>
```

Notes:

- Turn on 2-Step Verification for the mailbox
- Generate an App Password
- Use the App Password, not the normal mailbox password

If it is on Microsoft 365:

```env
SMTP_HOST=smtp.office365.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=notifications@fairwallet.et
SMTP_PASSWORD=<mailbox password or app password>
```

If it is on cPanel or standard hosting mail:

```env
SMTP_HOST=mail.fairwallet.et
SMTP_PORT=465
SMTP_SECURE=true
SMTP_USER=notifications@fairwallet.et
SMTP_PASSWORD=<mailbox password>
```

### How to confirm the mailbox details

If you are not sure which provider hosts `notifications@fairwallet.et`, check:

- your DNS MX records for `fairwallet.et`
- the mailbox admin panel
- whoever manages the domain email service

### Install the new server dependency

From the repo root:

```powershell
cd services/credential-server
npm install
```

If you only want to add the missing mail dependency explicitly:

```powershell
cd services/credential-server
npm install nodemailer
```

### Start the backend

```powershell
cd services/credential-server
npm run dev
```

### Test mail sending

Use one of these:

1. Open the dashboard login page and click `Forgot password?`
2. Enter the email of an existing dashboard user
3. Confirm the email arrives from `notifications@fairwallet.et`

You can also test account-created emails:

1. Sign in as admin
2. Create a new issuer or verifier user from Admin Users
3. Confirm the welcome email is delivered

## 2. Google Sign-In setup

The dashboard already supports Google Sign-In, but it only signs in users whose email already exists in the Fairway dashboard database.

### Create a Google OAuth client

1. Open Google Cloud Console
2. Select or create the project for Fairway dashboard auth
3. Go to `APIs & Services` -> `OAuth consent screen`
4. Configure the consent screen
5. Go to `Credentials`
6. Create an `OAuth client ID`
7. Choose `Web application`

### Add the allowed origins

Add the dashboard origins that will load the Google sign-in button.

Examples:

- `http://localhost:5173`
- `https://dashboard.fairwallet.et`

For Google Identity Services, the most important value is the JavaScript origin used by the UI.

### Copy the client ID into both backend and UI config

Set the same client ID in both places.

Backend:

```env
GOOGLE_CLIENT_ID=your-google-oauth-client-id
```

UI local dev with Vite:

```env
VITE_GOOGLE_CLIENT_ID=your-google-oauth-client-id
VITE_SERVER_URL=http://localhost:3001
```

UI runtime config if you deploy with `envfile.js`:

```env
GOOGLE_CLIENT_ID=your-google-oauth-client-id
SERVER_URL=https://your-api-domain
```

The UI already reads `GOOGLE_CLIENT_ID` from:

- `services/credential-server-ui/public/envfile.js`
- or `VITE_GOOGLE_CLIENT_ID`

### Start the UI

```powershell
cd services/credential-server-ui
npm install
npm run dev
```

### Test Google Sign-In

1. Make sure the Google account email matches an existing dashboard user email
2. Open the login page
3. Click `Sign in with Google`
4. Complete the Google flow
5. Confirm you land in the dashboard with the correct role

### Important current behavior

Right now Google Sign-In:

- works for existing dashboard users
- does not yet self-provision public verifier accounts
- does not yet approve issuer applications automatically

Those flows can be added next without changing the KERIA connection logic.

## 3. Files affected by this setup

Backend auth and mail:

- `services/credential-server/src/config.ts`
- `services/credential-server/src/apis/auth.api.ts`
- `services/credential-server/src/services/authService.ts`
- `services/credential-server/src/services/mailService.ts`
- `services/credential-server/src/services/mailTemplateService.ts`
- `services/credential-server/src/routes.ts`

UI auth:

- `services/credential-server-ui/src/pages/Login/Login.tsx`
- `services/credential-server-ui/src/pages/Login/ForgotPassword.tsx`
- `services/credential-server-ui/src/pages/Login/ResetPassword.tsx`
- `services/credential-server-ui/src/services/auth.ts`
- `services/credential-server-ui/src/config.ts`

## 4. Safe rollout order

Use this order to keep risk low:

1. Configure SMTP and Google client ID in a local or staging environment
2. Verify `Forgot password` email delivery
3. Verify admin-created account emails
4. Verify Google Sign-In for an existing dashboard user
5. Only after that, move on to public verifier signup and issuer application flows
