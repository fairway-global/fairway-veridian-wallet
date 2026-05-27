import { Capacitor } from "@capacitor/core";
import {
  buildIdentityVerificationNativeCallbackUri,
  getIdentityVerificationNativeRedirectUri,
  getIdentityVerificationRedirectUri,
} from "./identityVerification";

describe("identityVerification redirect helpers", () => {
  const originalEnv = process.env;
  let isNativePlatformSpy: jest.SpyInstance<boolean, []>;

  beforeEach(() => {
    process.env = { ...originalEnv };
    delete process.env.REACT_APP_CANDOUR_WEB_REDIRECT_URI;
    delete process.env.REACT_APP_CANDOUR_NATIVE_REDIRECT_URI;
    delete process.env.REACT_APP_CANDOUR_REDIRECT_URI;
    window.history.replaceState({}, "", "http://localhost/tabs/menu");
    isNativePlatformSpy = jest
      .spyOn(Capacitor, "isNativePlatform")
      .mockReturnValue(false);
  });

  afterEach(() => {
    isNativePlatformSpy.mockRestore();
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it("removes bridgeToApp from the explicit Candour web callback override in browser mode", () => {
    process.env.REACT_APP_CANDOUR_WEB_REDIRECT_URI =
      "https://bridge.example/callback?provider=candour&bridgeToApp=1";

    expect(getIdentityVerificationRedirectUri("candour")).toBe(
      "https://bridge.example/callback?provider=candour"
    );
  });

  it("treats the legacy Candour redirect override as native when it is a custom scheme", () => {
    process.env.REACT_APP_CANDOUR_REDIRECT_URI =
      "org.cardanofoundation.idw://fayda/callback?provider=candour";

    expect(getIdentityVerificationNativeRedirectUri("candour")).toBe(
      "org.cardanofoundation.idw://fayda/callback?provider=candour"
    );
    expect(getIdentityVerificationRedirectUri("candour")).toBe(
      "http://localhost/callback?provider=candour"
    );
  });

  it("keeps bridgeToApp in the Candour web callback override for native mode", () => {
    isNativePlatformSpy.mockReturnValue(true);
    process.env.REACT_APP_CANDOUR_WEB_REDIRECT_URI =
      "https://bridge.example/callback?provider=candour";

    expect(getIdentityVerificationRedirectUri("candour")).toBe(
      "https://bridge.example/callback?provider=candour&bridgeToApp=1"
    );
  });

  it("builds the native Candour callback URI from the browser callback params", () => {
    process.env.REACT_APP_CANDOUR_NATIVE_REDIRECT_URI =
      "org.cardanofoundation.idw://fayda/callback?provider=candour";

    expect(
      buildIdentityVerificationNativeCallbackUri(
        "candour",
        "verificationSessionId=session-123&status=finished&bridgeToApp=1"
      )
    ).toBe(
      "org.cardanofoundation.idw://fayda/callback?provider=candour&verificationSessionId=session-123&status=finished"
    );
  });
});
