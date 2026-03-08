import { config } from "../config";
import { httpInstance } from "./http";
import {
  AccountChangeRequest,
  ChangeRequestField,
} from "./admin";

interface ApiEnvelope<T> {
  success: boolean;
  data: T;
  error: string | null;
}

export interface AccountProfile {
  id: string;
  email: string;
  role: "issuer" | "verifier";
  issuerId: string;
  issuerCode: string;
  issuerName: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  lastLoginAt: string | null;
  keria: {
    aidAlias: string;
    aidPrefix: string;
    registryRegk: string;
    initializedAt: string | null;
  };
}

const AccountService = {
  profile: async (): Promise<AccountProfile> => {
    const response = await httpInstance.get<ApiEnvelope<AccountProfile>>(
      config.path.accountProfileV2
    );
    return response.data.data;
  },

  listRequests: async (): Promise<AccountChangeRequest[]> => {
    const response = await httpInstance.get<ApiEnvelope<AccountChangeRequest[]>>(
      config.path.accountRequestsV2
    );
    return response.data.data;
  },

  createRequest: async (payload: {
    fieldName: ChangeRequestField;
    requestedValue: string;
    reason?: string;
  }): Promise<AccountChangeRequest> => {
    const response = await httpInstance.post<ApiEnvelope<AccountChangeRequest>>(
      config.path.accountRequestsV2,
      payload
    );
    return response.data.data;
  },
};

export { AccountService };
