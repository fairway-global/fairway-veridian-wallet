import { randomUUID } from "crypto";
import { Response } from "express";
import { SignifyClient } from "signify-ts";
import { IssuerRuntime, IssuerSignifyService } from "./issuerSignifyService";
import { processPresentationRequestNotification } from "./presentationRequestService";

export type RealtimeEventLevel = "info" | "success" | "warning" | "error";

export interface RealtimeEventNotification {
  title: string;
  message: string;
  level: RealtimeEventLevel;
}

export interface RealtimeEventPayload {
  id?: string;
  type: string;
  createdAt?: string;
  payload?: Record<string, unknown>;
  notification?: RealtimeEventNotification;
}

interface IssuerWatcherState {
  timer?: NodeJS.Timeout;
  lastContactIds: Set<string>;
  seenNotificationIds: Set<string>;
}

interface SubscriberState {
  res: Response;
  keepAliveTimer: NodeJS.Timeout;
}

const WATCH_INTERVAL_MS = 6000;
const KEEP_ALIVE_INTERVAL_MS = 25000;

function normalizeString(value: unknown): string {
  if (value === undefined || value === null) {
    return "";
  }
  return String(value).trim();
}

function getNotes(input: unknown): Array<Record<string, unknown>> {
  if (!input || typeof input !== "object") {
    return [];
  }
  const notes = (input as { notes?: unknown }).notes;
  return Array.isArray(notes)
    ? notes.filter((item) => item && typeof item === "object")
    : [];
}

function getContactIds(rawContacts: unknown, localAidPrefix: string): Set<string> {
  if (!Array.isArray(rawContacts)) {
    return new Set<string>();
  }

  const ids = rawContacts
    .map((contact) => contact as { id?: unknown; alias?: unknown })
    .filter((contact) => {
      const id = normalizeString(contact.id);
      const alias = normalizeString(contact.alias);
      if (!id) {
        return false;
      }
      if (id.startsWith("0AA") || alias.startsWith("0AA")) {
        return false;
      }
      if (localAidPrefix && id === localAidPrefix) {
        return false;
      }
      return true;
    })
    .map((contact) => normalizeString(contact.id))
    .filter(Boolean);

  return new Set(ids);
}

export class RealtimeEventService {
  private subscribersByIssuer = new Map<string, Map<string, SubscriberState>>();
  private watcherStateByIssuer = new Map<string, IssuerWatcherState>();

  constructor(private issuerSignifyService: IssuerSignifyService) {}

  subscribe(issuerId: string, res: Response): () => void {
    const normalizedIssuerId = normalizeString(issuerId);
    if (!normalizedIssuerId) {
      throw new Error("Issuer id is required for realtime subscription");
    }

    res.status(200);
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    res.setHeader("X-Accel-Buffering", "no");
    (res as unknown as { flushHeaders?: () => void }).flushHeaders?.();

    const subscriberId = randomUUID();
    const issuerSubscribers =
      this.subscribersByIssuer.get(normalizedIssuerId) ||
      new Map<string, SubscriberState>();

    const keepAliveTimer = setInterval(() => {
      res.write(": keep-alive\n\n");
    }, KEEP_ALIVE_INTERVAL_MS);

    issuerSubscribers.set(subscriberId, {
      res,
      keepAliveTimer,
    });
    this.subscribersByIssuer.set(normalizedIssuerId, issuerSubscribers);
    this.publishToIssuer(normalizedIssuerId, {
      type: "stream.connected",
      payload: {
        subscriberId,
      },
    });
    this.ensureWatcher(normalizedIssuerId);

    return () => {
      clearInterval(keepAliveTimer);
      const subscribers = this.subscribersByIssuer.get(normalizedIssuerId);
      if (!subscribers) {
        return;
      }
      subscribers.delete(subscriberId);
      if (!subscribers.size) {
        this.subscribersByIssuer.delete(normalizedIssuerId);
        this.stopWatcher(normalizedIssuerId);
      }
    };
  }

  publishToIssuer(issuerId: string, event: RealtimeEventPayload): void {
    const normalizedIssuerId = normalizeString(issuerId);
    if (!normalizedIssuerId) {
      return;
    }
    const subscribers = this.subscribersByIssuer.get(normalizedIssuerId);
    if (!subscribers?.size) {
      return;
    }

    const payload = {
      id: event.id || randomUUID(),
      type: event.type,
      createdAt: event.createdAt || new Date().toISOString(),
      payload: event.payload || {},
      notification: event.notification || null,
    };
    const message = `data: ${JSON.stringify(payload)}\n\n`;

    subscribers.forEach(({ res }, subscriberId) => {
      try {
        res.write(message);
      } catch {
        subscribers.delete(subscriberId);
      }
    });

    if (!subscribers.size) {
      this.subscribersByIssuer.delete(normalizedIssuerId);
      this.stopWatcher(normalizedIssuerId);
    }
  }

  private ensureWatcher(issuerId: string): void {
    if (this.watcherStateByIssuer.get(issuerId)?.timer) {
      return;
    }

    const state: IssuerWatcherState = {
      lastContactIds: new Set<string>(),
      seenNotificationIds: new Set<string>(),
    };

    state.timer = setInterval(() => {
      void this.tickIssuer(issuerId);
    }, WATCH_INTERVAL_MS);

    this.watcherStateByIssuer.set(issuerId, state);
    void this.tickIssuer(issuerId);
  }

  private stopWatcher(issuerId: string): void {
    const state = this.watcherStateByIssuer.get(issuerId);
    if (!state) {
      return;
    }
    if (state.timer) {
      clearInterval(state.timer);
    }
    this.watcherStateByIssuer.delete(issuerId);
  }

  private async tickIssuer(issuerId: string): Promise<void> {
    const subscribers = this.subscribersByIssuer.get(issuerId);
    if (!subscribers?.size) {
      this.stopWatcher(issuerId);
      return;
    }

    const state = this.watcherStateByIssuer.get(issuerId);
    if (!state) {
      return;
    }

    try {
      const runtime = await this.issuerSignifyService.getRuntimeByIssuerId(issuerId);
      await this.processContacts(runtime.client, runtime.aidPrefix, issuerId, state);
      await this.processNotifications(runtime, issuerId, state);
    } catch {
      // keep stream alive even if the underlying runtime is temporarily unavailable
    }
  }

  private async processContacts(
    client: SignifyClient,
    localAidPrefix: string,
    issuerId: string,
    state: IssuerWatcherState
  ): Promise<void> {
    const rawContacts = await client.contacts().list();
    const currentContactIds = getContactIds(rawContacts, localAidPrefix);
    const previousContactIds = state.lastContactIds;

    const addedContactIds = Array.from(currentContactIds).filter(
      (id) => !previousContactIds.has(id)
    );
    const removedContactIds = Array.from(previousContactIds).filter(
      (id) => !currentContactIds.has(id)
    );

    if (addedContactIds.length || removedContactIds.length) {
      this.publishToIssuer(issuerId, {
        type: "connections.refresh",
        payload: {
          addedContactIds,
          removedContactIds,
        },
        notification: addedContactIds.length
          ? {
              title: "New connection created",
              message: `A new connection was detected (${addedContactIds[0]}).`,
              level: "success",
            }
          : {
              title: "Connection updated",
              message: "A connection was removed or updated.",
              level: "info",
            },
      });
    }

    state.lastContactIds = currentContactIds;
  }

  private async processNotifications(
    runtime: IssuerRuntime,
    issuerId: string,
    state: IssuerWatcherState
  ): Promise<void> {
    const rawNotifications = await runtime.client.notifications().list();
    const notes = getNotes(rawNotifications);

    for (const note of notes) {
      const id = normalizeString(note.i);
      if (!id || state.seenNotificationIds.has(id)) {
        continue;
      }

      state.seenNotificationIds.add(id);
      try {
        const processed = await processPresentationRequestNotification(
          runtime,
          note
        );
        if (processed?.handled) {
          processed.events.forEach((event) => {
            this.publishToIssuer(issuerId, event);
          });
          if (processed.deleteNotification) {
            await runtime.client.notifications().delete(id).catch(() => {
              // Keep stream alive even if notification deletion fails.
            });
          }
          continue;
        }

        const route = normalizeString((note.a as { r?: unknown })?.r);
        const routeLower = route.toLowerCase();
        const isCredentialAccepted =
          routeLower.includes("admit") ||
          routeLower.includes("agree") ||
          routeLower.includes("accept");

        this.publishToIssuer(issuerId, {
          type: "notifications.new",
          payload: {
            route,
            notificationId: id,
          },
          notification: isCredentialAccepted
            ? {
                title: "Credential accepted by wallet user",
                message:
                  "A wallet user accepted a credential exchange notification.",
                level: "success",
              }
            : {
                title: "New agent notification",
                message: route
                  ? `Received notification route: ${route}`
                  : "Received a new agent notification.",
                level: "info",
            },
        });

        await runtime.client.notifications().delete(id).catch(() => {
          // Keep stream alive even if notification deletion fails.
        });
      } catch {
        state.seenNotificationIds.delete(id);
      }
    }

    if (state.seenNotificationIds.size > 1500) {
      state.seenNotificationIds = new Set<string>();
    }
  }
}
