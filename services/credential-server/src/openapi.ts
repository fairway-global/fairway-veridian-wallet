import { config } from "./config";
import { ACDC_SCHEMAS, ACDC_SCHEMAS_ID } from "./consts";

const successEnvelopeSchema = {
  type: "object",
  required: ["success", "data"],
  properties: {
    success: { type: "boolean", example: true },
    data: {},
  },
};

const errorEnvelopeSchema = {
  type: "object",
  required: ["success", "error"],
  properties: {
    success: { type: "boolean", example: false },
    data: {},
    error: { type: "string" },
  },
};

const candourResultSchema = {
  type: "object",
  additionalProperties: true,
  required: ["verificationSessionId", "status", "identityVerified"],
  properties: {
    timestamp: { type: "string", format: "date-time" },
    verificationSessionId: { type: "string" },
    verificationTries: { type: "number" },
    status: {
      type: "string",
      enum: ["finished", "finishedManual"],
      description:
        "Successful Candour result status. finishedManual may include manualOverride.",
    },
    updatedAt: { type: "string", format: "date-time" },
    verificationMethod: {
      type: "string",
      enum: ["rfidApp", "idApp", "idWeb", "sfovWeb", "mrzApp"],
    },
    identityVerified: {
      type: "boolean",
      enum: [true],
      description:
        "Candour's main success flag. Must be true before this route issues a credential.",
    },
    invitationLink: { type: "string" },
    identifier: { type: "string" },
    name: { type: "string" },
    firstName: { type: "string" },
    lastName: { type: "string" },
    dateOfBirth: { type: "string" },
    nationalIdentificationNumber: { type: "string" },
    idNumber: { type: "string" },
    idDocumentType: { type: "string", enum: ["passport", "idCard"] },
    idExpiration: { type: "string" },
    idIssuer: { type: "string" },
    nationality: { type: "string" },
    sex: { type: "string" },
    selfieImage: {
      type: "string",
      description:
        "Base64 image returned only when requested in resultProperties.",
    },
    idMrzImage: {
      type: "string",
      description:
        "Base64 image returned only when requested in resultProperties.",
    },
    idOtherImage: {
      type: "string",
      description:
        "Base64 image returned only when requested in resultProperties.",
    },
    idChipImage: {
      type: "string",
      description:
        "Base64 image returned only when requested in resultProperties.",
    },
    manualOverride: {
      type: "object",
      additionalProperties: true,
      properties: {
        manualSuccess: { type: "boolean" },
        manualFailure: { type: "boolean" },
        user: { type: "string" },
        originalStatus: { type: "string" },
      },
    },
  },
};

const templateByIdPath = config.path.templateById.replace(":id", "{id}");
const credentialByIdPath = config.path.credentialById.replace(":id", "{id}");
const revokeCredentialByIdPath = config.path.revokeCredentialApi.replace(
  ":id",
  "{id}"
);

export const openApiDocument = {
  openapi: "3.0.3",
  info: {
    title: "Credential Issuance Server API",
    version: "0.0.1",
    description:
      "Testing API for OOBI resolution and ACDC credential issuance flows.",
  },
  servers: [
    {
      url: config.endpoint,
      description: "Credential server",
    },
  ],
  tags: [
    { name: "System" },
    { name: "OOBI" },
    { name: "Contacts" },
    { name: "Schemas" },
    { name: "Credentials" },
    { name: "Candour" },
    { name: "Templates API" },
    { name: "Credentials API" },
  ],
  paths: {
    [config.path.ping]: {
      get: {
        tags: ["System"],
        summary: "Health check",
        responses: {
          "200": {
            description: "Server is alive",
            content: {
              "text/plain": {
                schema: { type: "string", example: "pong" },
              },
            },
          },
          "500": {
            description: "Unhandled server error",
            content: {
              "application/json": {
                schema: errorEnvelopeSchema,
              },
            },
          },
        },
      },
    },
    [config.path.keriOobi]: {
      get: {
        tags: ["OOBI"],
        summary: "Get issuer OOBI URL",
        responses: {
          "200": {
            description: "Issuer OOBI link",
            content: {
              "application/json": {
                schema: successEnvelopeSchema,
                example: {
                  success: true,
                  data: `${config.endpoint}/oobi/example?name=Fairway%20credential%20issuance`,
                },
              },
            },
          },
          "500": {
            description: "Unhandled server error",
            content: {
              "application/json": {
                schema: errorEnvelopeSchema,
              },
            },
          },
        },
      },
    },
    [config.path.resolveOobi]: {
      post: {
        tags: ["OOBI"],
        summary: "Resolve an OOBI URL",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["oobi"],
                properties: {
                  oobi: { type: "string", format: "uri" },
                },
              },
            },
          },
        },
        responses: {
          "200": {
            description: "OOBI resolved",
            content: {
              "application/json": {
                schema: successEnvelopeSchema,
                example: {
                  success: true,
                  data: "OOBI resolved successfully",
                },
              },
            },
          },
          "500": {
            description: "Unhandled server error",
            content: {
              "application/json": {
                schema: errorEnvelopeSchema,
              },
            },
          },
        },
      },
    },
    [config.path.contacts]: {
      get: {
        tags: ["Contacts"],
        summary: "List contacts",
        responses: {
          "200": {
            description: "Contacts list",
            content: {
              "application/json": {
                schema: {
                  ...successEnvelopeSchema,
                  properties: {
                    ...successEnvelopeSchema.properties,
                    data: {
                      type: "array",
                      items: {
                        type: "object",
                        additionalProperties: true,
                      },
                    },
                  },
                },
              },
            },
          },
          "500": {
            description: "Unhandled server error",
            content: {
              "application/json": {
                schema: errorEnvelopeSchema,
              },
            },
          },
        },
      },
    },
    [config.path.deleteContact]: {
      delete: {
        tags: ["Contacts"],
        summary: "Delete a contact",
        parameters: [
          {
            name: "id",
            in: "query",
            required: true,
            schema: { type: "string" },
            description: "Contact AID / id",
          },
        ],
        responses: {
          "200": {
            description: "Contact deleted",
            content: {
              "application/json": {
                schema: successEnvelopeSchema,
              },
            },
          },
          "500": {
            description: "Unhandled server error",
            content: {
              "application/json": {
                schema: errorEnvelopeSchema,
              },
            },
          },
        },
      },
    },
    [config.path.contactCredentials]: {
      get: {
        tags: ["Credentials"],
        summary: "List credentials for a contact",
        parameters: [
          {
            name: "contactId",
            in: "query",
            required: true,
            schema: { type: "string" },
            description: "Recipient AID / contact id",
          },
        ],
        responses: {
          "200": {
            description: "Credentials list",
            content: {
              "application/json": {
                schema: {
                  ...successEnvelopeSchema,
                  properties: {
                    ...successEnvelopeSchema.properties,
                    data: {
                      type: "array",
                      items: {
                        type: "object",
                        additionalProperties: true,
                      },
                    },
                  },
                },
              },
            },
          },
          "500": {
            description: "Unhandled server error",
            content: {
              "application/json": {
                schema: errorEnvelopeSchema,
              },
            },
          },
        },
      },
    },
    [config.path.schemas]: {
      get: {
        tags: ["Schemas"],
        summary: "List supported ACDC schemas",
        responses: {
          "200": {
            description: "Supported schemas",
            content: {
              "application/json": {
                schema: {
                  ...successEnvelopeSchema,
                  properties: {
                    ...successEnvelopeSchema.properties,
                    data: {
                      type: "array",
                      items: {
                        type: "object",
                        required: ["id", "name"],
                        properties: {
                          id: { type: "string" },
                          name: { type: "string" },
                        },
                      },
                    },
                  },
                },
                example: {
                  success: true,
                  data: ACDC_SCHEMAS,
                },
              },
            },
          },
          "500": {
            description: "Unhandled server error",
            content: {
              "application/json": {
                schema: errorEnvelopeSchema,
              },
            },
          },
        },
      },
    },
    [config.path.templates]: {
      get: {
        tags: ["Templates API"],
        summary: "List credential templates",
        responses: {
          "200": {
            description: "Credential templates",
            content: {
              "application/json": {
                schema: successEnvelopeSchema,
              },
            },
          },
        },
      },
      post: {
        tags: ["Templates API"],
        summary: "Create credential template",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["name", "schemaId", "attributes"],
                properties: {
                  name: { type: "string" },
                  schemaId: { type: "string" },
                  attributes: {
                    type: "array",
                    items: {
                      type: "object",
                      required: ["name", "type", "required"],
                      properties: {
                        name: { type: "string" },
                        type: {
                          type: "string",
                          enum: [
                            "string",
                            "integer",
                            "number",
                            "boolean",
                            "date",
                          ],
                        },
                        required: { type: "boolean" },
                      },
                    },
                  },
                },
              },
            },
          },
        },
        responses: {
          "201": {
            description: "Template created",
            content: {
              "application/json": {
                schema: successEnvelopeSchema,
              },
            },
          },
          "400": {
            description: "Invalid request body",
            content: {
              "application/json": {
                schema: errorEnvelopeSchema,
              },
            },
          },
        },
      },
    },
    [templateByIdPath]: {
      get: {
        tags: ["Templates API"],
        summary: "Get credential template detail",
        parameters: [
          {
            name: "id",
            in: "path",
            required: true,
            schema: { type: "string", format: "uuid" },
          },
        ],
        responses: {
          "200": {
            description: "Template detail",
            content: {
              "application/json": {
                schema: successEnvelopeSchema,
              },
            },
          },
          "404": {
            description: "Template not found",
            content: {
              "application/json": {
                schema: errorEnvelopeSchema,
              },
            },
          },
        },
      },
      put: {
        tags: ["Templates API"],
        summary: "Update credential template",
        parameters: [
          {
            name: "id",
            in: "path",
            required: true,
            schema: { type: "string", format: "uuid" },
          },
        ],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["name", "schemaId", "attributes"],
                properties: {
                  name: { type: "string" },
                  schemaId: { type: "string" },
                  attributes: {
                    type: "array",
                    items: {
                      type: "object",
                      required: ["name", "type", "required"],
                      properties: {
                        name: { type: "string" },
                        type: {
                          type: "string",
                          enum: [
                            "string",
                            "integer",
                            "number",
                            "boolean",
                            "date",
                          ],
                        },
                        required: { type: "boolean" },
                      },
                    },
                  },
                },
              },
            },
          },
        },
        responses: {
          "200": {
            description: "Template updated",
            content: {
              "application/json": {
                schema: successEnvelopeSchema,
              },
            },
          },
          "404": {
            description: "Template not found",
            content: {
              "application/json": {
                schema: errorEnvelopeSchema,
              },
            },
          },
        },
      },
      delete: {
        tags: ["Templates API"],
        summary: "Delete credential template",
        parameters: [
          {
            name: "id",
            in: "path",
            required: true,
            schema: { type: "string", format: "uuid" },
          },
        ],
        responses: {
          "200": {
            description: "Template deleted",
            content: {
              "application/json": {
                schema: successEnvelopeSchema,
              },
            },
          },
          "404": {
            description: "Template not found",
            content: {
              "application/json": {
                schema: errorEnvelopeSchema,
              },
            },
          },
        },
      },
    },
    [config.path.credentialsApi]: {
      get: {
        tags: ["Credentials API"],
        summary: "List issued credentials",
        responses: {
          "200": {
            description: "Issued credentials",
            content: {
              "application/json": {
                schema: successEnvelopeSchema,
              },
            },
          },
        },
      },
    },
    [credentialByIdPath]: {
      get: {
        tags: ["Credentials API"],
        summary: "Get issued credential detail",
        parameters: [
          {
            name: "id",
            in: "path",
            required: true,
            schema: { type: "string" },
          },
        ],
        responses: {
          "200": {
            description: "Issued credential detail",
            content: {
              "application/json": {
                schema: successEnvelopeSchema,
              },
            },
          },
          "404": {
            description: "Credential not found",
            content: {
              "application/json": {
                schema: errorEnvelopeSchema,
              },
            },
          },
        },
      },
      delete: {
        tags: ["Credentials API"],
        summary: "Delete issued credential from issuer storage",
        parameters: [
          {
            name: "id",
            in: "path",
            required: true,
            schema: { type: "string" },
          },
        ],
        responses: {
          "200": {
            description: "Credential deleted",
            content: {
              "application/json": {
                schema: successEnvelopeSchema,
              },
            },
          },
          "409": {
            description: "Credential is not revoked yet",
            content: {
              "application/json": {
                schema: errorEnvelopeSchema,
              },
            },
          },
        },
      },
    },
    [config.path.issueCredentialApi]: {
      post: {
        tags: ["Credentials API"],
        summary: "Issue credential from template",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["templateId", "connectionId"],
                properties: {
                  templateId: { type: "string", format: "uuid" },
                  connectionId: { type: "string" },
                  values: {
                    type: "object",
                    additionalProperties: true,
                  },
                },
              },
            },
          },
        },
        responses: {
          "201": {
            description: "Credential issued",
            content: {
              "application/json": {
                schema: successEnvelopeSchema,
              },
            },
          },
          "400": {
            description: "Invalid payload",
            content: {
              "application/json": {
                schema: errorEnvelopeSchema,
              },
            },
          },
        },
      },
    },
    [revokeCredentialByIdPath]: {
      put: {
        tags: ["Credentials API"],
        summary: "Revoke issued credential",
        parameters: [
          {
            name: "id",
            in: "path",
            required: true,
            schema: { type: "string" },
          },
        ],
        requestBody: {
          required: false,
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  holder: { type: "string" },
                },
              },
            },
          },
        },
        responses: {
          "200": {
            description: "Credential revoked",
            content: {
              "application/json": {
                schema: successEnvelopeSchema,
              },
            },
          },
          "404": {
            description: "Credential not found",
            content: {
              "application/json": {
                schema: errorEnvelopeSchema,
              },
            },
          },
        },
      },
    },
    [config.path.issueAcdcCredential]: {
      post: {
        tags: ["Credentials"],
        summary: "Issue and grant an ACDC credential",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["schemaSaid", "aid"],
                properties: {
                  schemaSaid: {
                    type: "string",
                    enum: ACDC_SCHEMAS_ID,
                  },
                  aid: {
                    type: "string",
                    description: "Holder AID",
                  },
                  attribute: {
                    type: "object",
                    description: "Schema-specific attributes",
                    additionalProperties: true,
                  },
                },
              },
            },
          },
        },
        responses: {
          "200": {
            description: "Credential issued and sent",
            content: {
              "application/json": {
                schema: successEnvelopeSchema,
                example: {
                  success: true,
                  data: "Credential offered",
                },
              },
            },
          },
          "409": {
            description: "Unsupported schema ID or conflict",
            content: {
              "application/json": {
                schema: successEnvelopeSchema,
                example: {
                  success: false,
                  data: "",
                },
              },
            },
          },
          "500": {
            description: "Unhandled server error",
            content: {
              "application/json": {
                schema: errorEnvelopeSchema,
              },
            },
          },
        },
      },
    },
    [config.path.saveCandour]: {
      get: {
        tags: ["Candour"],
        summary: "Check Candour verification status for a holder",
        description:
          "Returns the stored Candour verification status for a holder AID. " +
          "Use this after the Candour callback/finalize flow to determine whether " +
          "the holder is verified, waiting for manual completion, or already has an issued credential.",
        parameters: [
          {
            name: "aid",
            in: "query",
            required: true,
            schema: { type: "string" },
            description: "Holder AID",
          },
          {
            name: "issuerAid",
            in: "query",
            required: false,
            schema: { type: "string" },
            description:
              "Optional issuer AID prefix used to resolve the issuer context when the request is unauthenticated.",
          },
          {
            name: "issuerCode",
            in: "query",
            required: false,
            schema: { type: "string" },
            description:
              "Optional issuer code used to resolve the issuer context when the request is unauthenticated.",
          },
        ],
        responses: {
          "200": {
            description: "Candour verification status",
            content: {
              "application/json": {
                schema: successEnvelopeSchema,
                example: {
                  success: true,
                  data: {
                    aid: "EA...",
                    verified: true,
                    verificationStatus: "credential_issued",
                    pendingManualReview: false,
                    missingFields: [],
                    credentialId: "EL...",
                    autoIssueConfigured: true,
                    autoIssueTemplateId: "9c0667ab-4f8e-4ff0-9c9f-1d209fc98f67",
                    verificationSessionId: "candour-session-id",
                  },
                },
              },
            },
          },
          "400": {
            description: "Missing holder AID",
            content: {
              "application/json": {
                schema: successEnvelopeSchema,
              },
            },
          },
          "500": {
            description: "Unhandled server error",
            content: {
              "application/json": {
                schema: errorEnvelopeSchema,
              },
            },
          },
        },
      },
      post: {
        tags: ["Candour"],
        summary: "Finalize Candour verification and auto-issue a credential",
        description:
          "Notes: call /candour/session first to create a Candour verification session, " +
          "then call this route after Candour reports that verification is complete. " +
          "The request sends the holder AID plus either a Candour verificationSessionId or a candourData object " +
          "matching GET /v1/:verificationSessionId. If candourData is not supplied, the server fetches " +
          "the verified Candour result from Candour, checks that identityVerified is true, checks that the identity " +
          "is unique for the issuer, maps the Candour fields into the issuer's auto-issue template, and issues the credential when all " +
          "required fields are available. If no auto-issue template exists, the holder is stored as " +
          "verified without issuing. If required template fields are missing, the record is saved for " +
          "manual review instead of issuing automatically. After processing, the server attempts to delete the " +
          "Candour result with DELETE /v1/:verificationSessionId.",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  aid: {
                    type: "string",
                    description:
                      "Holder AID that should receive the credential. One of aid/connectionId is required.",
                  },
                  connectionId: {
                    type: "string",
                    description:
                      "Alternative to aid; one of aid/connectionId is required.",
                  },
                  verificationSessionId: {
                    type: "string",
                    description:
                      "Candour verification session ID returned by /candour/session. Required unless candourData.verificationSessionId is supplied.",
                  },
                  candourData: {
                    ...candourResultSchema,
                    description:
                      "Verified Candour result returned by GET /v1/:verificationSessionId. This is mapped to the auto-issue credential template like faydaData in /saveFayda.",
                  },
                  issuerAid: {
                    type: "string",
                    description:
                      "Optional issuer AID prefix used to resolve the issuer context when the request is unauthenticated.",
                  },
                  issuerCode: {
                    type: "string",
                    description:
                      "Optional issuer code used to resolve the issuer context when the request is unauthenticated.",
                  },
                },
                allOf: [
                  {
                    anyOf: [
                      { required: ["aid"] },
                      { required: ["connectionId"] },
                    ],
                  },
                  {
                    anyOf: [
                      { required: ["verificationSessionId"] },
                      { required: ["candourData"] },
                    ],
                  },
                ],
              },
              example: {
                aid: "EA...",
                verificationSessionId: "candour-session-id",
                candourData: {
                  timestamp: "2026-05-08T10:30:00.000Z",
                  verificationSessionId: "candour-session-id",
                  verificationTries: 1,
                  status: "finished",
                  updatedAt: "2026-05-08T10:32:00.000Z",
                  verificationMethod: "idWeb",
                  identityVerified: true,
                  invitationLink:
                    "https://sandbox.candour.fi/invitation?invitationGuid=candour-session-id",
                  name: "Ada Lovelace",
                  firstName: "Ada",
                  lastName: "Lovelace",
                  dateOfBirth: "1815-12-10",
                  nationalIdentificationNumber: "123456789",
                  idDocumentType: "passport",
                  idIssuer: "GB",
                  nationality: "GB",
                  sex: "F",
                },
                issuerCode: "default",
              },
            },
          },
        },
        responses: {
          "200": {
            description:
              "Candour verification finalized. Credential may be auto-issued, already issued, verified without auto-issue, or saved for manual review.",
            content: {
              "application/json": {
                schema: successEnvelopeSchema,
                examples: {
                  autoIssued: {
                    summary: "Credential auto-issued",
                    value: {
                      success: true,
                      data: {
                        message:
                          "Candour verification succeeded and credential offer was sent automatically.",
                        credentialName: "CandourVerifiedAutoIssue",
                        holderAid: "EA...",
                        candourId: "123456789",
                        credentialId: "EL...",
                        alreadyIssued: false,
                        autoIssueConfigured: true,
                        autoIssued: true,
                        verified: true,
                        pendingManualReview: false,
                        verificationStatus: "credential_issued",
                        missingFields: [],
                        verificationSessionId: "candour-session-id",
                      },
                    },
                  },
                  manualReview: {
                    summary: "Manual review required",
                    value: {
                      success: true,
                      data: {
                        message:
                          "Candour verification succeeded, but the auto-issue template is missing required fields. The issuer must complete this credential manually.",
                        credentialName: "CandourVerifiedAutoIssue",
                        holderAid: "EA...",
                        candourId: "123456789",
                        credentialId: null,
                        alreadyIssued: false,
                        autoIssueConfigured: true,
                        autoIssued: false,
                        verified: true,
                        pendingManualReview: true,
                        verificationStatus: "pending_manual_review",
                        missingFields: ["dateOfBirth"],
                        mappedFields: ["name", "candourId"],
                        verificationSessionId: "candour-session-id",
                      },
                    },
                  },
                },
              },
            },
          },
          "400": {
            description:
              "Missing holder AID, missing verificationSessionId, missing Candour identifier, or schema/OOBI configuration problem",
            content: {
              "application/json": {
                schema: successEnvelopeSchema,
              },
            },
          },
          "409": {
            description:
              "Candour verification is incomplete, failed, conflicts with another holder, or uses an unsupported schema",
            content: {
              "application/json": {
                schema: successEnvelopeSchema,
              },
            },
          },
          "500": {
            description: "Unhandled server error",
            content: {
              "application/json": {
                schema: errorEnvelopeSchema,
              },
            },
          },
        },
      },
      delete: {
        tags: ["Candour"],
        summary: "Delete stored Candour verification state for testing",
        description:
          "Testing/reset helper for /saveCandour. Deletes persisted Candour verification rows for the holder. If issuerAid, issuerCode, or authenticated issuer context is supplied, the delete is scoped to that issuer; otherwise it deletes all Candour verification rows for the holder across issuers. When verificationSessionId is supplied, it also attempts to delete the Candour result with DELETE /v1/:verificationSessionId. This does not revoke or delete an already issued ACDC credential.",
        parameters: [
          {
            name: "aid",
            in: "query",
            required: true,
            schema: { type: "string" },
            description: "Holder AID to reset",
          },
          {
            name: "verificationSessionId",
            in: "query",
            required: false,
            schema: { type: "string" },
            description:
              "Optional Candour verification session ID to delete from Candour.",
          },
          {
            name: "issuerAid",
            in: "query",
            required: false,
            schema: { type: "string" },
            description:
              "Optional issuer AID prefix used to resolve the issuer context when the request is unauthenticated.",
          },
          {
            name: "issuerCode",
            in: "query",
            required: false,
            schema: { type: "string" },
            description:
              "Optional issuer code used to resolve the issuer context when the request is unauthenticated.",
          },
        ],
        responses: {
          "200": {
            description: "Candour verification state deleted",
            content: {
              "application/json": {
                schema: successEnvelopeSchema,
                example: {
                  success: true,
                  data: {
                    aid: "EA...",
                    issuerId: null,
                    issuerScopedDelete: false,
                    verificationSessionId: "candour-session-id",
                    deletedVerification: true,
                    deletedVerificationCount: 1,
                    deletedCandourResult: true,
                    candourDeleteError: null,
                  },
                },
              },
            },
          },
          "400": {
            description: "Missing holder AID",
            content: {
              "application/json": {
                schema: successEnvelopeSchema,
              },
            },
          },
          "500": {
            description: "Unhandled server error",
            content: {
              "application/json": {
                schema: errorEnvelopeSchema,
              },
            },
          },
        },
      },
    },
    [config.path.saveFayda]: {
      get: {
        tags: ["Credentials"],
        summary: "Check if holder has an active Fayda verification credential",
        parameters: [
          {
            name: "aid",
            in: "query",
            required: true,
            schema: { type: "string" },
            description: "Holder AID",
          },
          {
            name: "schemaSaid",
            in: "query",
            required: false,
            schema: { type: "string" },
            description:
              "Optional schema SAID for status check only. If omitted, status checks the default auto-issue Fayda schema and legacy Fayda schema.",
          },
        ],
        responses: {
          "200": {
            description: "Fayda verification status",
            content: {
              "application/json": {
                schema: successEnvelopeSchema,
                example: {
                  success: true,
                  data: {
                    aid: "EA...",
                    schemaSaid: "EHYYZFJas0_cgo3nA1_BeeyWRIzyWqic3pM-LdYmL_R6",
                    verified: true,
                    verifiedSchemaSaid:
                      "EHYYZFJas0_cgo3nA1_BeeyWRIzyWqic3pM-LdYmL_R6",
                  },
                },
              },
            },
          },
          "400": {
            description: "Missing aid query parameter",
            content: {
              "application/json": {
                schema: successEnvelopeSchema,
              },
            },
          },
          "500": {
            description: "Unhandled server error",
            content: {
              "application/json": {
                schema: errorEnvelopeSchema,
              },
            },
          },
        },
      },
      post: {
        tags: ["Credentials"],
        summary: "Auto-issue Fayda credential after Fayda ID verification",
        description:
          "Accepts verified Fayda claims, validates unique Fayda ID linkage, then automatically issues and grants an ACDC credential.",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["faydaData"],
                properties: {
                  aid: {
                    type: "string",
                    description:
                      "Holder AID that should receive the credential",
                  },
                  connectionId: {
                    type: "string",
                    description:
                      "Alternative to aid; one of aid/connectionId is required",
                  },
                  credentialName: {
                    type: "string",
                    description:
                      "Human-readable name shown by caller (not written to ACDC).",
                  },
                  schemaSaid: {
                    type: "string",
                    description:
                      "Optional schema SAID. Defaults to FaydaVerifiedAutoIssue schema.",
                  },
                  faydaData: {
                    type: "object",
                    description: "Verified claims from Fayda",
                    additionalProperties: true,
                    properties: {
                      id: {
                        type: "string",
                        description: "Fayda identifier (one accepted form).",
                      },
                      fayda_id: {
                        type: "string",
                        description: "Fayda identifier (preferred field).",
                      },
                      sub: {
                        type: "string",
                        description:
                          "OIDC subject from Fayda; used as fallback identifier.",
                      },
                      name: { type: "string" },
                      email: { type: "string" },
                      phone_number: { type: "string" },
                      birthdate: { type: "string" },
                      gender: { type: "string" },
                    },
                    required: [
                      "name",
                      "email",
                      "phone_number",
                      "birthdate",
                      "gender",
                    ],
                  },
                },
              },
            },
          },
        },
        responses: {
          "200": {
            description: "Credential offer sent to wallet",
            content: {
              "application/json": {
                schema: successEnvelopeSchema,
                example: {
                  success: true,
                  data: {
                    message:
                      "Fayda verification succeeded and credential offer was sent automatically.",
                    credentialName: "FaydaVerifiedAutoIssue",
                    holderAid: "EA...",
                    schemaSaid: "EHYYZFJas0_cgo3nA1_BeeyWRIzyWqic3pM-LdYmL_R6",
                    faydaId: "258010005988397142835639033041895718",
                    credentialId: "E....",
                    alreadyIssued: false,
                    verified: true,
                  },
                },
              },
            },
          },
          "409": {
            description:
              "Duplicate or conflicting Fayda ID verification for another holder",
            content: {
              "application/json": {
                schema: successEnvelopeSchema,
              },
            },
          },
          "400": {
            description: "Missing required data",
            content: {
              "application/json": {
                schema: successEnvelopeSchema,
              },
            },
          },
          "500": {
            description: "Unhandled server error",
            content: {
              "application/json": {
                schema: errorEnvelopeSchema,
              },
            },
          },
        },
      },
    },
    [config.path.saveFaydaData]: {
      get: {
        tags: ["Credentials"],
        summary: "Legacy alias of /saveFayda",
        deprecated: true,
        parameters: [
          {
            name: "aid",
            in: "query",
            required: true,
            schema: { type: "string" },
          },
          {
            name: "schemaSaid",
            in: "query",
            required: false,
            schema: { type: "string" },
          },
        ],
        responses: {
          "200": {
            description: "Fayda verification status",
            content: {
              "application/json": {
                schema: successEnvelopeSchema,
              },
            },
          },
        },
      },
      post: {
        tags: ["Credentials"],
        summary: "Legacy alias of /saveFayda",
        deprecated: true,
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                additionalProperties: true,
              },
            },
          },
        },
        responses: {
          "200": {
            description: "Credential offer sent to wallet",
            content: {
              "application/json": {
                schema: successEnvelopeSchema,
              },
            },
          },
        },
      },
    },
    [config.path.saveData]: {
      delete: {
        tags: ["Credentials"],
        summary: "Revoke Fayda credential(s) for a specific holder AID",
        description:
          "Revokes all matching credentials for the holder and sends revocation notification grants to the wallet.",
        parameters: [
          {
            name: "aid",
            in: "query",
            required: true,
            schema: { type: "string" },
            description: "Holder AID",
          },
          {
            name: "schemaSaid",
            in: "query",
            required: false,
            schema: { type: "string" },
            description:
              "Optional schema SAID filter. Defaults to FaydaVerifiedAutoIssue schema.",
          },
        ],
        responses: {
          "200": {
            description: "Matching credentials revoked",
            content: {
              "application/json": {
                schema: successEnvelopeSchema,
                example: {
                  success: true,
                  data: {
                    aid: "EA...",
                    schemaSaid: "EKgoX7j8AIkUv44WtJzcO_CvMbVuYH367hrivzaAKacm",
                    revokedCredentialIds: ["E...."],
                    alreadyRevokedCredentialIds: [],
                  },
                },
              },
            },
          },
          "400": {
            description: "Missing aid",
            content: {
              "application/json": {
                schema: successEnvelopeSchema,
              },
            },
          },
          "404": {
            description: "No matching credentials found",
            content: {
              "application/json": {
                schema: successEnvelopeSchema,
              },
            },
          },
          "500": {
            description: "Unhandled server error",
            content: {
              "application/json": {
                schema: errorEnvelopeSchema,
              },
            },
          },
        },
      },
    },
    [config.path.requestDisclosure]: {
      post: {
        tags: ["Credentials"],
        summary: "Request credential disclosure (presentation apply)",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["schemaSaid", "aid"],
                properties: {
                  schemaSaid: { type: "string" },
                  aid: { type: "string", description: "Recipient AID" },
                  attributes: {
                    type: "object",
                    description: "Requested attribute filters",
                    additionalProperties: { type: "string" },
                  },
                },
              },
            },
          },
        },
        responses: {
          "200": {
            description: "Presentation request sent",
            content: {
              "application/json": {
                schema: successEnvelopeSchema,
                example: {
                  success: true,
                  data: "Apply schema successfully",
                },
              },
            },
          },
          "500": {
            description: "Unhandled server error",
            content: {
              "application/json": {
                schema: errorEnvelopeSchema,
              },
            },
          },
        },
      },
    },
    [config.path.revokeCredential]: {
      post: {
        tags: ["Credentials"],
        summary: "Revoke a credential and notify holder",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["credentialId", "holder"],
                properties: {
                  credentialId: { type: "string" },
                  holder: { type: "string", description: "Holder AID" },
                },
              },
            },
          },
        },
        responses: {
          "200": {
            description: "Credential revoked",
            content: {
              "application/json": {
                schema: successEnvelopeSchema,
                example: {
                  success: true,
                  data: "Revoke credential successfully",
                },
              },
            },
          },
          "404": {
            description: "Credential not found",
            content: {
              "application/json": {
                schema: successEnvelopeSchema,
              },
            },
          },
          "409": {
            description: "Credential already revoked",
            content: {
              "application/json": {
                schema: successEnvelopeSchema,
              },
            },
          },
          "500": {
            description: "Unhandled server error",
            content: {
              "application/json": {
                schema: errorEnvelopeSchema,
              },
            },
          },
        },
      },
    },
    [config.path.deleteRevokedCredentials]: {
      delete: {
        tags: ["Credentials"],
        summary: "Delete revoked credentials from issuer cloud storage",
        description:
          "Permanently deletes revoked credentials from issuer storage. Optionally filter by holder AID and/or schema SAID.",
        parameters: [
          {
            name: "holder",
            in: "query",
            required: false,
            schema: { type: "string" },
            description: "Optional holder AID filter (-a-i).",
          },
          {
            name: "schemaSaid",
            in: "query",
            required: false,
            schema: { type: "string" },
            description: "Optional schema SAID filter (-s).",
          },
        ],
        responses: {
          "200": {
            description: "Revoked credentials deleted",
            content: {
              "application/json": {
                schema: successEnvelopeSchema,
                example: {
                  success: true,
                  data: {
                    holder: "EA...",
                    schemaSaid: "EKgoX7j8AIkUv44WtJzcO_CvMbVuYH367hrivzaAKacm",
                    deletedCredentialIds: ["EL..."],
                    alreadyDeletedCredentialIds: [],
                    skippedNonRevokedCredentialIds: ["EM..."],
                  },
                },
              },
            },
          },
          "500": {
            description: "Unhandled server error",
            content: {
              "application/json": {
                schema: errorEnvelopeSchema,
              },
            },
          },
        },
      },
    },
    "/oobi/{id}": {
      get: {
        tags: ["Schemas"],
        summary: "Get raw schema by SAID",
        parameters: [
          {
            name: "id",
            in: "path",
            required: true,
            schema: { type: "string" },
          },
        ],
        responses: {
          "200": {
            description: "Schema JSON",
            content: {
              "application/schema+json": {
                schema: {
                  type: "object",
                  additionalProperties: true,
                },
              },
            },
          },
          "404": {
            description: "Schema file not found",
          },
        },
      },
    },
  },
} as const;
