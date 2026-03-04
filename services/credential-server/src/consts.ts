export const QVI_NAME = "qvi";
export const ISSUER_NAME = "issuer";
export const QVI_SCHEMA_SAID = "EBfdlu8R27Fbx-ehrqwImnK-8Cm79sqbAQ4MmvEAYqao";
export const RARE_EVO_DEMO_SCHEMA_SAID =
  "EJxnJdxkHbRw2wVFNe4IUOPLt8fEtg9Sr3WyTjlgKoIb";
export const LE_SCHEMA_SAID = "ENPXp1vQzRF6JwIuS-mp2U8Uf1MoADoP_GqQ62VsDZWY";
export const F_EMPLOYEE_DEMO_SCHEMA_SAID =
  "EL9oOWU_7zQn_rD--Xsgi3giCWnFDaNvFMUGTOZx1ARO";
export const FAYDA_FAIRWAY_ID_SCHEMA_SAID =
  "EKgoX7j8AIkUv44WtJzcO_CvMbVuYH367hrivzaAKacm";
export const FAYDA_AUTO_VERIFIED_SCHEMA_LEGACY_SAID =
  "EJ9W0ks2W9uR3M9dY7sY4XvK8zN7xW5gQ2mV4pL1tHcB";
export const FAYDA_AUTO_VERIFIED_SCHEMA_SAID =
  "EHYYZFJas0_cgo3nA1_BeeyWRIzyWqic3pM-LdYmL_R6";
export const SCHEMA_ID_ALIASES: Record<string, string> = {
  [FAYDA_AUTO_VERIFIED_SCHEMA_LEGACY_SAID]: FAYDA_AUTO_VERIFIED_SCHEMA_SAID,
};

export function canonicalSchemaId(schemaId: string): string {
  const normalized = String(schemaId || "").trim();
  return SCHEMA_ID_ALIASES[normalized] || normalized;
}

export const ACDC_SCHEMAS_ID = [
  QVI_SCHEMA_SAID,
  LE_SCHEMA_SAID,
  RARE_EVO_DEMO_SCHEMA_SAID,
  F_EMPLOYEE_DEMO_SCHEMA_SAID,
  FAYDA_FAIRWAY_ID_SCHEMA_SAID,
  FAYDA_AUTO_VERIFIED_SCHEMA_SAID,
];

export const ACDC_SCHEMAS = [
  {
    id: FAYDA_AUTO_VERIFIED_SCHEMA_SAID,
    name: "FaydaVerifiedAutoIssue",
  },
  {
    id: FAYDA_FAIRWAY_ID_SCHEMA_SAID,
    name: "FaydaFairwayId",
  },
  {
    id: F_EMPLOYEE_DEMO_SCHEMA_SAID,
    name: "Foundation Employee",
  },
  {
    id: QVI_SCHEMA_SAID,
    name: "Qualified vLEI Issuer Credential",
  },
  {
    id: RARE_EVO_DEMO_SCHEMA_SAID,
    name: "Rare EVO 2024 Attendee",
  },
  {
    id: LE_SCHEMA_SAID,
    name: "Legal Entity vLEI Credential",
  },
];
