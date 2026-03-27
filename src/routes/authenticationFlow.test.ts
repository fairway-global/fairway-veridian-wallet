import { RootState } from "../store";
import { InitializationPhase } from "../store/reducers/stateCache/stateCache.types";
import { OperationType } from "../ui/globals/types";
import { CredentialsFilters } from "../ui/pages/Credentials/Credentials.types";
import { IdentifiersFilters } from "../ui/pages/Identifiers/Identifiers.types";
import { getPreviousRoute } from "./backRoute/backRoute";
import {
  getInitialRootRoute,
  getNextRootRoute,
} from "./nextRoute/nextRoute";
import { DataProps } from "./nextRoute/nextRoute.types";
import { RoutePath } from "./paths";

const makeStore = (
  authenticationOverrides: Partial<
    RootState["stateCache"]["authentication"]
  > = {},
  routes: { path: string }[] = []
) =>
  ({
    stateCache: {
      isOnline: true,
      initializationPhase: InitializationPhase.PHASE_TWO,
      recoveryCompleteNoInterruption: false,
      routes,
      authentication: {
        loggedIn: false,
        userName: "",
        time: 0,
        passcodeIsSet: false,
        seedPhraseIsSet: false,
        passwordIsSet: false,
        passwordIsSkipped: false,
        ssiAgentIsSet: false,
        ssiAgentUrl: "",
        recoveryWalletProgress: false,
        loginAttempt: {
          attempts: 0,
          lockedUntil: Date.now(),
        },
        firstAppLaunch: false,
        finishSetupBiometrics: false,
        ...authenticationOverrides,
      },
      showConnections: false,
      toastMsgs: [],
      currentOperation: OperationType.IDLE,
      queueIncomingRequest: {
        isProcessing: false,
        queues: [],
        isPaused: false,
      },
    },
    seedPhraseCache: {
      seedPhrase: "",
      bran: "",
    },
    identifiersCache: {
      identifiers: {},
      favourites: [],
      multiSigGroup: {
        groupId: "",
        connections: [],
      },
      filters: IdentifiersFilters.All,
    },
    credsCache: {
      creds: [],
      favourites: [],
      filters: CredentialsFilters.All,
    },
    credsArchivedCache: { creds: [] },
    connectionsCache: {
      connections: {},
      multisigConnections: {},
    },
    walletConnectionsCache: {
      walletConnections: [],
      connectedWallet: null,
      pendingConnection: null,
    },
    viewTypeCache: {
      identifier: {
        viewType: null,
        favouriteIndex: 0,
      },
      credential: {
        viewType: null,
        favouriteIndex: 0,
      },
    },
    biometricsCache: {
      enabled: false,
    },
    ssiAgentCache: {
      bootUrl: "",
      connectUrl: "",
    },
    notificationsCache: {
      notifications: [],
    },
    faydaVerifiedCache: { verified: false },
  } as RootState);

describe("authentication flow guards", () => {
  test("keeps a no-passcode user on onboarding even if stale password flags exist", () => {
    const data: DataProps = {
      store: makeStore({
        passcodeIsSet: false,
        finishSetupBiometrics: true,
        passwordIsSkipped: true,
      }),
    };

    expect(getNextRootRoute(data)).toEqual({
      pathname: RoutePath.ONBOARDING,
    });
  });

  test("continues onboarding when a passcode exists but the wallet is not created yet", () => {
    const data: DataProps = {
      store: makeStore({
        passcodeIsSet: true,
        finishSetupBiometrics: true,
        seedPhraseIsSet: false,
        ssiAgentIsSet: false,
      }),
    };

    expect(getNextRootRoute(data)).toEqual({
      pathname: RoutePath.CREATE_PASSWORD,
    });
  });

  test("starts at onboarding on app launch when no wallet exists yet", () => {
    const data: DataProps = {
      store: makeStore({
        passcodeIsSet: true,
        finishSetupBiometrics: true,
        passwordIsSet: true,
        passwordIsSkipped: true,
        seedPhraseIsSet: false,
        ssiAgentIsSet: false,
        recoveryWalletProgress: false,
      }),
    };

    expect(getInitialRootRoute(data)).toEqual({
      pathname: RoutePath.ONBOARDING,
    });
  });

  test("falls back to onboarding when back navigation has no history and only stale password flags remain", () => {
    const data: DataProps = {
      store: makeStore(
        {
          passcodeIsSet: false,
          passwordIsSkipped: true,
        },
        [{ path: RoutePath.CREATE_PASSWORD }]
      ),
    };

    expect(getPreviousRoute(data)).toEqual({
      pathname: RoutePath.ONBOARDING,
    });
  });
});
