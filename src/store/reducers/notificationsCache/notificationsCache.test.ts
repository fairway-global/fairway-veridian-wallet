
import { PayloadAction } from "@reduxjs/toolkit";
import { KeriaNotification } from "../../../core/agent/services/keriaNotificationService.types";
import { OperationType } from "../../../ui/globals/types";
import { RootState } from "../../index";
import {
  deleteNotificationById,
  getNotificationsCache,
  notificationsCacheSlice,
  setNotificationsCache,
  markNotificationAsRead,
  clearNotifications,
} from "./notificationsCache";
import { IdentifiersFilters } from "../../../ui/pages/Identifiers/Identifiers.types";
import { CredentialsFilters } from "../../../ui/pages/Credentials/Credentials.types";
import { InitializationPhase } from "../../reducers/stateCache/stateCache.types";

describe("notificationsCacheSlice", () => {
  const initialState = {
    notifications: [],
  };

  it("should handle clearNotifications", () => {
    const newState = notificationsCacheSlice.reducer(
      {
        notifications: [
          {
            id: "1",
            createdAt: "2024-01-01T00:00:00.000Z",
            a: { r: "", d: "", m: "" },
            connectionId: "conn-1",
            read: false,
            groupReplied: false,
          },
        ],
      },
      clearNotifications()
    );
    expect(newState.notifications).toEqual([]);
  });

  it("should handle setNotificationsCache", () => {
    const notifications: KeriaNotification[] = [
      {
        id: "AL3XmFY8BM9F604qmV-l9b0YMZNvshHG7X6CveMWKMmG",
        createdAt: "2024-06-25T12:38:36.988Z",
        a: {
          r: "/exn/ipex/grant",
          d: "EMT02ZHUhpnr4gFFk104B-pLwb2bJC8aip2VYmbPztnk",
          m: "",
        },
        connectionId: "EMrT7qX0FIMenQoe5pJLahxz_rheks1uIviGW8ch8pfB",
        read: true,
        groupReplied: false,
      },
    ];
    const newState = notificationsCacheSlice.reducer(
      initialState,
      setNotificationsCache(notifications)
    );
    expect(newState.notifications).toEqual(notifications);
  });

  it("should return the notifications cache from RootState", () => {
    const state: RootState = {
      stateCache: {
        isOnline: true,
        initializationPhase: InitializationPhase.PHASE_TWO,
        recoveryCompleteNoInterruption: false,
        routes: [],
        authentication: {
          loggedIn: false,
          userName: "",
          time: 0,
          passcodeIsSet: false,
          seedPhraseIsSet: false,
          passwordIsSet: false,
          passwordIsSkipped: true,
          ssiAgentIsSet: false,
          ssiAgentUrl: "",
          recoveryWalletProgress: false,
          loginAttempt: {
            attempts: 0,
            lockedUntil: Date.now(),
          },
          firstAppLaunch: false,
        },
        currentOperation: OperationType.IDLE,
        queueIncomingRequest: {
          isProcessing: false,
          queues: [],
          isPaused: false,
        },
        showConnections: false,
        toastMsgs: [],
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
    };
    const notificationsCache = getNotificationsCache(state);
    expect(notificationsCache).toEqual(state.notificationsCache.notifications);
  });
});
