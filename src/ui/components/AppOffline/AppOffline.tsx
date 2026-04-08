import { IonSpinner } from "@ionic/react";
import { useEffect, useState } from "react";
import { i18n } from "../../../i18n";
import { ResponsivePageLayout } from "../layout/ResponsivePageLayout";
import "./AppOffline.scss";
import { useExitAppWithDoubleTap } from "../../hooks/exitAppWithDoubleTapHook";
import { BackEventPriorityType } from "../../globals/types";
import { useAppSelector } from "../../../store/hooks";
import {
  getAuthentication,
  getIsOnline,
} from "../../../store/reducers/stateCache";

const OFFLINE_PAGE_DELAY_MS = 1200;

const AppOfflinePage = () => {
  const loggedIn = useAppSelector(getAuthentication).loggedIn;

  // NOTE: Prevent all registered hardware back button of other pages instead of lock page.
  useExitAppWithDoubleTap(!loggedIn, BackEventPriorityType.LockPage);

  return (
    <ResponsivePageLayout
      activeStatus
      pageId="offline"
      customClass="offline-page"
    >
      <div className="page-content-container">
        <div className="page-content">
          <h1>{i18n.t("offline.title")}</h1>
          <p>{i18n.t("offline.description")}</p>
        </div>
        <IonSpinner name="circular" />
      </div>
    </ResponsivePageLayout>
  );
};

const AppOffline = () => {
  const ssiAgentIsSet = useAppSelector(getAuthentication).ssiAgentIsSet;
  const isOnline = useAppSelector(getIsOnline);
  const [delayElapsed, setDelayElapsed] = useState(false);

  const shouldShowOfflinePage = ssiAgentIsSet && !isOnline;

  useEffect(() => {
    if (!shouldShowOfflinePage) {
      setDelayElapsed(false);
      return;
    }

    const timerId = window.setTimeout(() => {
      setDelayElapsed(true);
    }, OFFLINE_PAGE_DELAY_MS);

    return () => {
      window.clearTimeout(timerId);
    };
  }, [shouldShowOfflinePage]);

  if (!shouldShowOfflinePage || !delayElapsed) return null;

  return <AppOfflinePage />;
};

export { AppOffline, OFFLINE_PAGE_DELAY_MS };
