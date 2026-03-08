import { createSlice, PayloadAction } from "@reduxjs/toolkit";
import { RootState } from "../index";

export type DashboardNotificationSource = "local" | "agent";
export type DashboardNotificationLevel = "info" | "success" | "warning" | "error";

export interface DashboardNotificationItem {
  id: string;
  source: DashboardNotificationSource;
  type: string;
  title: string;
  message: string;
  createdAt: string;
  level: DashboardNotificationLevel;
  read: boolean;
}

interface NotificationsState {
  items: DashboardNotificationItem[];
}

const STORAGE_KEY = "credential_server_ui_notifications_v1";
const MAX_NOTIFICATIONS = 300;

function normalizeDate(value: string): string {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return new Date().toISOString();
  }
  return parsed.toISOString();
}

function loadInitialState(): NotificationsState {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return { items: [] };
    }
    const parsed = JSON.parse(raw) as NotificationsState;
    if (!Array.isArray(parsed.items)) {
      return { items: [] };
    }
    return {
      items: parsed.items
        .filter((item) => item && item.id)
        .map((item) => ({
          ...item,
          read: Boolean(item.read),
          createdAt: normalizeDate(item.createdAt),
        })),
    };
  } catch {
    return { items: [] };
  }
}

function persistState(state: NotificationsState): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // Ignore storage errors.
  }
}

const notificationsSlice = createSlice({
  name: "notifications",
  initialState: loadInitialState(),
  reducers: {
    addNotifications: (
      state,
      action: PayloadAction<DashboardNotificationItem[]>
    ) => {
      if (!action.payload.length) {
        return;
      }

      const knownIds = new Set(state.items.map((item) => item.id));
      const incoming = action.payload
        .filter((item) => item.id && !knownIds.has(item.id))
        .map((item) => ({
          ...item,
          read: Boolean(item.read),
          createdAt: normalizeDate(item.createdAt),
        }));

      if (!incoming.length) {
        return;
      }

      state.items = [...incoming, ...state.items]
        .sort(
          (a, b) =>
            new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        )
        .slice(0, MAX_NOTIFICATIONS);
      persistState(state);
    },
    markNotificationRead: (state, action: PayloadAction<string>) => {
      const notification = state.items.find(
        (item) => item.id === action.payload
      );
      if (!notification || notification.read) {
        return;
      }
      notification.read = true;
      persistState(state);
    },
    markAllNotificationsRead: (state) => {
      let changed = false;
      state.items = state.items.map((item) => {
        if (item.read) {
          return item;
        }
        changed = true;
        return {
          ...item,
          read: true,
        };
      });
      if (changed) {
        persistState(state);
      }
    },
    clearNotifications: (state) => {
      state.items = [];
      persistState(state);
    },
  },
});

export const {
  addNotifications,
  markNotificationRead,
  markAllNotificationsRead,
  clearNotifications,
} = notificationsSlice.actions;

export const getNotifications = (state: RootState) => state.notifications.items;
export const getUnreadNotificationsCount = (state: RootState) =>
  state.notifications.items.filter((item) => !item.read).length;

export default notificationsSlice.reducer;
