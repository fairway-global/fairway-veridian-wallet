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
