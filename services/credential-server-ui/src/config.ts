// Extend the Window interface to include runtime configuration
interface CustomWindow extends Window {
  __RUNTIME_CONFIG__?: {
    SERVER_URL?: string;
  };
}

declare let window: CustomWindow;

// Get the server URL from runtime configuration (envfile.js) or Vite's .env
const serverUrl =
  (typeof window !== "undefined" && window.__RUNTIME_CONFIG__?.SERVER_URL) ||
  import.meta.env.VITE_SERVER_URL || // Vite's .env system
  "http://localhost:3001"; // Default fallback

// Define the config object
const config = {
  endpoint: serverUrl,
  path: {
    ping: "/ping",
    getConnectionByDid: "/getConnectionByDid",
    invitation: "/invitation",
    credential: "/credential",
    invitationWithCredential: "/offerCredentialWithConnection",
    invitationWithCredentialConnectionless:
      "/offerCredentialWithConnectionLess",
    credentials: {
      summit: "/credentials/schemas/summit/v1",
    },
    keriOobi: "/api/v2/keriOobi",
    issueAcdcCredential: "/api/v2/issueAcdcCredential",
    schemaById: "/api/v2/schemas/:id",
    contacts: "/api/v2/contacts",
    deleteContact: "/api/v2/deleteContact",
    contactCredentials: "/api/v2/contactCredentials",
    resolveOobi: "/api/v2/resolveOobi",
    requestDisclosure: "/api/v2/requestDisclosure",
    presentationRequestsV2: "/api/v2/presentationRequests",
    revokeCredential: "/api/v2/revokeCredential",
    schemas: "/api/v2/schemas",
    templates: "/api/v2/templates",
    templateById: "/api/v2/templates/:id",
    credentialsApi: "/api/v2/credentials",
    credentialById: "/api/v2/credentials/:id",
    issueCredentialApi: "/api/v2/credentials/issue",
    revokeCredentialApi: "/api/v2/credentials/:id/revoke",
    deleteCredentialApi: "/api/v2/credentials/:id",
    keriOobiV2: "/api/v2/keriOobi",
    authLoginV2: "/api/v2/auth/login",
    authRefreshV2: "/api/v2/auth/refresh",
    authLogoutV2: "/api/v2/auth/logout",
    authMeV2: "/api/v2/auth/me",
    adminUsersV2: "/api/v2/admin/users",
    adminUserByIdV2: "/api/v2/admin/users/:id",
    adminRequestsV2: "/api/v2/admin/requests",
    adminRequestByIdV2: "/api/v2/admin/requests/:id",
    accountProfileV2: "/api/v2/account/profile",
    accountRequestsV2: "/api/v2/account/requests",
    notificationsV2: "/api/v2/notifications",
    eventsStreamV2: "/api/v2/events/stream",
  },
};

export { config };
