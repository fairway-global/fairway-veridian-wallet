import { config } from "../config";
import { httpInstance } from "./http";
import {
  CredentialTemplate,
  IssueCredentialPayload,
  ManagedCredential,
  TemplateDetail,
  TemplateUpsertInput,
} from "./template.types";

interface ApiEnvelope<T> {
  success: boolean;
  data: T;
  error: string | null;
}

const TemplateService = {
  list: async (): Promise<CredentialTemplate[]> => {
    const response = await httpInstance.get<ApiEnvelope<CredentialTemplate[]>>(
      config.path.templates
    );
    return response.data.data;
  },
  detail: async (templateId: string): Promise<TemplateDetail> => {
    const response = await httpInstance.get<ApiEnvelope<TemplateDetail>>(
      config.path.templateById.replace(":id", templateId)
    );
    return response.data.data;
  },
  create: async (payload: TemplateUpsertInput): Promise<CredentialTemplate> => {
    const response = await httpInstance.post<ApiEnvelope<CredentialTemplate>>(
      config.path.templates,
      payload
    );
    return response.data.data;
  },
  update: async (
    templateId: string,
    payload: TemplateUpsertInput
  ): Promise<CredentialTemplate> => {
    const response = await httpInstance.put<ApiEnvelope<CredentialTemplate>>(
      config.path.templateById.replace(":id", templateId),
      payload
    );
    return response.data.data;
  },
  remove: async (
    templateId: string
  ): Promise<{ id: string; deleted: boolean }> => {
    const response = await httpInstance.delete<
      ApiEnvelope<{ id: string; deleted: boolean }>
    >(config.path.templateById.replace(":id", templateId));
    return response.data.data;
  },
};

const ManagedCredentialService = {
  list: async (): Promise<ManagedCredential[]> => {
    const response = await httpInstance.get<ApiEnvelope<ManagedCredential[]>>(
      config.path.credentialsApi
    );
    return response.data.data;
  },
  detail: async (credentialId: string): Promise<ManagedCredential> => {
    const response = await httpInstance.get<ApiEnvelope<ManagedCredential>>(
      config.path.credentialById.replace(":id", credentialId)
    );
    return response.data.data;
  },
  issue: async (payload: IssueCredentialPayload): Promise<ManagedCredential> => {
    const response = await httpInstance.post<ApiEnvelope<ManagedCredential>>(
      config.path.issueCredentialApi,
      payload
    );
    return response.data.data;
  },
  revoke: async (
    credentialId: string,
    holder?: string
  ): Promise<{ id: string; status: string }> => {
    const response = await httpInstance.put<
      ApiEnvelope<{ id: string; status: string }>
    >(config.path.revokeCredentialApi.replace(":id", credentialId), {
      holder,
    });
    return response.data.data;
  },
  remove: async (credentialId: string): Promise<{ id: string; status: string }> => {
    const response = await httpInstance.delete<
      ApiEnvelope<{ id: string; status: string }>
    >(config.path.deleteCredentialApi.replace(":id", credentialId));
    return response.data.data;
  },
};

export { ManagedCredentialService, TemplateService };
