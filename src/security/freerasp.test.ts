import { startFreeRASP } from "capacitor-freerasp";
import { Capacitor } from "@capacitor/core";
import { initializeFreeRASP } from "./freerasp";

jest.mock("capacitor-freerasp", () => ({
  startFreeRASP: jest.fn(),
}));

jest.mock("@capacitor/core", () => ({
  Capacitor: {
    getPlatform: jest.fn(() => "android"),
  },
}));

jest.mock("../core/configuration/configurationService", () => ({
  ConfigurationService: {
    env: {
      security: {
        rasp: {
          enabled: true,
        },
      },
    },
  },
}));

describe("initializeFreeRASP", () => {
  const originalAppCertHash = process.env.APP_CERT_HASH;
  const originalWatcherMail = process.env.APP_WATCHER_MAIL;
  const originalAppBundleId = process.env.APP_BUNDLE_ID;
  const originalAppTeamId = process.env.APP_TEAM_ID;
  const originalAllowXcodeDebug = process.env.APP_ALLOW_XCODE_DEBUG;
  const setThreatsDetected = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    process.env.APP_CERT_HASH = "release-cert-hash";
    process.env.APP_WATCHER_MAIL = "abrham@fairway.global";
    process.env.APP_BUNDLE_ID = "global.fairway.faydaidw";
    process.env.APP_TEAM_ID = "6DQG622GQY";
    delete process.env.APP_ALLOW_XCODE_DEBUG;
    (Capacitor.getPlatform as jest.Mock).mockReturnValue("android");
    (startFreeRASP as jest.Mock).mockResolvedValue(true);
  });

  afterAll(() => {
    process.env.APP_CERT_HASH = originalAppCertHash;
    process.env.APP_WATCHER_MAIL = originalWatcherMail;
    process.env.APP_BUNDLE_ID = originalAppBundleId;
    process.env.APP_TEAM_ID = originalAppTeamId;
    process.env.APP_ALLOW_XCODE_DEBUG = originalAllowXcodeDebug;
  });

  test("uses the Fairway watcher email and configured release certificate hash", async () => {
    await initializeFreeRASP(setThreatsDetected);

    expect(startFreeRASP).toHaveBeenCalledWith(
      expect.objectContaining({
        androidConfig: expect.objectContaining({
          certificateHashes: ["release-cert-hash"],
        }),
        watcherMail: "abrham@fairway.global",
      }),
      expect.any(Object)
    );
  });

  test("does not block on unofficial store warnings for signed side-loaded builds", async () => {
    await initializeFreeRASP(setThreatsDetected);

    const actions = (startFreeRASP as jest.Mock).mock.calls[0][1];
    actions.unofficialStore();

    expect(setThreatsDetected).not.toHaveBeenCalled();
  });

  test("does not block on obfuscation warning false positives", async () => {
    await initializeFreeRASP(setThreatsDetected);

    const actions = (startFreeRASP as jest.Mock).mock.calls[0][1];
    actions.obfuscationIssues();

    expect(setThreatsDetected).not.toHaveBeenCalled();
  });

  test("still blocks on real high-risk threats", async () => {
    await initializeFreeRASP(setThreatsDetected);

    const actions = (startFreeRASP as jest.Mock).mock.calls[0][1];
    actions.appIntegrity();

    expect(setThreatsDetected).toHaveBeenCalledTimes(1);
    expect(typeof setThreatsDetected.mock.calls[0][0]).toBe("function");
  });

  test("blocks debug threats by default", async () => {
    await initializeFreeRASP(setThreatsDetected);

    const actions = (startFreeRASP as jest.Mock).mock.calls[0][1];
    actions.debug();

    expect(setThreatsDetected).toHaveBeenCalledTimes(1);
    expect(typeof setThreatsDetected.mock.calls[0][0]).toBe("function");
  });

  test("uses non-blocking debug on iOS when Xcode debugging is allowed", async () => {
    process.env.APP_ALLOW_XCODE_DEBUG = "true";
    (Capacitor.getPlatform as jest.Mock).mockReturnValue("ios");

    await initializeFreeRASP(setThreatsDetected);

    const actions = (startFreeRASP as jest.Mock).mock.calls[0][1];
    actions.debug();

    expect(setThreatsDetected).not.toHaveBeenCalled();
  });

  test("uses the Fairway iOS bundle id and team id", async () => {
    (Capacitor.getPlatform as jest.Mock).mockReturnValue("ios");

    await initializeFreeRASP(setThreatsDetected);

    expect(startFreeRASP).toHaveBeenCalledWith(
      expect.objectContaining({
        iosConfig: {
          appBundleId: "global.fairway.faydaidw",
          appTeamId: "6DQG622GQY",
        },
      }),
      expect.any(Object)
    );
  });

  test("falls back to the Fairway iOS team id when APP_TEAM_ID is missing", async () => {
    delete process.env.APP_TEAM_ID;
    (Capacitor.getPlatform as jest.Mock).mockReturnValue("ios");

    await initializeFreeRASP(setThreatsDetected);

    expect(startFreeRASP).toHaveBeenCalledWith(
      expect.objectContaining({
        iosConfig: expect.objectContaining({
          appTeamId: "6DQG622GQY",
        }),
      }),
      expect.any(Object)
    );
  });

  test("uses non-blocking app integrity on iOS when APP_TEAM_ID is invalid", async () => {
    process.env.APP_TEAM_ID = "yourTeamID";
    (Capacitor.getPlatform as jest.Mock).mockReturnValue("ios");

    await initializeFreeRASP(setThreatsDetected);

    const actions = (startFreeRASP as jest.Mock).mock.calls[0][1];
    actions.appIntegrity();

    expect(setThreatsDetected).not.toHaveBeenCalled();
  });
});
