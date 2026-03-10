jest.mock("./tenantStore", () => ({
  createPresentationRequestForIssuer: jest.fn(),
  getPresentationRequestByAgreeExnSaidForIssuer: jest.fn(),
  getPresentationRequestByRequestExnSaidForIssuer: jest.fn(),
  listPresentationRequestsByIssuer: jest.fn(),
  updatePresentationRequestForIssuer: jest.fn(),
}));

import {
  getPresentationRequestByRequestExnSaidForIssuer,
  updatePresentationRequestForIssuer,
} from "./tenantStore";
import { processPresentationRequestNotification } from "./presentationRequestService";

const getPresentationRequestByRequestExnSaidForIssuerMock = jest.mocked(
  getPresentationRequestByRequestExnSaidForIssuer
);
const updatePresentationRequestForIssuerMock = jest.mocked(
  updatePresentationRequestForIssuer
);

describe("presentationRequestService", () => {
  const exchangeGetMock = jest.fn();
  const credentialStateMock = jest.fn();
  const agreeMock = jest.fn();
  const submitAgreeMock = jest.fn();

  const runtime = {
    issuerId: "issuer-id",
    aidAlias: "verifier-alias",
    aidPrefix: "verifier-did",
    client: {
      exchanges: () => ({
        get: exchangeGetMock,
      }),
      credentials: () => ({
        state: credentialStateMock,
      }),
      ipex: () => ({
        agree: agreeMock,
        submitAgree: submitAgreeMock,
      }),
    },
  } as any;

  const requestRecord = {
    id: "request-id",
    issuerId: "issuer-id",
    requestExnSaid: "apply-said",
    verifierDid: "verifier-did",
    holderDid: "holder-did",
    schemaId: "schema-said",
    requestedAttributes: {
      name: "Alice",
    },
    status: "requested",
  } as any;

  const offerExchange = {
    exn: {
      r: "/ipex/offer",
      d: "offer-said",
      p: "apply-said",
      i: "holder-did",
      rp: "verifier-did",
      e: {
        acdc: {
          d: "credential-said",
          i: "issuer-did",
          ri: "registry-said",
          s: "schema-said",
          a: {
            i: "holder-did",
            name: "Alice",
          },
        },
      },
    },
  };

  beforeEach(() => {
    jest.clearAllMocks();
    getPresentationRequestByRequestExnSaidForIssuerMock.mockResolvedValue(
      requestRecord
    );
    exchangeGetMock.mockResolvedValue(offerExchange);
    agreeMock.mockResolvedValue([
      {
        ked: {
          d: "agree-said",
        },
      },
      ["sig"],
    ]);
    submitAgreeMock.mockResolvedValue(undefined);
  });

  test("verifies an offer when credential registry state cannot be read", async () => {
    credentialStateMock.mockRejectedValue(
      new Error("registry lookup unavailable")
    );

    const result = await processPresentationRequestNotification(runtime, {
      a: {
        d: "notification-said",
      },
    });

    expect(updatePresentationRequestForIssuerMock).toHaveBeenCalledWith(
      expect.objectContaining({
        issuerId: "issuer-id",
        requestId: "request-id",
        status: "verified",
        agreeExnSaid: "agree-said",
      })
    );
    expect(agreeMock).toHaveBeenCalled();
    expect(result).toEqual(
      expect.objectContaining({
        handled: true,
        deleteNotification: true,
      })
    );
  });

  test("rejects an offer when the credential is explicitly revoked", async () => {
    credentialStateMock.mockResolvedValue({
      et: "rev",
    });

    const result = await processPresentationRequestNotification(runtime, {
      a: {
        d: "notification-said",
      },
    });

    expect(updatePresentationRequestForIssuerMock).toHaveBeenCalledWith(
      expect.objectContaining({
        issuerId: "issuer-id",
        requestId: "request-id",
        status: "rejected",
      })
    );
    expect(agreeMock).not.toHaveBeenCalled();
    expect(result).toEqual(
      expect.objectContaining({
        handled: true,
        deleteNotification: true,
      })
    );
  });
});
