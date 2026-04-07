import { config } from "../config";
import { httpInstance } from "./http";
import { DashboardUser } from "../store/reducers/authSlice";

interface ApiEnvelope<T> {
  success: boolean;
  data: T;
  error: string | null;
}

export interface AuthSessionResponse {
  accessToken: string;
  refreshToken: string;
  user: DashboardUser;
}

export interface PasswordResetRequestResponse {
  status: "sent" | "failed";
  reason:
    | "email_sent"
    | "account_not_found"
    | "multiple_accounts"
    | "inactive_user";
  message: string;
  accountExists: boolean;
}

export interface IssuerAccessRequestResponse {
  id: string;
  status: "pending" | "approved" | "rejected";
  message: string;
}

const AuthService = {
  login: async (payload: {
    email: string;
    password: string;
  }): Promise<AuthSessionResponse> => {
    const response = await httpInstance.post<ApiEnvelope<AuthSessionResponse>>(
      config.path.authLoginV2,
      payload
    );
    return response.data.data;
  },

  googleLogin: async (payload: {
    idToken: string;
  }): Promise<AuthSessionResponse> => {
    const response = await httpInstance.post<ApiEnvelope<AuthSessionResponse>>(
      config.path.authGoogleV2,
      payload
    );
    return response.data.data;
  },

  registerVerifier: async (payload: {
    displayName: string;
    organizationName?: string;
    email: string;
    password: string;
  }): Promise<AuthSessionResponse> => {
    const response = await httpInstance.post<ApiEnvelope<AuthSessionResponse>>(
      config.path.authRegisterVerifierV2,
      payload
    );
    return response.data.data;
  },

  registerVerifierWithGoogle: async (payload: {
    idToken: string;
    organizationName?: string;
  }): Promise<AuthSessionResponse> => {
    const response = await httpInstance.post<ApiEnvelope<AuthSessionResponse>>(
      config.path.authRegisterVerifierGoogleV2,
      payload
    );
    return response.data.data;
  },

  requestIssuerAccess: async (payload: {
    organizationName: string;
    organizationType?: string;
    contactName: string;
    email: string;
    phoneNumber?: string;
    country?: string;
    website?: string;
    credentialUseCase: string;
    expectedVolume?: string;
    notes?: string;
  }): Promise<IssuerAccessRequestResponse> => {
    const response = await httpInstance.post<
      ApiEnvelope<IssuerAccessRequestResponse>
    >(config.path.authRequestIssuerV2, payload);
    return response.data.data;
  },

  requestPasswordReset: async (payload: {
    email: string;
  }): Promise<PasswordResetRequestResponse> => {
    const response = await httpInstance.post<
      ApiEnvelope<PasswordResetRequestResponse>
    >(config.path.authForgotPasswordV2, payload);
    return response.data.data;
  },

  resetPassword: async (payload: {
    token: string;
    password: string;
  }): Promise<{ reset: boolean }> => {
    const response = await httpInstance.post<
      ApiEnvelope<{ reset: boolean }>
    >(config.path.authResetPasswordV2, payload);
    return response.data.data;
  },

  refresh: async (refreshToken: string): Promise<AuthSessionResponse> => {
    const response = await httpInstance.post<ApiEnvelope<AuthSessionResponse>>(
      config.path.authRefreshV2,
      { refreshToken },
      {
        headers: {},
      }
    );
    return response.data.data;
  },

  logout: async (refreshToken: string): Promise<void> => {
    await httpInstance.post(config.path.authLogoutV2, { refreshToken });
  },

  me: async (): Promise<DashboardUser> => {
    const response = await httpInstance.get<ApiEnvelope<DashboardUser>>(
      config.path.authMeV2
    );
    return response.data.data;
  },
};

export { AuthService };
