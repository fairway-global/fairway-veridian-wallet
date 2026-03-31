import { render } from "@testing-library/react";
import EN_TRANSLATIONS from "../../../../../../../locales/en/en.json";
import { ReleaseInfo } from "./ReleaseInfo";

describe("ReleaseInfo", () => {
  const originalReleaseDate = process.env.REACT_APP_RELEASE_DATE;
  const originalApkSize = process.env.REACT_APP_ANDROID_APK_SIZE;
  const originalChecksum = process.env.REACT_APP_ANDROID_APK_SHA256;
  const originalChangelog = process.env.REACT_APP_RELEASE_CHANGELOG;
  const originalDescription = process.env.REACT_APP_RELEASE_DESCRIPTION;

  afterEach(() => {
    process.env.REACT_APP_RELEASE_DATE = originalReleaseDate;
    process.env.REACT_APP_ANDROID_APK_SIZE = originalApkSize;
    process.env.REACT_APP_ANDROID_APK_SHA256 = originalChecksum;
    process.env.REACT_APP_RELEASE_CHANGELOG = originalChangelog;
    process.env.REACT_APP_RELEASE_DESCRIPTION = originalDescription;
  });

  test("renders configured release metadata", () => {
    process.env.REACT_APP_RELEASE_DATE = "2026-03-30";
    process.env.REACT_APP_ANDROID_APK_SIZE = "28.4 MB";
    process.env.REACT_APP_ANDROID_APK_SHA256 = "abc123";
    process.env.REACT_APP_RELEASE_CHANGELOG =
      "Updated Fairwallet branding|Fixed wallet scrolling";
    process.env.REACT_APP_RELEASE_DESCRIPTION =
      "Signed Android release for Fairwallet.";

    const { getByText, getByTestId } = render(<ReleaseInfo />);

    expect(getByTestId("release-info-description")).toHaveTextContent(
      "Signed Android release for Fairwallet."
    );
    expect(getByTestId("release-info-details")).toHaveTextContent(
      EN_TRANSLATIONS.tabs.menu.tab.settings.sections.support.releaseinfo
        .releasedate
    );
    expect(getByTestId("release-info-details")).toHaveTextContent("2026-03-30");
    expect(getByTestId("release-info-details")).toHaveTextContent("28.4 MB");
    expect(getByTestId("release-info-details")).toHaveTextContent("abc123");
    expect(getByTestId("release-info-changelog")).toHaveTextContent(
      "Updated Fairwallet branding"
    );
    expect(getByTestId("release-info-changelog")).toHaveTextContent(
      "Fixed wallet scrolling"
    );
    expect(getByTestId("release-info-install")).toHaveTextContent(
      EN_TRANSLATIONS.tabs.menu.tab.settings.sections.support.releaseinfo
        .installsteps.download
    );
  });

  test("shows fallback when release metadata is missing", () => {
    delete process.env.REACT_APP_RELEASE_DATE;
    delete process.env.REACT_APP_ANDROID_APK_SIZE;
    delete process.env.REACT_APP_ANDROID_APK_SHA256;
    delete process.env.REACT_APP_RELEASE_CHANGELOG;
    delete process.env.REACT_APP_RELEASE_DESCRIPTION;

    const { getAllByText, getByText, getByTestId } = render(<ReleaseInfo />);

    expect(getByTestId("release-info-description")).toHaveTextContent(
      EN_TRANSLATIONS.tabs.menu.tab.settings.sections.support.releaseinfo.notset
    );
    expect(getByTestId("release-info-changelog")).toHaveTextContent(
      EN_TRANSLATIONS.tabs.menu.tab.settings.sections.support.releaseinfo
        .emptychangelog
    );
    expect(
      getAllByText(
        EN_TRANSLATIONS.tabs.menu.tab.settings.sections.support.releaseinfo.notset
      ).length
    ).toBeGreaterThanOrEqual(4);
    expect(
      getByText(
        EN_TRANSLATIONS.tabs.menu.tab.settings.sections.support.releaseinfo
          .installtitle
      )
    ).toBeInTheDocument();
  });
});
