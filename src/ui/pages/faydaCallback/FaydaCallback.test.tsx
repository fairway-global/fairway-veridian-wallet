import { fireEvent, render, waitFor } from "@testing-library/react";
import { Provider } from "react-redux";
import { Router } from "react-router-dom";
import { createMemoryHistory } from "history";
import configureStore from "redux-mock-store";
import { FaydaCallback } from "./FaydaCallback";

const getNotificationsMock = jest.fn();

jest.mock("../../../core/agent/agent", () => ({
  Agent: {
    agent: {
      keriaNotifications: {
        getNotifications: (...args: any[]) => getNotificationsMock(...args),
      },
    },
  },
}));

jest.mock("jose", () => ({
  decodeJwt: jest.fn(),
}));

describe("FaydaCallback", () => {
  const mockStore = configureStore();

  beforeEach(() => {
    jest.resetAllMocks();
    sessionStorage.clear();
    localStorage.clear();
    getNotificationsMock.mockResolvedValue([]);
  });

  test("shows a completion state after successful saveFayda", async () => {
    const history = createMemoryHistory({
      initialEntries: ["/callback?code=test-code&state=test-state"],
    });
    const store = mockStore({});
    const fetchMock = jest.fn();

    sessionStorage.setItem("fayda_state", "test-state");
    sessionStorage.setItem("fayda_holder_aid", "holder-aid");

    (global as any).fetch = fetchMock
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ access_token: "access-token" }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => "userinfo-jwt",
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: {
            verified: true,
            pendingManualReview: true,
            autoIssued: false,
          },
        }),
      });

    const jose = require("jose");
    jose.decodeJwt.mockReturnValue({
      name: "Chernet Tadese Bekele",
      email: "chere@id.et",
      phone_number: "0909090909",
      birthdate: "1980/12/01",
    });

    const { getByText, queryByText } = render(
      <Provider store={store}>
        <Router history={history}>
          <FaydaCallback />
        </Router>
      </Provider>
    );

    await waitFor(() => {
      expect(getByText("Accept and continue")).toBeInTheDocument();
    });

    fireEvent.click(getByText("Accept and continue"));

    await waitFor(() => {
      expect(
        getByText(
          "Fayda verification completed. The issuer must finish this credential manually."
        )
      ).toBeInTheDocument();
    });

    expect(queryByText("Accept and continue")).not.toBeInTheDocument();
    expect(getByText("Back to Menu")).toBeInTheDocument();
  });
});
