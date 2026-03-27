import { AuthenticationCacheProps } from "../store/reducers/stateCache";
import { RoutePath } from "./paths";

const WalletOnboardingRoutes = [
  RoutePath.ONBOARDING,
  RoutePath.SET_PASSCODE,
  RoutePath.SETUP_BIOMETRICS,
  RoutePath.CREATE_PASSWORD,
  RoutePath.GENERATE_SEED_PHRASE,
  RoutePath.VERIFY_SEED_PHRASE,
  RoutePath.VERIFY_RECOVERY_SEED_PHRASE,
  RoutePath.SSI_AGENT,
];

const hasWalletState = (authentication: AuthenticationCacheProps) =>
  authentication.seedPhraseIsSet ||
  authentication.ssiAgentIsSet ||
  authentication.recoveryWalletProgress;

const shouldRequireUnlock = (authentication: AuthenticationCacheProps) =>
  authentication.passcodeIsSet && hasWalletState(authentication);

const canResumePasswordCreation = (authentication: AuthenticationCacheProps) =>
  authentication.passcodeIsSet && !!authentication.finishSetupBiometrics;

const canResumeSeedPhraseCreation = (authentication: AuthenticationCacheProps) =>
  authentication.passcodeIsSet &&
  (authentication.passwordIsSet || authentication.passwordIsSkipped);

const isWalletOnboardingRoute = (path?: string) =>
  WalletOnboardingRoutes.includes(path as RoutePath);

export {
  canResumePasswordCreation,
  canResumeSeedPhraseCreation,
  hasWalletState,
  isWalletOnboardingRoute,
  shouldRequireUnlock,
};
