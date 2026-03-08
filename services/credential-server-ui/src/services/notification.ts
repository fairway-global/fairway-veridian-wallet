import { config } from "../config";
import { httpInstance } from "./http";

interface ApiEnvelope<T> {
  success: boolean;
  data: T;
  error: string | null;
}

export interface AgentNotificationItem {
  id: string;
  route: string;
  said: string;
  createdAt: string;
  raw: Record<string, unknown>;
}

interface AgentNotificationsResponse {
  items: AgentNotificationItem[];
  total: number;
}

const NotificationService = {
  list: async (options?: { consume?: boolean }): Promise<AgentNotificationItem[]> => {
    const consume = options?.consume ?? true;
    const response = await httpInstance.get<ApiEnvelope<AgentNotificationsResponse>>(
      config.path.notificationsV2,
      {
        params: {
          consume,
        },
      }
    );
    return response.data.data.items || [];
  },
};

export { NotificationService };
