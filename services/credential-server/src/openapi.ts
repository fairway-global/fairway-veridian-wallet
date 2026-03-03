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
  required: ["error"],
  properties: {
    error: { type: "string" },
  },
};

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
    [config.path.saveFayda]: {
      get: {
        tags: ["Credentials"],
        summary: "Check if holder already has Fayda verification credential",
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
              "Optional schema SAID for status check only. Defaults to FAYDA_SCHEMA_SAID or FaydaFairwayId schema.",
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
                    schemaSaid: "EKgoX7j8AIkUv44WtJzcO_CvMbVuYH367hrivzaAKacm",
                    verified: true,
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
        summary: "Process Fayda payload and auto-issue credential",
        description:
          "Accepts verified Fayda claims and immediately sends an ACDC credential offer to the holder wallet.",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["aid", "faydaData"],
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
                  faydaData: {
                    type: "object",
                    description: "Verified claims from Fayda",
                    additionalProperties: true,
                    properties: {
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
                    message: "Fayda data processed and credential offer sent",
                    credentialName: "FaydaVerifiedFairwayId",
                    holderAid: "EA...",
                    schemaSaid: "EKgoX7j8AIkUv44WtJzcO_CvMbVuYH367hrivzaAKacm",
                  },
                },
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
              "Optional schema SAID filter. Defaults to FAYDA_SCHEMA_SAID or FaydaFairwayId schema.",
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
