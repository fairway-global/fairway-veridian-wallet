jest.mock("ionicons/components/ion-icon.js", () => ({}), { virtual: true });
jest.mock("../../../hooks", () => ({
  useIonHardwareBackButton: jest.fn(),
}));

import { fireEvent, render, waitFor } from "@testing-library/react";
import { mockIonicReact } from "@ionic/react-test-utils";
import { act } from "react";
import { TabLayout } from "./TabLayout";
import { i18n } from "../../../../i18n";

mockIonicReact();

describe("Tab layout", () => {
  beforeEach(async () => {
    window.localStorage.removeItem("app-language");
    await act(async () => {
      await i18n.changeLanguage("en");
    });
  });

  afterEach(async () => {
    window.localStorage.removeItem("app-language");
    await act(async () => {
      await i18n.changeLanguage("en");
    });
  });

  test("Render back button", async () => {
    const backButtonAction = jest.fn();
    const { getByTestId } = render(
      <TabLayout
        header
        backButton
        backButtonAction={backButtonAction}
      />
    );

    await waitFor(() => {
      expect(getByTestId("tab-back-button")).toBeVisible();
    });

    fireEvent.click(getByTestId("tab-back-button"));
    expect(backButtonAction).toBeCalled();
  });

  test("Render done button", async () => {
    const doneAction = jest.fn();
    const { getByTestId } = render(
      <TabLayout
        header
        doneLabel="done"
        doneAction={doneAction}
      />
    );

    await waitFor(() => {
      expect(getByTestId("tab-done-button")).toBeVisible();
    });

    fireEvent.click(getByTestId("tab-done-button"));
    expect(doneAction).toBeCalled();
  });

  test("Render action button", async () => {
    const actionButtonAction = jest.fn();
    const { getByTestId } = render(
      <TabLayout
        header
        actionButton
        actionButtonLabel="Action button"
        actionButtonAction={actionButtonAction}
      />
    );

    await waitFor(() => {
      expect(getByTestId("action-button")).toBeVisible();
    });

    fireEvent.click(getByTestId("action-button"));
    expect(actionButtonAction).toBeCalled();
  });

  test("Render language switch", async () => {
    const { getByTestId } = render(
      <TabLayout
        header
        title="Header title"
      />
    );

    fireEvent.click(getByTestId("language-option-am"));

    await waitFor(() => {
      expect(i18n.resolvedLanguage).toBe("am");
      expect(window.localStorage.getItem("app-language")).toBe("am");
    });
  });
});
