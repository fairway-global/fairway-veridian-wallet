import { getFaydaPrefillForTemplateAttributes } from "./faydaPrefillService";
import {
  coerceTemplateAttributeValue,
  normalizeTemplateAttributeType,
} from "./templateAttributeUtils";

describe("template attribute date handling", () => {
  test("infers date type from birthdate-like schema fields", () => {
    expect(
      normalizeTemplateAttributeType({
        name: "birthdate",
        type: "string",
      })
    ).toBe("date");

    expect(
      normalizeTemplateAttributeType({
        name: "issueDate",
        type: "string",
      })
    ).toBe("date");
  });

  test("normalizes slash-delimited Fayda dates for date attributes", () => {
    expect(
      coerceTemplateAttributeValue("2001/12/01", {
        name: "birthdate",
        type: "date",
      })
    ).toBe("2001-12-01");
  });

  test("returns normalized Fayda prefill values for typed template attributes", () => {
    const result = getFaydaPrefillForTemplateAttributes({
      attributes: [
        {
          name: "birthdate",
          type: "date",
          required: true,
        },
        {
          name: "gender",
          type: "string",
          required: false,
        },
      ],
      mappedData: {
        birthdate: "2001/12/01",
        gender: "female",
      },
    });

    expect(result.matchedFields).toEqual(["birthdate", "gender"]);
    expect(result.values).toEqual({
      birthdate: "2001-12-01",
      gender: "female",
    });
  });
});
