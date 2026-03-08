import { config } from "../config";
import { httpInstance } from "./http";

interface ApiEnvelope<T> {
  success: boolean;
  data: T;
  error: string | null;
}

export type ManagedRole = "issuer" | "verifier";
export type ChangeRequestField = "issuer_name" | "email";
export type ChangeRequestStatus = "pending" | "approved" | "rejected";

export interface ManagedUser {
  id: string;
  issuerId: string;
  issuerCode: string;
  issuerName: string;
  email: string;
  role: ManagedRole;
  isActive: boolean;
  lastLoginAt: string | null;
  createdAt: string;
  updatedAt: string;
  aidAlias: string | null;
  aidPrefix: string | null;
}

export interface AccountChangeRequest {
  id: string;
  userId: string;
  issuerId: string;
  fieldName: ChangeRequestField;
  currentValue: string;
  requestedValue: string;
  reason: string | null;
  status: ChangeRequestStatus;
  createdAt: string;
  updatedAt: string;
  reviewedAt: string | null;
  reviewedBy: string | null;
  adminNote: string | null;
  userEmail?: string;
  userRole?: ManagedRole;
  issuerCode?: string;
  issuerName?: string;
  reviewedByEmail?: string;
}

const AdminService = {
  listUsers: async (): Promise<ManagedUser[]> => {
    const response = await httpInstance.get<ApiEnvelope<ManagedUser[]>>(
      config.path.adminUsersV2
    );
    return response.data.data;
  },

  createUser: async (payload: {
    email: string;
    password: string;
    role: ManagedRole;
    displayName?: string;
  }): Promise<ManagedUser> => {
    const response = await httpInstance.post<ApiEnvelope<ManagedUser>>(
      config.path.adminUsersV2,
      payload
    );
    return response.data.data;
  },

  updateUserStatus: async (
    userId: string,
    isActive: boolean
  ): Promise<ManagedUser> => {
    const response = await httpInstance.patch<ApiEnvelope<ManagedUser>>(
      config.path.adminUserByIdV2.replace(":id", userId),
      { isActive }
    );
    return response.data.data;
  },

  listRequests: async (status?: ChangeRequestStatus): Promise<AccountChangeRequest[]> => {
    const response = await httpInstance.get<ApiEnvelope<AccountChangeRequest[]>>(
      config.path.adminRequestsV2,
      {
        params: status ? { status } : undefined,
      }
    );
    return response.data.data;
  },

  reviewRequest: async (
    requestId: string,
    payload: {
      status: Exclude<ChangeRequestStatus, "pending">;
      adminNote?: string;
    }
  ): Promise<AccountChangeRequest> => {
    const response = await httpInstance.patch<ApiEnvelope<AccountChangeRequest>>(
      config.path.adminRequestByIdV2.replace(":id", requestId),
      payload
    );
    return response.data.data;
  },
};

export { AdminService };
