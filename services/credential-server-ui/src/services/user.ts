import { config } from "../config";
import { httpInstance } from "./http";

interface ApiEnvelope<T> {
  success: boolean;
  data: T;
  error: string | null;
}

export interface IssuerUser {
  id: string;
  issuerId: string;
  issuerCode?: string;
  issuerName?: string;
  email: string;
  role: "issuer" | "verifier";
  isActive: boolean;
  createdBy: string | null;
  lastLoginAt: string | null;
  createdAt: string;
  updatedAt: string;
}

const UserService = {
  list: async (): Promise<IssuerUser[]> => {
    const response = await httpInstance.get<ApiEnvelope<IssuerUser[]>>(
      config.path.adminUsersV2
    );
    return response.data.data;
  },

  create: async (payload: {
    email: string;
    password: string;
    role: "issuer" | "verifier";
    displayName?: string;
  }): Promise<IssuerUser> => {
    const response = await httpInstance.post<ApiEnvelope<IssuerUser>>(
      config.path.adminUsersV2,
      payload
    );
    return response.data.data;
  },

  update: async (
    userId: string,
    payload: {
      isActive?: boolean;
    }
  ): Promise<IssuerUser> => {
    const response = await httpInstance.patch<ApiEnvelope<IssuerUser>>(
      config.path.adminUserByIdV2.replace(":id", userId),
      payload
    );
    return response.data.data;
  },
};

export { UserService };
