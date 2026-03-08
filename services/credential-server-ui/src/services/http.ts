import axios from "axios";
import { config } from "../config";
import { store } from "../store";
import { clearSession, setSession } from "../store/reducers/authSlice";

const httpInstance = axios.create({
  baseURL: config.endpoint,
});

const refreshClient = axios.create({
  baseURL: config.endpoint,
});

httpInstance.interceptors.request.use((requestConfig) => {
  const state = store.getState();
  const token = state.auth.accessToken;
  if (token) {
    requestConfig.headers = requestConfig.headers || {};
    requestConfig.headers.Authorization = `Bearer ${token}`;
  }
  return requestConfig;
});

httpInstance.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalConfig = error.config as
      | (typeof error.config & { _retry?: boolean })
      | undefined;

    if (!originalConfig) {
      return Promise.reject(error);
    }

    const statusCode = Number(error.response?.status || 0);
    const path = String(originalConfig.url || "");
    const isAuthRefreshCall = path.includes(config.path.authRefreshV2);
    const isAuthLoginCall = path.includes(config.path.authLoginV2);
    if (statusCode !== 401 || isAuthRefreshCall || isAuthLoginCall) {
      return Promise.reject(error);
    }

    if (originalConfig._retry) {
      store.dispatch(clearSession());
      return Promise.reject(error);
    }
    originalConfig._retry = true;

    const refreshToken = store.getState().auth.refreshToken;
    if (!refreshToken) {
      store.dispatch(clearSession());
      return Promise.reject(error);
    }

    try {
      const refreshResponse = await refreshClient.post(config.path.authRefreshV2, {
        refreshToken,
      });
      const data = refreshResponse.data?.data;
      if (!data?.accessToken || !data?.refreshToken || !data?.user) {
        store.dispatch(clearSession());
        return Promise.reject(error);
      }

      store.dispatch(
        setSession({
          accessToken: data.accessToken,
          refreshToken: data.refreshToken,
          user: data.user,
        })
      );
      originalConfig.headers = originalConfig.headers || {};
      originalConfig.headers.Authorization = `Bearer ${data.accessToken}`;
      return httpInstance(originalConfig);
    } catch (refreshError) {
      store.dispatch(clearSession());
      return Promise.reject(refreshError);
    }
  }
);

export { httpInstance };
