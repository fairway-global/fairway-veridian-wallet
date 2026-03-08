import express, { Router } from "express";
import { contactList, deleteContact } from "./apis/contact.api";
import {
  deleteCredentialByIdApi,
  getCredentialByIdApi,
  issueCredentialApi,
  listCredentialsApi,
  revokeCredentialByIdApi,
} from "./apis/dashboardCredential.api";
import {
  contactCredentials,
  deleteRevokedCredentials,
  issueAcdcCredential,
  requestDisclosure,
  revokeCredential,
} from "./apis/credential.api";
import {
  getFaydaDataStatus,
  saveFaydaData,
  deleteFaydaData,
} from "./apis/fayda.api";
import { keriOobiApi } from "./apis/invitation.api";
import { resolveOobi } from "./apis/oobi.api";
import { ping } from "./apis/ping.api";
import { schemaApi } from "./apis/schema.api";
import {
  createTemplateApi,
  deleteTemplateApi,
  getTemplateByIdApi,
  listTemplatesApi,
  updateTemplateApi,
} from "./apis/template.api";
import {
  createTemplateApiV2,
  deleteTemplateApiV2,
  getTemplateByIdApiV2,
  listTemplatesApiV2,
  updateTemplateApiV2,
} from "./apis/templateV2.api";
import {
  deleteCredentialByIdApiV2,
  getCredentialByIdApiV2,
  issueCredentialApiV2,
  listCredentialsApiV2,
  revokeCredentialByIdApiV2,
} from "./apis/dashboardCredentialV2.api";
import { loginApi, logoutApi, meApi, refreshApi } from "./apis/auth.api";
import {
  adminCreateUserApi,
  adminListRequestsApi,
  adminListUsersApi,
  adminPatchUserApi,
  adminReviewRequestApi,
} from "./apis/admin.api";
import {
  accountCreateRequestApi,
  accountListRequestsApi,
  accountProfileApi,
} from "./apis/account.api";
import { listNotificationsApiV2 } from "./apis/notificationV2.api";
import { eventStreamApiV2 } from "./apis/realtimeEvent.api";
import { config } from "./config";
import { requireDashboardAuth } from "./middleware/auth.middleware";
import { requireAccessToken } from "./middleware/accessToken.middleware";
import { requireAccessTokenForStream } from "./middleware/accessTokenStream.middleware";
import { requireIssuerContext } from "./middleware/issuerContext.middleware";
import { requireRole } from "./middleware/role.middleware";
import { requireGatewayToken } from "./middleware/gatewayToken.middleware";
import { legacyDeprecationNotice } from "./middleware/legacyDeprecation.middleware";

export const router: Router = express.Router();
router.get(config.path.ping, ping);

router.post(config.path.authLoginV2, loginApi);
router.post(config.path.authRefreshV2, refreshApi);
router.post(config.path.authLogoutV2, logoutApi);
router.get(config.path.authMeV2, requireAccessToken, meApi);

const issuerReadAccess = [
  requireAccessToken,
  requireIssuerContext,
  requireRole(["issuer"]),
] as const;
const issuerWriteAccess = [
  requireAccessToken,
  requireIssuerContext,
  requireRole(["issuer"]),
] as const;
const verifierAccess = [
  requireAccessToken,
  requireIssuerContext,
  requireRole(["verifier"]),
] as const;
const sharedReadAccess = [
  requireAccessToken,
  requireIssuerContext,
  requireRole(["issuer", "verifier"]),
] as const;
const sharedWriteAccess = [
  requireAccessToken,
  requireIssuerContext,
  requireRole(["issuer", "verifier"]),
] as const;
const accountAccess = [
  requireAccessToken,
  requireRole(["issuer", "verifier"]),
] as const;
const adminAccess = [
  requireAccessToken,
  requireRole(["admin"]),
] as const;

router.get(config.path.adminUsersV2, ...adminAccess, adminListUsersApi);
router.post(config.path.adminUsersV2, ...adminAccess, adminCreateUserApi);
router.patch(config.path.adminUserByIdV2, ...adminAccess, adminPatchUserApi);
router.get(config.path.adminRequestsV2, ...adminAccess, adminListRequestsApi);
router.patch(
  config.path.adminRequestByIdV2,
  ...adminAccess,
  adminReviewRequestApi
);
router.get(config.path.accountProfileV2, ...accountAccess, accountProfileApi);
router.get(config.path.accountRequestsV2, ...accountAccess, accountListRequestsApi);
router.post(config.path.accountRequestsV2, ...accountAccess, accountCreateRequestApi);

router.get(config.path.templatesV2, ...issuerReadAccess, listTemplatesApiV2);
router.get(config.path.templateByIdV2, ...issuerReadAccess, getTemplateByIdApiV2);
router.post(config.path.templatesV2, ...issuerWriteAccess, createTemplateApiV2);
router.put(config.path.templateByIdV2, ...issuerWriteAccess, updateTemplateApiV2);
router.delete(
  config.path.templateByIdV2,
  ...issuerWriteAccess,
  deleteTemplateApiV2
);

router.get(config.path.credentialsApiV2, ...issuerReadAccess, listCredentialsApiV2);
router.get(
  config.path.credentialByIdV2,
  ...issuerReadAccess,
  getCredentialByIdApiV2
);
router.post(
  config.path.issueCredentialApiV2,
  ...issuerWriteAccess,
  issueCredentialApiV2
);
router.put(
  config.path.revokeCredentialApiV2,
  ...issuerWriteAccess,
  revokeCredentialByIdApiV2
);
router.delete(
  config.path.deleteCredentialApiV2,
  ...issuerWriteAccess,
  deleteCredentialByIdApiV2
);

router.get(config.path.keriOobiV2, ...sharedReadAccess, keriOobiApi);
router.post(config.path.resolveOobiV2, ...sharedWriteAccess, resolveOobi);
router.post(
  config.path.issueAcdcCredentialV2,
  ...issuerWriteAccess,
  issueAcdcCredential
);
router.get(config.path.contactsV2, ...sharedReadAccess, contactList);
router.delete(config.path.deleteContactV2, ...sharedWriteAccess, deleteContact);
router.get(
  config.path.contactCredentialsV2,
  ...sharedReadAccess,
  contactCredentials
);
router.get(config.path.schemasV2, ...sharedReadAccess, schemaApi);
router.post(
  config.path.requestDisclosureV2,
  ...verifierAccess,
  requestDisclosure
);
router.post(
  config.path.revokeCredentialV2,
  ...issuerWriteAccess,
  revokeCredential
);
router.delete(
  config.path.deleteRevokedCredentialsV2,
  ...issuerWriteAccess,
  deleteRevokedCredentials
);
router.get(
  config.path.notificationsV2,
  ...sharedReadAccess,
  listNotificationsApiV2
);
router.get(
  config.path.eventsStreamV2,
  requireAccessTokenForStream,
  requireIssuerContext,
  requireRole(["issuer", "verifier"]),
  eventStreamApiV2
);

router.get(
  config.path.internalFaydaStatus,
  requireGatewayToken("fayda:status"),
  requireIssuerContext,
  getFaydaDataStatus
);
router.post(
  config.path.internalFaydaIssue,
  requireGatewayToken("fayda:issue"),
  requireIssuerContext,
  saveFaydaData
);
router.delete(
  config.path.internalFaydaDelete,
  requireGatewayToken("fayda:delete"),
  requireIssuerContext,
  deleteFaydaData
);

if (config.allowLegacyUnauthRoutes) {
  router.use(legacyDeprecationNotice);
  router.get(config.path.keriOobi, keriOobiApi);
  router.get(config.path.saveFayda, getFaydaDataStatus);
  router.get(config.path.saveFaydaData, getFaydaDataStatus);
  router.post(config.path.issueAcdcCredential, issueAcdcCredential);
  router.post(config.path.saveFayda, saveFaydaData);
  router.post(config.path.saveFaydaData, saveFaydaData);
  router.delete(config.path.saveData, deleteFaydaData);
  router.post(config.path.resolveOobi, resolveOobi);
  router.get(config.path.contacts, contactList);
  router.get(config.path.contactCredentials, contactCredentials);
  router.get(config.path.schemas, schemaApi);
  router.post(config.path.requestDisclosure, requestDisclosure);
  router.post(config.path.revokeCredential, revokeCredential);
  router.delete(config.path.deleteRevokedCredentials, deleteRevokedCredentials);
  router.delete(config.path.deleteContact, deleteContact);
  router.get(config.path.templates, requireDashboardAuth, listTemplatesApi);
  router.get(config.path.templateById, requireDashboardAuth, getTemplateByIdApi);
  router.post(config.path.templates, requireDashboardAuth, createTemplateApi);
  router.put(config.path.templateById, requireDashboardAuth, updateTemplateApi);
  router.delete(config.path.templateById, requireDashboardAuth, deleteTemplateApi);
  router.get(config.path.credentialsApi, requireDashboardAuth, listCredentialsApi);
  router.get(
    config.path.credentialById,
    requireDashboardAuth,
    getCredentialByIdApi
  );
  router.post(
    config.path.issueCredentialApi,
    requireDashboardAuth,
    issueCredentialApi
  );
  router.put(
    config.path.revokeCredentialApi,
    requireDashboardAuth,
    revokeCredentialByIdApi
  );
  router.delete(
    config.path.deleteCredentialApi,
    requireDashboardAuth,
    deleteCredentialByIdApi
  );
}
