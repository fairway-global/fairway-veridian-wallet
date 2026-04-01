import { startFreeRASP } from "capacitor-freerasp";
import { initializeFreeRASP } from "./freerasp";

jest.mock("capacitor-freerasp", () => ({
  startFreeRASP: jest.fn(),
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
  const setThreatsDetected = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    process.env.APP_CERT_HASH = "release-cert-hash";
    process.env.APP_WATCHER_MAIL = "abrham@fairway.global";
    (startFreeRASP as jest.Mock).mockResolvedValue(true);
  });

  afterAll(() => {
    process.env.APP_CERT_HASH = originalAppCertHash;
    process.env.APP_WATCHER_MAIL = originalWatcherMail;
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
});
