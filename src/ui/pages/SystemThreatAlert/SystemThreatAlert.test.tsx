import { render } from "@testing-library/react";
import TRANSLATE from "../../../locales/en/en.json";
import { SystemThreatAlert } from "./SystemThreatAlert";

describe("System Threat Alert", () => {
  test("Render", async () => {
    const { getByText } = render(
      <SystemThreatAlert errors={["Debug threat error"]} />
    );

    expect(getByText(TRANSLATE.systemthreats.title)).toBeVisible();
    expect(getByText(TRANSLATE.systemthreats.description)).toBeVisible();
    expect(getByText(TRANSLATE.systemthreats.help)).toBeVisible();
    expect(getByText("Debug threat error")).toBeVisible();
  });

  test("Help button pre-fills threat details for abrham", () => {
    const { getByText } = render(
      <SystemThreatAlert
        errors={["App integrity issue", "Unofficial store detected"]}
      />
    );

    const helpButton = getByText(TRANSLATE.systemthreats.help);
    const href = helpButton.getAttribute("href");

    expect(href).toContain("mailto:abrham@fairway.global");
    expect(decodeURIComponent(href || "")).toContain("App integrity issue");
    expect(decodeURIComponent(href || "")).toContain(
      "Unofficial store detected"
    );
  });
});
