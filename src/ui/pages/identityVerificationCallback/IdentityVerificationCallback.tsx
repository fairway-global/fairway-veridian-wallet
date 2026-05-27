import { useLocation } from "react-router-dom";
import { getIdentityVerificationProvider } from "../../utils/identityVerification";
import { FaydaCallback } from "../faydaCallback/FaydaCallback";
import { CandourCallback } from "../candourCallback/CandourCallback";

export const IdentityVerificationCallback = () => {
  const location = useLocation();
  const params = new URLSearchParams(location.search);
  const provider = getIdentityVerificationProvider(
    params.get("provider") || undefined
  );

  return provider === "candour" ? <CandourCallback /> : <FaydaCallback />;
};
