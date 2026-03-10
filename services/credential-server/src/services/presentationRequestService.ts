import { SignifyClient } from "signify-ts";
import { canonicalSchemaId } from "../consts";
import type { IssuerRuntime } from "./issuerSignifyService";
import {
  createPresentationRequestForIssuer,
  getPresentationRequestByAgreeExnSaidForIssuer,
  getPresentationRequestByRequestExnSaidForIssuer,
  listPresentationRequestsByIssuer,
  updatePresentationRequestForIssuer,
} from "./tenantStore";
import type {
  PresentationRequestRecord,
  PresentationRequestStatus,
} from "./tenantStore.types";

type RealtimeNotification = {
  title: string;
  message: string;
  level: "info" | "success" | "warning" | "error";
};

type RealtimeEvent = {
  type: string;
  payload?: Record<string, unknown>;
  notification?: RealtimeNotification;
};

type SignifyNotification = {
  i?: unknown;
  dt?: unknown;
  a?: {
    r?: unknown;
    d?: unknown;
  };
};

type ProcessedNotification = {
  handled: boolean;
  deleteNotification: boolean;
  events: RealtimeEvent[];
};

type ResolvedIpexExchange = {
  ipexExchange: any;
  route: string;
};

const IPEX_OFFER_ROUTE = "/ipex/offer";
const IPEX_GRANT_ROUTE = "/ipex/grant";
const MULTISIG_EXN_ROUTE = "/multisig/exn";
const STATE_ISSUED = "iss";
const STATE_REVOKED = "rev";

function normalizeString(value: unknown): string {
  return String(value ?? "").trim();
}

async function resolveIpexExchange(
  client: SignifyClient,
  notification: SignifyNotification
): Promise<ResolvedIpexExchange | null> {
  const said = normalizeString(notification.a?.d);
  if (!said) {
    return null;
  }

  const exchange = await client.exchanges().get(said);
  const route = normalizeString(exchange?.exn?.r);

  if (route === IPEX_OFFER_ROUTE || route === IPEX_GRANT_ROUTE) {
    return {
      ipexExchange: exchange.exn,
      route,
    };
  }

  if (route !== MULTISIG_EXN_ROUTE) {
    return null;
  }

  const embedded = exchange?.exn?.e?.exn;
  const embeddedRoute = normalizeString(embedded?.r);
  if (embeddedRoute !== IPEX_OFFER_ROUTE && embeddedRoute !== IPEX_GRANT_ROUTE) {
    return null;
  }

  return {
    ipexExchange: embedded,
    route: embeddedRoute,
  };
}

async function createAgree(
  runtime: IssuerRuntime,
  recipient: string,
  offerSaid: string
): Promise<string> {
  const [agree, sigs] = await runtime.client.ipex().agree({
    senderName: runtime.aidAlias,
    recipient,
    offerSaid,
  });

  await runtime.client
    .ipex()
    .submitAgree(runtime.aidAlias, agree, sigs, [recipient]);

  return normalizeString(agree?.ked?.d);
}

async function readTelState(
  client: SignifyClient,
  registryId: string,
  credentialId: string
): Promise<string | null> {
  const normalizedRegistryId = normalizeString(registryId);
  const normalizedCredentialId = normalizeString(credentialId);
  if (!normalizedRegistryId || !normalizedCredentialId) {
    return null;
  }

  try {
    const state = await client.credentials().state(
      normalizedRegistryId,
      normalizedCredentialId
    );
    return normalizeString((state as { et?: unknown })?.et);
  } catch {
    return null;
  }
}

function buildFailureReason(
  checks: Record<string, boolean>,
  telState: string | null
): string | null {
  const reasons: string[] = [];

  if (!checks.offerFromRequestedHolder) {
    reasons.push("Credential offer was not sent by the requested connection.");
  }
  if (!checks.offerAddressedToVerifier) {
    reasons.push("Credential offer was not addressed to the active verifier.");
  }
  if (!checks.schemaMatches) {
    reasons.push("Presented credential schema did not match the request.");
  }
  if (!checks.holderMatches) {
    reasons.push("Presented credential holder did not match the requested connection.");
  }
  if (!checks.attributesMatch) {
    reasons.push("Presented credential attributes did not satisfy the requested values.");
  }
  if (!checks.telStateIssued && telState) {
    reasons.push(
      `Credential registry state was ${telState} instead of ${STATE_ISSUED}.`
    );
  }
  if (!checks.notRevoked) {
    reasons.push("Presented credential is revoked.");
  }

  return reasons.length ? reasons.join(" ") : null;
}

async function verifyOfferAgainstRequest(
  runtime: IssuerRuntime,
  request: PresentationRequestRecord,
  ipexExchange: any
): Promise<{
  checks: Record<string, boolean>;
  failureReason: string | null;
  presentedAttributes: Record<string, unknown>;
  presentedCredentialId: string;
  presentedIssuerDid: string;
  presentedHolderDid: string;
}> {
  const presented = ipexExchange?.e?.acdc || {};
  const presentedAttributes = presented?.a || {};
  const presentedCredentialId = normalizeString(presented?.d);
  const presentedIssuerDid = normalizeString(presented?.i);
  const presentedHolderDid = normalizeString(presentedAttributes?.i);
  const schemaId = canonicalSchemaId(normalizeString(presented?.s));
  const telState = await readTelState(
    runtime.client,
    normalizeString(presented?.ri),
    presentedCredentialId
  );

  const requestedAttributes = request.requestedAttributes || {};
  const attributesMatch = Object.entries(requestedAttributes).every(
    ([key, value]) => {
      return normalizeString((presentedAttributes as Record<string, unknown>)[key]) ===
        normalizeString(value);
    }
  );

  const checks = {
    offerFromRequestedHolder:
      normalizeString(ipexExchange?.i) === request.holderDid,
    offerAddressedToVerifier:
      normalizeString(ipexExchange?.rp) === request.verifierDid,
    schemaMatches: schemaId === request.schemaId,
    holderMatches: presentedHolderDid === request.holderDid,
    attributesMatch,
    registryStateVerified: telState !== null,
    telStateIssued: telState === null || telState === STATE_ISSUED,
    notRevoked: telState !== STATE_REVOKED,
  };

  return {
    checks,
    failureReason: buildFailureReason(checks, telState),
    presentedAttributes,
    presentedCredentialId,
    presentedIssuerDid,
    presentedHolderDid,
  };
}

async function processOfferNotification(
  runtime: IssuerRuntime,
  ipexExchange: any
): Promise<ProcessedNotification | null> {
  const applySaid = normalizeString(ipexExchange?.p);
  if (!applySaid) {
    return null;
  }

  const request = await getPresentationRequestByRequestExnSaidForIssuer(
    runtime.issuerId,
    applySaid
  );
  if (!request) {
    return null;
  }

  if (request.status !== "requested") {
    return {
      handled: true,
      deleteNotification: true,
      events: [],
    };
  }

  const verification = await verifyOfferAgainstRequest(
    runtime,
    request,
    ipexExchange
  );

  const now = new Date().toISOString();
  const baseUpdate = {
    issuerId: runtime.issuerId,
    requestId: request.id,
    offerExnSaid: normalizeString(ipexExchange?.d) || null,
    presentedCredentialId: verification.presentedCredentialId || null,
    presentedIssuerDid: verification.presentedIssuerDid || null,
    presentedHolderDid: verification.presentedHolderDid || null,
    presentedAttributes: verification.presentedAttributes,
    verificationChecks: verification.checks,
    presentedAt: now,
  };

  const { registryStateVerified, ...blockingChecks } = verification.checks;
  void registryStateVerified;
  const verified = Object.values(blockingChecks).every(Boolean);
  if (!verified) {
    await updatePresentationRequestForIssuer({
      ...baseUpdate,
      status: "rejected",
      failureReason:
        verification.failureReason || "Presented credential did not satisfy verifier checks.",
    });

    return {
      handled: true,
      deleteNotification: true,
      events: [
        {
          type: "presentation_requests.refresh",
          payload: {
            requestId: request.id,
            status: "rejected",
          },
        },
        {
          type: "notifications.new",
          payload: {
            action: "presentation_rejected",
            requestId: request.id,
            holderDid: request.holderDid,
          },
          notification: {
            title: "Presentation rejected",
            message:
              verification.failureReason ||
              "A presented credential did not satisfy the verifier checks.",
            level: "warning",
          },
        },
      ],
    };
  }

  try {
    const agreeExnSaid = await createAgree(
      runtime,
      normalizeString(ipexExchange?.i),
      normalizeString(ipexExchange?.d)
    );

    await updatePresentationRequestForIssuer({
      ...baseUpdate,
      status: "verified",
      agreeExnSaid,
      verifiedAt: now,
      failureReason: null,
    });

    return {
      handled: true,
      deleteNotification: true,
      events: [
        {
          type: "presentation_requests.refresh",
          payload: {
            requestId: request.id,
            status: "verified",
          },
        },
        {
          type: "notifications.new",
          payload: {
            action: "presentation_verified",
            requestId: request.id,
            holderDid: request.holderDid,
          },
          notification: {
            title: "Presentation verified",
            message: `Credential ${verification.presentedCredentialId} matched the presentation request.`,
            level: "success",
          },
        },
      ],
    };
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Unable to submit agree for the presented credential.";

    await updatePresentationRequestForIssuer({
      ...baseUpdate,
      status: "failed",
      failureReason: message,
    });

    return {
      handled: true,
      deleteNotification: true,
      events: [
        {
          type: "presentation_requests.refresh",
          payload: {
            requestId: request.id,
            status: "failed",
          },
        },
        {
          type: "notifications.new",
          payload: {
            action: "presentation_failed",
            requestId: request.id,
            holderDid: request.holderDid,
          },
          notification: {
            title: "Presentation verification failed",
            message,
            level: "error",
          },
        },
      ],
    };
  }
}

async function processGrantNotification(
  runtime: IssuerRuntime,
  ipexExchange: any
): Promise<ProcessedNotification | null> {
  const agreeExnSaid = normalizeString(ipexExchange?.p);
  if (!agreeExnSaid) {
    return null;
  }

  const request = await getPresentationRequestByAgreeExnSaidForIssuer(
    runtime.issuerId,
    agreeExnSaid
  );
  if (!request) {
    return null;
  }

  if (request.status === "completed") {
    return {
      handled: true,
      deleteNotification: true,
      events: [],
    };
  }

  const grantCredentialId = normalizeString(ipexExchange?.e?.acdc?.d);
  const telState = await readTelState(
    runtime.client,
    normalizeString(ipexExchange?.e?.acdc?.ri),
    grantCredentialId
  );
  const now = new Date().toISOString();
  const mismatch =
    request.presentedCredentialId &&
    grantCredentialId &&
    request.presentedCredentialId !== grantCredentialId;
  const invalidGrantState =
    telState !== null &&
    telState !== STATE_ISSUED &&
    telState !== STATE_REVOKED;
  const revokedGrant = telState === STATE_REVOKED;

  if (mismatch || invalidGrantState || revokedGrant) {
    const failureReason = mismatch
      ? "Grant credential did not match the verified presentation offer."
      : revokedGrant
        ? "Presented credential is revoked."
        : `Credential registry state was ${telState} instead of ${STATE_ISSUED}.`;
    await updatePresentationRequestForIssuer({
      issuerId: runtime.issuerId,
      requestId: request.id,
      grantExnSaid: normalizeString(ipexExchange?.d) || null,
      status: "failed",
      failureReason,
    });

    return {
      handled: true,
      deleteNotification: true,
      events: [
        {
          type: "presentation_requests.refresh",
          payload: {
            requestId: request.id,
            status: "failed",
          },
        },
        {
          type: "notifications.new",
          payload: {
            action: "presentation_failed",
            requestId: request.id,
          },
          notification: {
            title: "Presentation completion failed",
            message: failureReason,
            level: "error",
          },
        },
      ],
    };
  }

  const nextStatus: PresentationRequestStatus =
    request.status === "rejected" || request.status === "failed"
      ? request.status
      : "completed";

  await updatePresentationRequestForIssuer({
    issuerId: runtime.issuerId,
    requestId: request.id,
    grantExnSaid: normalizeString(ipexExchange?.d) || null,
    presentedCredentialId: grantCredentialId || request.presentedCredentialId,
    status: nextStatus,
    completedAt: nextStatus === "completed" ? now : undefined,
  });

  const events: RealtimeEvent[] = [
    {
      type: "presentation_requests.refresh",
      payload: {
        requestId: request.id,
        status: nextStatus,
      },
    },
  ];

  if (nextStatus === "completed") {
    events.push({
      type: "notifications.new",
      payload: {
        action: "presentation_completed",
        requestId: request.id,
        holderDid: request.holderDid,
      },
      notification: {
        title: "Presentation completed",
        message: `Credential ${grantCredentialId || request.presentedCredentialId} completed the presentation exchange.`,
        level: "success",
      },
    });
  }

  return {
    handled: true,
    deleteNotification: true,
    events,
  };
}

export async function processPresentationRequestNotification(
  runtime: IssuerRuntime,
  notification: SignifyNotification
): Promise<ProcessedNotification | null> {
  const resolved = await resolveIpexExchange(runtime.client, notification);
  if (!resolved) {
    return null;
  }

  if (resolved.route === IPEX_OFFER_ROUTE) {
    return processOfferNotification(runtime, resolved.ipexExchange);
  }

  if (resolved.route === IPEX_GRANT_ROUTE) {
    return processGrantNotification(runtime, resolved.ipexExchange);
  }

  return null;
}

export async function syncPresentationRequestNotifications(
  runtime: IssuerRuntime
): Promise<void> {
  const notifications = await runtime.client.notifications().list();
  const notes = Array.isArray((notifications as { notes?: unknown }).notes)
    ? ((notifications as { notes: SignifyNotification[] }).notes as SignifyNotification[])
    : [];

  for (const note of notes) {
    try {
      const processed = await processPresentationRequestNotification(runtime, note);
      if (processed?.handled && processed.deleteNotification) {
        const id = normalizeString(note.i);
        if (id) {
          await runtime.client.notifications().delete(id).catch(() => {
            // Best-effort cleanup when replaying notifications for request sync.
          });
        }
      }
    } catch {
      // Leave the notification in place so the next sync can retry it.
    }
  }
}

export async function createPresentationRequest(input: {
  runtime: IssuerRuntime;
  requestExnSaid: string;
  holderDid: string;
  schemaId: string;
  requestedAttributes?: Record<string, string>;
}): Promise<PresentationRequestRecord> {
  return createPresentationRequestForIssuer({
    issuerId: input.runtime.issuerId,
    requestExnSaid: input.requestExnSaid,
    verifierDid: input.runtime.aidPrefix,
    holderDid: input.holderDid,
    schemaId: input.schemaId,
    requestedAttributes: input.requestedAttributes,
  });
}

export async function listPresentationRequests(runtime: IssuerRuntime) {
  await syncPresentationRequestNotifications(runtime);
  return listPresentationRequestsByIssuer(runtime.issuerId);
}
