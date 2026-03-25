import { act } from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { APP_LANGUAGE_STORAGE_KEY, i18n } from "../../../i18n";
import { LanguageSwitch, pageReload } from "./LanguageSwitch";

describe("LanguageSwitch", () => {
  beforeEach(async () => {
    window.localStorage.clear();
    jest.restoreAllMocks();

    await act(async () => {
      await i18n.changeLanguage("en");
    });
  });

  test("reloads the app after switching languages", async () => {
    const reloadSpy = jest
      .spyOn(pageReload, "reload")
      .mockImplementation(() => undefined);
    const changeLanguageSpy = jest.spyOn(i18n, "changeLanguage");

    render(<LanguageSwitch />);

    fireEvent.click(screen.getByTestId("language-option-am"));

    await waitFor(() => {
      expect(changeLanguageSpy).toHaveBeenCalledWith("am");
      expect(window.localStorage.getItem(APP_LANGUAGE_STORAGE_KEY)).toBe("am");
      expect(reloadSpy).toHaveBeenCalled();
    });
  });
});
