import { Request, Response } from "express";
import { getSignifyClientFromRequest } from "../utils/requestContext";
import { sendSuccess } from "../utils/apiResponse";

type SignifyNotification = {
  i?: unknown;
  dt?: unknown;
  a?: {
    r?: unknown;
    d?: unknown;
    dt?: unknown;
  };
  [key: string]: unknown;
};

const CONSUME_POLL_THROTTLE_MS = 3000;
const lastConsumePollAtByIssuer = new Map<string, number>();

function normalizeString(value: unknown): string {
  if (value === undefined || value === null) {
    return "";
  }
  return String(value).trim();
}

function getIssuerKey(req: Request): string {
  return normalizeString(req.authUser?.issuerId || req.issuerRuntime?.issuerId);
}

export async function listNotificationsApiV2(
  req: Request,
  res: Response
): Promise<void> {
  const client = getSignifyClientFromRequest(req);
  const consume =
    normalizeString(req.query.consume || "true").toLowerCase() !== "false";
  const issuerKey = getIssuerKey(req);

  if (consume && issuerKey) {
    const now = Date.now();
    const lastPollAt = lastConsumePollAtByIssuer.get(issuerKey) || 0;
    if (now - lastPollAt < CONSUME_POLL_THROTTLE_MS) {
      sendSuccess(res, {
        items: [],
        total: 0,
      });
      return;
    }
    lastConsumePollAtByIssuer.set(issuerKey, now);
  }

  const rawList = await client.notifications().list();
  const notes = Array.isArray((rawList as { notes?: unknown }).notes)
    ? ((rawList as { notes: unknown[] }).notes as SignifyNotification[])
    : [];

  const items = notes
    .map((note) => {
      const id = normalizeString(note.i);
      if (!id) {
        return null;
      }

      return {
        id,
        route: normalizeString(note.a?.r),
        said: normalizeString(note.a?.d),
        createdAt:
          normalizeString(note.dt) ||
          normalizeString(note.a?.dt) ||
          new Date().toISOString(),
        raw: note,
      };
    })
    .filter((item): item is NonNullable<typeof item> => Boolean(item));

  if (consume && items.length) {
    await Promise.allSettled(
      items.map((item) => client.notifications().delete(item.id))
    );
  }

  sendSuccess(res, {
    items,
    total: items.length,
  });
}
