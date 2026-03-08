import { NextFunction, Request, Response } from "express";
import { LOCAL_IDENTIFIER_CONTACT_ERROR } from "../utils/utils";
import { getSignifyClientFromRequest } from "../utils/requestContext";
import { RealtimeEventService } from "../services/realtimeEventService";

export async function contactList(
  req: Request,
  res: Response,
  next: NextFunction
) {
  const client = getSignifyClientFromRequest(req);
  const localAidPrefix = String(req.issuerRuntime?.aidPrefix || "").trim();

  // @TODO - foconnor: Temporary hack to add createdAt after one-way scan, doing this now
  // to avoid updating keripy and making a change which might make backwards compatability or migrations harder later.
  const rawContacts = await client.contacts().list();
  const contacts = rawContacts.filter((contact: { id?: string; alias?: string }) => {
    const contactId = String(contact?.id || "").trim();
    const contactAlias = String(contact?.alias || "").trim();
    if (!contactId) {
      return false;
    }

    // Keria may return local/self identifier entries (often 0AA...).
    if (contactId.startsWith("0AA")) {
      return false;
    }
    if (contactAlias.startsWith("0AA")) {
      return false;
    }

    // Do not show the issuer/verifier's own AID as a remote connection.
    if (localAidPrefix && contactId === localAidPrefix) {
      return false;
    }

    return true;
  });

  for (const contact of contacts) {
    if (!contact.createdAt) {
      contact.createdAt = new Date();
      try {
        await client.contacts().update(contact.id, {
          createdAt: contact.createdAt,
        });
      } catch (error: any) {
        const message = String(error?.message ?? error ?? "");
        if (!message.includes(LOCAL_IDENTIFIER_CONTACT_ERROR)) {
          throw error;
        }
      }
    }
  }

  res.status(200).send({
    success: true,
    data: contacts,
  });
}

export async function deleteContact(
  req: Request,
  res: Response,
  next: NextFunction
) {
  const client = getSignifyClientFromRequest(req);
  const { id } = req.query;
  const issuerId = String(req.authUser?.issuerId || req.issuerRuntime?.issuerId || "").trim();
  const realtimeService = req.app.get(
    "realtimeEventService"
  ) as RealtimeEventService | null;

  const data = await client.contacts().delete(id as string);
  if (issuerId && realtimeService) {
    realtimeService.publishToIssuer(issuerId, {
      type: "connections.refresh",
      notification: {
        title: "Connection removed",
        message: `Connection ${String(id || "").trim()} was removed.`,
        level: "warning",
      },
    });
  }

  res.status(200).send({
    success: true,
    data,
  });
}
