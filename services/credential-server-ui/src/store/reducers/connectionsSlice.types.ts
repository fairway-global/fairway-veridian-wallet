import { SchemaDetail } from "./schemasSlice.types";

interface A {
  d: string;
  i: string;
  LEI: string;
  dt: string;
}

interface Sad {
  v: string;
  d: string;
  i: string;
  ri: string;
  s: string;
  a: A;
}

interface Status {
  vn: number[];
  i: string;
  s: string;
  d: string;
  ri: string;
  dt: string;
  et: string;
}

interface Credential {
  rev: null;
  revatc: null;
  pre: string;
  contactId: string;
  status: Status;
  schema: SchemaDetail;
  sad: Sad;
}

enum PresentationRequestStatus {
  Requested = "requested",
  Verified = "verified",
  Completed = "completed",
  Rejected = "rejected",
  Failed = "failed",
}

interface PresentationRequestData {
  id: string;
  requestExnSaid: string;
  holderDid: string;
  schemaId: string;
  requestedAttributes: Record<string, string>;
  requestDate: number;
  status: PresentationRequestStatus;
  presentedCredentialId: string | null;
  presentedIssuerDid: string | null;
  presentedHolderDid: string | null;
  presentedAttributes: Record<string, unknown>;
  verificationChecks: Record<string, boolean>;
  failureReason: string | null;
  verifiedDate: number | null;
  completedDate: number | null;
}

export { PresentationRequestStatus };
export type { Credential, PresentationRequestData };
