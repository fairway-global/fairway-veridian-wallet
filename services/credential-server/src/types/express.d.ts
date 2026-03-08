import { AuthSessionUser } from "../services/authService";
import { IssuerRuntime } from "../services/issuerSignifyService";

declare global {
  namespace Express {
    interface Request {
      authUser?: AuthSessionUser;
      issuerRuntime?: IssuerRuntime;
      gatewayToken?: {
        issuerId: string;
        scope: string;
        jti: string;
        exp: number;
      };
    }
  }
}

export {};

