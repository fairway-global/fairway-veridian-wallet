import "@fontsource/manrope/500.css";
import "@fontsource/manrope/600.css";
import { CheckCircleOutline, Close, WarningAmber } from "@mui/icons-material";
import { IconButton } from "@mui/material";
import CssBaseline from "@mui/material/CssBaseline";
import { ThemeProvider } from "@mui/material/styles";
import { closeSnackbar, SnackbarProvider } from "notistack";
import { useCallback, useEffect, useRef } from "react";
import { BrowserRouter, Navigate, Route, Routes } from "react-router";
import { config } from "./config";
import { RoutePath } from "./const/route";
import { Layout } from "./layouts/Layout";
import { RoleIndex } from "./components/NavBar/constants/roles";
import { i18n } from "./i18n";
import { Activities } from "./pages/Activities";
import { ConnectionDetails } from "./pages/ConnectionDetails/ConnectionDetails";
import { Connections } from "./pages/Connections";
import { NoPage } from "./pages/NoPage";
import { Notifications } from "./pages/Notifications";
import { Settings } from "./pages/Settings";
import { useAppDispatch, useAppSelector } from "./store/hooks";
import {
  fetchContactCredentials,
  fetchContacts,
  fetchPresentationRequests,
} from "./store/reducers/connectionsSlice";
import "./styles/colors.scss";
import { theme } from "./theme/theme"; // Import the theme
import {
  RequestPresentation,
  RequestPresentationDetail,
} from "./pages/RequestPresentation";
import { LocalizationProvider } from "@mui/x-date-pickers";
import { AdapterDayjs } from "@mui/x-date-pickers/AdapterDayjs";
import { fetchSchemas } from "./store/reducers/schemasSlice";
import { ReduxError } from "./components/ReduxError/ReduxError";
import {
  CredentialDetail,
  CredentialsList,
  IssueCredentialForm,
} from "./pages/CredentialsManagement";
import {
  TemplateCreate,
  TemplateDetail,
  TemplateEdit,
  TemplatesList,
} from "./pages/Templates";
import { Login } from "./pages/Login";
import { AdminUsers } from "./pages/AdminUsers/AdminUsers";
import { AdminRequests } from "./pages/AdminRequests/AdminRequests";
import {
  getAccessToken,
  getCurrentUser,
  getIsAuthenticated,
} from "./store/reducers/authSlice";
import { setRoleView } from "./store/reducers/stateCache";
import { triggerToast } from "./utils/toast";
import {
  addNotifications,
  clearNotifications,
  DashboardNotificationItem,
  getNotifications,
} from "./store/reducers/notificationsSlice";

const MIN_CONNECTION_REFRESH_INTERVAL_MS = 5000;
const MIN_CREDENTIAL_REFRESH_INTERVAL_MS = 4000;

const App = () => {
  const MAX_TOAST_MESSAGES = 10;
  const TOAST_MESSAGE_DURATION = 2000;

  const dispatch = useAppDispatch();
  const accessToken = useAppSelector(getAccessToken);
  const isAuthenticated = useAppSelector(getIsAuthenticated);
  const currentUser = useAppSelector(getCurrentUser);
  const notifications = useAppSelector(getNotifications);
  const isAdmin = currentUser?.role === "admin";
  const isVerifier = currentUser?.role === "verifier";
  const homePath = isAdmin ? RoutePath.AdminUsers : RoutePath.Activities;
  const eventSourceRef = useRef<EventSource | null>(null);
  const refreshContactsInFlightRef = useRef(false);
  const lastConnectionRefreshAtRef = useRef(0);
  const lastCredentialRefreshAtRef = useRef(0);
  const knownNotificationIdsRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    knownNotificationIdsRef.current = new Set(
      notifications.map((notification) => notification.id)
    );
  }, [notifications]);

  const mapLevelToToastVariant = useCallback(
    (level: DashboardNotificationItem["level"]): "success" | "error" | "warning" | "info" => {
      if (level === "success" || level === "error" || level === "warning") {
        return level;
      }
      return "info";
    },
    []
  );

  const mapAgentRouteToNotification = useCallback((
    route: string
  ): Pick<DashboardNotificationItem, "type" | "title" | "level"> => {
    const normalizedRoute = String(route || "").toLowerCase();

    if (
      normalizedRoute.includes("admit") ||
      normalizedRoute.includes("agree") ||
      normalizedRoute.includes("accept")
    ) {
      return {
        type: "credential_accepted",
        title: i18n.t("pages.notifications.events.credentialAccepted"),
        level: "success",
      };
    }

    if (
      normalizedRoute.includes("offer") ||
      normalizedRoute.includes("grant") ||
      normalizedRoute.includes("issue")
    ) {
      return {
        type: "credential_event",
        title: i18n.t("pages.notifications.events.credentialEvent"),
        level: "info",
      };
    }

    if (
      normalizedRoute.includes("apply") ||
      normalizedRoute.includes("presentation")
    ) {
      return {
        type: "presentation_event",
        title: i18n.t("pages.notifications.events.presentationEvent"),
        level: "info",
      };
    }

    return {
      type: "agent_event",
      title: i18n.t("pages.notifications.events.generic"),
      level: "info",
    };
  }, []);

  const queueNotifications = useCallback(
    (items: DashboardNotificationItem[]) => {
      const newItems = items.filter(
        (item) => item.id && !knownNotificationIdsRef.current.has(item.id)
      );

      if (!newItems.length) {
        return;
      }

      dispatch(addNotifications(newItems));
      newItems.slice(0, 3).forEach((item) => {
        triggerToast(item.title, mapLevelToToastVariant(item.level));
      });
    },
    [dispatch, mapLevelToToastVariant]
  );

  const refreshConnectionsAndCredentials = useCallback(async (
    contactIdsToRefresh?: string[]
  ) => {
    const now = Date.now();
    if (
      now - lastConnectionRefreshAtRef.current <
      MIN_CONNECTION_REFRESH_INTERVAL_MS
    ) {
      return;
    }
    if (refreshContactsInFlightRef.current) {
      return;
    }

    lastConnectionRefreshAtRef.current = now;
    refreshContactsInFlightRef.current = true;
    try {
      const contactsAction = await dispatch(fetchContacts());
      if (!fetchContacts.fulfilled.match(contactsAction)) {
        return;
      }

      const latestContacts = contactsAction.payload as Array<{ id: string }>;
      const normalizedContactIds = new Set(
        latestContacts
          .map((contact) => String(contact.id || "").trim())
          .filter(Boolean)
      );
      const targetedContactIds = Array.isArray(contactIdsToRefresh)
        ? contactIdsToRefresh
            .map((id) => String(id || "").trim())
            .filter((id) => normalizedContactIds.has(id))
        : [];
      const contactIds =
        targetedContactIds.length > 0
          ? targetedContactIds
          : Array.from(normalizedContactIds);

      await Promise.allSettled(
        contactIds.map((contactId) =>
          dispatch(fetchContactCredentials(contactId))
        )
      );
    } finally {
      refreshContactsInFlightRef.current = false;
    }
  }, [dispatch]);

  const handleRealtimeEvent = useCallback(
    (rawData: string) => {
      let parsedEvent: {
        id?: string;
        type?: string;
        createdAt?: string;
        payload?: Record<string, unknown>;
        notification?: {
          title?: string;
          message?: string;
          level?: DashboardNotificationItem["level"];
        } | null;
      } = {};

      try {
        parsedEvent = JSON.parse(rawData || "{}") as typeof parsedEvent;
      } catch {
        return;
      }

      const eventType = String(parsedEvent.type || "").trim();
      if (!eventType) {
        return;
      }

      if (eventType === "connections.refresh") {
        const addedContactIds = Array.isArray(parsedEvent.payload?.addedContactIds)
          ? (parsedEvent.payload?.addedContactIds as unknown[])
              .map((item) => String(item || "").trim())
              .filter(Boolean)
          : undefined;
        void refreshConnectionsAndCredentials(addedContactIds);
      }

      if (eventType === "credentials.refresh") {
        const now = Date.now();
        if (
          now - lastCredentialRefreshAtRef.current <
          MIN_CREDENTIAL_REFRESH_INTERVAL_MS
        ) {
          return;
        }
        lastCredentialRefreshAtRef.current = now;
        window.dispatchEvent(new CustomEvent("dashboard:credentials-refresh"));
      }

      if (eventType === "presentation_requests.refresh" && isVerifier) {
        void dispatch(fetchPresentationRequests());
      }

      const notification = parsedEvent.notification;
      const hasNotification =
        Boolean(notification?.title) && Boolean(notification?.message);
      if (!hasNotification) {
        return;
      }

      const route = String(parsedEvent.payload?.route || "");
      const routeInfo = route
        ? mapAgentRouteToNotification(route)
        : {
            type: eventType,
            title: String(notification?.title || ""),
            level: (notification?.level || "info") as DashboardNotificationItem["level"],
          };

      queueNotifications([
        {
          id:
            String(parsedEvent.id || "").trim() ||
            `stream:${eventType}:${Date.now()}`,
          source: "agent",
          type: routeInfo.type,
          title: String(notification?.title || routeInfo.title),
          message: String(notification?.message || ""),
          createdAt: String(parsedEvent.createdAt || new Date().toISOString()),
          level: (notification?.level || routeInfo.level) as DashboardNotificationItem["level"],
          read: false,
        },
      ]);
    },
    [
      dispatch,
      isVerifier,
      mapAgentRouteToNotification,
      queueNotifications,
      refreshConnectionsAndCredentials,
    ]
  );

  useEffect(() => {
    if (isAdmin) {
      return;
    }
    dispatch(setRoleView(isVerifier ? RoleIndex.VERIFIER : RoleIndex.ISSUER));
  }, [dispatch, isAdmin, isVerifier]);

  useEffect(() => {
    if (isAuthenticated && !isAdmin) {
      dispatch(fetchSchemas());
      void refreshConnectionsAndCredentials();
      if (isVerifier) {
        void dispatch(fetchPresentationRequests());
      }
    }
  }, [
    dispatch,
    isAdmin,
    isAuthenticated,
    isVerifier,
    refreshConnectionsAndCredentials,
  ]);

  useEffect(() => {
    if (isAuthenticated || isAdmin) {
      return;
    }
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }
    dispatch(clearNotifications());
  }, [dispatch, isAdmin, isAuthenticated]);

  useEffect(() => {
    if (!isAuthenticated || isAdmin || !accessToken) {
      return;
    }

    const streamUrl =
      `${config.endpoint}${config.path.eventsStreamV2}` +
      `?accessToken=${encodeURIComponent(accessToken)}`;
    const eventSource = new EventSource(streamUrl);
    eventSourceRef.current = eventSource;

    eventSource.onmessage = (event: MessageEvent<string>) => {
      handleRealtimeEvent(event.data);
    };

    eventSource.onerror = () => {
      // Native EventSource automatically retries; keep handler to avoid uncaught errors.
    };

    return () => {
      eventSource.close();
      if (eventSourceRef.current === eventSource) {
        eventSourceRef.current = null;
      }
    };
  }, [accessToken, handleRealtimeEvent, isAdmin, isAuthenticated]);

  return (
    <LocalizationProvider dateAdapter={AdapterDayjs}>
      <ThemeProvider theme={theme}>
        <CssBaseline />
        <SnackbarProvider
          maxSnack={MAX_TOAST_MESSAGES}
          autoHideDuration={TOAST_MESSAGE_DURATION}
          iconVariant={{
            success: <CheckCircleOutline />,
            error: <WarningAmber />,
          }}
          action={(snackbarId) => (
            <IconButton
              aria-label="actions"
              onClick={() => closeSnackbar(snackbarId)}
            >
              <Close />
            </IconButton>
          )}
        >
          <BrowserRouter>
            <Routes>
              <Route
                path={RoutePath.Login}
                element={
                  isAuthenticated ? (
                    <Navigate
                      to={homePath}
                      replace
                    />
                  ) : (
                    <Login />
                  )
                }
              />
              <Route
                path={RoutePath.AdminLogin}
                element={
                  isAuthenticated ? (
                    <Navigate
                      to={homePath}
                      replace
                    />
                  ) : (
                    <Login />
                  )
                }
              />
              <Route
                path={RoutePath.VerifierLogin}
                element={
                  isAuthenticated ? (
                    <Navigate
                      to={RoutePath.Activities}
                      replace
                    />
                  ) : (
                    <Navigate
                      to={RoutePath.Login}
                      replace
                    />
                  )
                }
              />
              <Route
                path="/"
                element={
                  isAuthenticated ? (
                    <Layout
                      mode={isAdmin ? "admin" : isVerifier ? "verifier" : "issuer"}
                    />
                  ) : (
                    <Navigate
                      to={RoutePath.Login}
                      replace
                    />
                  )
                }
              >
                {/* TODO: Bring back when we're ready to ship Overview */}
                {/* <Route
                index
                element={<Overview />}
              /> */}
                  <Route
                    index
                    element={
                      isAdmin ? (
                        <Navigate
                          to={RoutePath.AdminUsers}
                          replace
                        />
                      ) : (
                        <Activities />
                      )
                    }
                  />
                  <Route
                    path={RoutePath.Connections}
                    element={
                      isAdmin ? (
                        <Navigate
                          to={RoutePath.AdminUsers}
                          replace
                        />
                      ) : (
                        <Connections />
                      )
                    }
                  />
                  <Route
                    path={RoutePath.AdminUsers}
                    element={
                      isAdmin ? (
                        <AdminUsers />
                      ) : (
                        <Navigate
                          to={RoutePath.Activities}
                          replace
                        />
                      )
                    }
                  />
                  <Route
                    path={RoutePath.AdminRequests}
                    element={
                      isAdmin ? (
                        <AdminRequests />
                      ) : (
                        <Navigate
                          to={RoutePath.Activities}
                          replace
                        />
                      )
                    }
                  />
                  <Route
                    path={RoutePath.ConnectionDetails}
                    element={
                      isAdmin ? (
                        <Navigate
                          to={RoutePath.AdminUsers}
                          replace
                        />
                      ) : (
                        <ConnectionDetails />
                      )
                    }
                  />
                  <Route
                    path={RoutePath.Templates}
                    element={
                      isAdmin || isVerifier ? (
                        <Navigate
                          to={homePath}
                          replace
                        />
                      ) : (
                      <TemplatesList />
                    )
                  }
                />
                  <Route
                    path={RoutePath.TemplateCreate}
                    element={
                      isAdmin || isVerifier ? (
                        <Navigate
                          to={homePath}
                          replace
                        />
                      ) : (
                      <TemplateCreate />
                    )
                  }
                />
                  <Route
                    path={RoutePath.TemplateDetail}
                    element={
                      isAdmin || isVerifier ? (
                        <Navigate
                          to={homePath}
                          replace
                        />
                      ) : (
                      <TemplateDetail />
                    )
                  }
                />
                  <Route
                    path={RoutePath.TemplateEdit}
                    element={
                      isAdmin || isVerifier ? (
                        <Navigate
                          to={homePath}
                          replace
                        />
                      ) : (
                      <TemplateEdit />
                    )
                  }
                />
                  <Route
                    path={RoutePath.Credentials}
                    element={
                      isAdmin || isVerifier ? (
                        <Navigate
                          to={homePath}
                          replace
                        />
                      ) : (
                      <CredentialsList />
                    )
                  }
                />
                  <Route
                    path={RoutePath.IssueCredential}
                    element={
                      isAdmin || isVerifier ? (
                        <Navigate
                          to={homePath}
                          replace
                        />
                      ) : (
                      <IssueCredentialForm />
                    )
                  }
                />
                  <Route
                    path={RoutePath.CredentialDetails}
                    element={
                      isAdmin || isVerifier ? (
                        <Navigate
                          to={homePath}
                          replace
                        />
                      ) : (
                      <CredentialDetail />
                    )
                  }
                />
                <Route
                    path={RoutePath.Notifications}
                    element={
                      isAdmin ? (
                        <Navigate
                          to={RoutePath.AdminUsers}
                          replace
                        />
                      ) : (
                        <Notifications />
                      )
                    }
                  />
                  <Route
                    path={RoutePath.Settings}
                    element={
                      isAdmin ? (
                        <Navigate
                          to={RoutePath.AdminUsers}
                          replace
                        />
                      ) : (
                        <Settings />
                      )
                    }
                  />
                  <Route
                    path={RoutePath.RequestPresentation}
                    element={
                      isAdmin ? (
                        <Navigate
                          to={RoutePath.AdminUsers}
                          replace
                        />
                      ) : isVerifier ? (
                        <RequestPresentation />
                      ) : (
                      <Navigate
                        to={RoutePath.Activities}
                        replace
                      />
                    )
                  }
                />
                <Route
                  path={RoutePath.RequestPresentationDetail}
                  element={
                    isAdmin ? (
                      <Navigate
                        to={RoutePath.AdminUsers}
                        replace
                      />
                    ) : isVerifier ? (
                      <RequestPresentationDetail />
                    ) : (
                      <Navigate
                        to={RoutePath.Activities}
                        replace
                      />
                    )
                  }
                />
                <Route
                  path="*"
                  element={<NoPage />}
                />
              </Route>
            </Routes>
          </BrowserRouter>
        </SnackbarProvider>
      </ThemeProvider>
      <ReduxError />
    </LocalizationProvider>
  );
};

export { App };
