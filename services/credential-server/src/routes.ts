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
import { config } from "./config";
import { requireDashboardAuth } from "./middleware/auth.middleware";

export const router: Router = express.Router();
router.get(config.path.ping, ping);
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
