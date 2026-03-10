import { TemplateAttribute, TemplateRecord } from "./dashboardStore.types";
import { AccessTokenRole } from "./jwtService";

export interface IssuerRecord {
  id: string;
  code: string;
  name: string;
  status: string;
  createdAt: string;
  updatedAt: string;
}

export interface IssuerSignifyAccountRecord {
  issuerId: string;
  branEncrypted: string;
  aidAlias: string;
  aidPrefix: string | null;
  registryRegk: string | null;
  qviCredentialId: string | null;
  initializedAt: string | null;
  updatedAt: string;
}

export interface IssuerUserRecord {
  id: string;
  issuerId: string;
  email: string;
  passwordHash: string;
  role: AccessTokenRole;
  isActive: boolean;
  createdBy: string | null;
  lastLoginAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface IssuerUserWithIssuerRecord extends IssuerUserRecord {
  issuerCode: string;
}

export interface ManagedUserRecord extends IssuerUserRecord {
  issuerCode: string;
  issuerName: string;
  aidAlias: string | null;
  aidPrefix: string | null;
}

export type AccountChangeRequestField = "issuer_name" | "email";
export type AccountChangeRequestStatus = "pending" | "approved" | "rejected";

export interface AccountChangeRequestRecord {
  id: string;
  userId: string;
  issuerId: string;
  fieldName: AccountChangeRequestField;
  currentValue: string;
  requestedValue: string;
  reason: string | null;
  status: AccountChangeRequestStatus;
  createdAt: string;
  updatedAt: string;
  reviewedAt: string | null;
  reviewedBy: string | null;
  adminNote: string | null;
  userEmail?: string;
  userRole?: AccessTokenRole;
  issuerCode?: string;
  issuerName?: string;
  reviewedByEmail?: string;
}

export interface AuthRefreshTokenRecord {
  id: string;
  userId: string;
  issuerId: string;
  tokenHash: string;
  expiresAt: string;
  revokedAt: string | null;
  replacedBy: string | null;
  createdAt: string;
}

export interface IssuerTemplateRecord extends TemplateRecord {
  issuerId: string;
  autoIssue: boolean;
}

export interface IssuerCredentialRecord {
  id: string;
  issuerId: string;
  templateId: string;
  schemaId: string;
  holderDid: string;
  status: "issued" | "revoked" | "deleted";
  data: Record<string, unknown>;
  issuedAt: string;
  createdAt: string;
  updatedAt: string;
  revokedAt?: string;
  deletedAt?: string;
}

export type PresentationRequestStatus =
  | "requested"
  | "verified"
  | "completed"
  | "rejected"
  | "failed";

export interface PresentationRequestRecord {
  id: string;
  issuerId: string;
  requestExnSaid: string;
  verifierDid: string;
  holderDid: string;
  schemaId: string;
  requestedAttributes: Record<string, string>;
  status: PresentationRequestStatus;
  offerExnSaid: string | null;
  agreeExnSaid: string | null;
  grantExnSaid: string | null;
  presentedCredentialId: string | null;
  presentedIssuerDid: string | null;
  presentedHolderDid: string | null;
  presentedAttributes: Record<string, unknown>;
  verificationChecks: Record<string, boolean>;
  failureReason: string | null;
  requestedAt: string;
  presentedAt: string | null;
  verifiedAt: string | null;
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export type IssuerFaydaVerificationStatus =
  | "verified"
  | "pending_manual_review"
  | "credential_issued";

export interface IssuerFaydaVerificationRecord {
  id: string;
  issuerId: string;
  holderAid: string;
  faydaId: string;
  templateId: string | null;
  credentialId: string | null;
  status: IssuerFaydaVerificationStatus;
  missingFields: string[];
  mappedData: Record<string, unknown>;
  faydaData: Record<string, unknown>;
  verifiedAt: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateIssuerTemplateInput {
  issuerId: string;
  name: string;
  schemaId: string;
  attributes: TemplateAttribute[];
  autoIssue?: boolean;
}
