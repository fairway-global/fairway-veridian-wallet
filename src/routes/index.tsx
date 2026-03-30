import { IonRouterOutlet } from "@ionic/react";
import { useEffect } from "react";
import { Redirect, Route } from "react-router-dom";
import { useAppDispatch, useAppSelector } from "../store/hooks";
import {
  getRoutes,
  getStateCache,
  setCurrentRoute,
} from "../store/reducers/stateCache";
import { TabsMenu } from "../ui/components/navigation/TabsMenu";
import { CreatePassword } from "../ui/pages/CreatePassword";
import { CreateSSIAgent } from "../ui/pages/CreateSSIAgent";
import { GenerateSeedPhrase } from "../ui/pages/GenerateSeedPhrase";
import { Onboarding } from "../ui/pages/Onboarding";
import { SetPasscode } from "../ui/pages/SetPasscode";
import { SetupBiometrics } from "../ui/pages/SetupBiometrics/SetupBiometrics";
import { VerifyRecoverySeedPhrase } from "../ui/pages/VerifyRecoverySeedPhrase";
import { VerifySeedPhrase } from "../ui/pages/VerifySeedPhrase";
import { getNextRoute } from "./nextRoute";
import { RoutePath } from "./paths";
import { FaydaCallback } from "../ui/pages/faydaCallback/FaydaCallback";

const Routes = ({ className }: { className?: string }) => {
  const stateCache = useAppSelector(getStateCache);
  const dispatch = useAppDispatch();
  const routes = useAppSelector(getRoutes);

  const { nextPath } = getNextRoute(RoutePath.ROOT, {
    store: { stateCache },
  });

  useEffect(() => {
    if (!routes.length) dispatch(setCurrentRoute({ path: nextPath.pathname }));
  }, [routes, nextPath.pathname, dispatch]);

  return (
    <IonRouterOutlet
      animated={false}
      className={className}
    >
      <Route
        path={RoutePath.SET_PASSCODE}
        component={SetPasscode}
        exact
      />
      <Route
        path={RoutePath.ONBOARDING}
        component={Onboarding}
        exact
      />
      <Route
        path={RoutePath.GENERATE_SEED_PHRASE}
        component={GenerateSeedPhrase}
        exact
      />
      <Route
        path={RoutePath.VERIFY_SEED_PHRASE}
        component={VerifySeedPhrase}
        exact
      />
      <Route
        path={RoutePath.TABS_MENU}
        component={TabsMenu}
      />
      <Route
        path={RoutePath.CREATE_PASSWORD}
        component={CreatePassword}
        exact
      />
      <Route
        path={RoutePath.VERIFY_RECOVERY_SEED_PHRASE}
        component={VerifyRecoverySeedPhrase}
        exact
      />

      <Route
        path={RoutePath.SSI_AGENT}
        component={CreateSSIAgent}
        exact
      />
      <Route
        path={RoutePath.SETUP_BIOMETRICS}
        component={SetupBiometrics}
        exact
      />
      <Redirect
        exact
        from="/"
        to={nextPath}
      />
      <Route
        path="/callback"
        component={FaydaCallback}
        exact
      />
    </IonRouterOutlet>
  );
};

export { RoutePath, Routes };
