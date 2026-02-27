import bodyParser from "body-parser";
import cors from "cors";
import express, { NextFunction, Request, Response } from "express";
import { join } from "path";
import { SignifyClient, ready as signifyReady, Tier } from "signify-ts";
import { config } from "./config";
import { ACDC_SCHEMAS_ID, ISSUER_NAME, QVI_NAME } from "./consts";
import { log } from "./log";
import { openApiDocument } from "./openapi";
import { router } from "./routes";
import { EndRole } from "./server.types";
import { PollingService } from "./services/pollingService";
import {
  createQVICredential,
  getEndRoles,
  getRegistry,
  loadBrans,
  REGISTRIES_NOT_FOUND,
  resolveOobi,
  waitAndGetDoneOp,
} from "./utils/utils";

async function getSignifyClient(bran: string): Promise<SignifyClient> {
  const client = new SignifyClient(
    config.keria.url,
    bran,
    Tier.low,
    config.keria.bootUrl
  );

  try {
    await client.connect();
  } catch (err) {
    await client.boot();
    await client.connect();
  }

  await Promise.allSettled(
    ACDC_SCHEMAS_ID.map((schemaId) =>
      resolveOobi(client, `${config.oobiEndpoint}/oobi/${schemaId}`)
    )
  );

  return client;
}

async function ensureIdentifierExists(
  client: SignifyClient,
  aidName: string
): Promise<void> {
  try {
    await client.identifiers().get(aidName);
  } catch (e: any) {
    const status = e.message.split(" - ")[1];
    if (/404/gi.test(status)) {
      const result = await client.identifiers().create(aidName);
      await waitAndGetDoneOp(client, await result.op());
      await client.identifiers().get(aidName);
    } else {
      throw e;
    }
  }
}

async function ensureEndRoles(
  client: SignifyClient,
  aidName: string
): Promise<void> {
  const roles = await getEndRoles(client, aidName);

  const hasDefaultRole = roles.some((role) => role.role === EndRole.AGENT);

  if (!hasDefaultRole) {
    await client
      .identifiers()
      .addEndRole(aidName, EndRole.AGENT, client.agent!.pre);
  }

  if (
    aidName === ISSUER_NAME &&
    !roles.some((role) => role.role === EndRole.INDEXER)
  ) {
    const prefix = (await client.identifiers().get(aidName)).prefix;

    const endResult = await client
      .identifiers()
      .addEndRole(aidName, "indexer", prefix);
    await waitAndGetDoneOp(client, await endResult.op());
    const locRes = await client.identifiers().addLocScheme(aidName, {
      url: config.oobiEndpoint,
      scheme: new URL(config.oobiEndpoint).protocol.replace(":", ""),
    });
    await waitAndGetDoneOp(client, await locRes.op());
  }
}

async function ensureRegistryExists(
  client: SignifyClient,
  aidName: string
): Promise<void> {
  try {
    await getRegistry(client, aidName);
  } catch (e: any) {
    if (e.message.includes(REGISTRIES_NOT_FOUND)) {
      const result = await client
        .registries()
        .create({ name: aidName, registryName: "vLEI" });
      await waitAndGetDoneOp(client, await result.op());
    } else {
      throw e;
    }
  }
}

async function initializeCredentials(
  client: SignifyClient,
  issuerClient: SignifyClient
): Promise<string> {
  const issuerRegistry = await getRegistry(issuerClient, QVI_NAME);

  const qviCredentialId = await createQVICredential(
    client,
    issuerClient,
    issuerRegistry
  ).catch((e) => {
    console.error(e);
    return "";
  });

  const pollingService = new PollingService(client);
  pollingService.start();

  return qviCredentialId;
}

function isLocalhostUrl(value: string): boolean {
  const host = new URL(value).hostname;
  return host === "127.0.0.1" || host === "localhost" || host === "::1";
}

function stringifyForLog(value: unknown): string {
  try {
    const serialized = JSON.stringify(value);
    if (!serialized) {
      return "";
    }

    const maxLength = 2000;
    if (serialized.length > maxLength) {
      return `${serialized.slice(0, maxLength)}...<truncated>`;
    }

    return serialized;
  } catch {
    return "[unserializable]";
  }
}

async function startServer() {
  const app = express();
  app.use(cors());
  app.use(bodyParser.json({ limit: config.jsonBodyLimit }));
  app.use((req: Request, res: Response, next: NextFunction) => {
    const startedAt = Date.now();
    const queryLog = stringifyForLog(req.query);
    const bodyLog = stringifyForLog(req.body);

    log(
      `[REQ] ${req.method} ${req.originalUrl}` +
        (queryLog ? ` query=${queryLog}` : "") +
        (bodyLog ? ` body=${bodyLog}` : "")
    );

    res.on("finish", () => {
      log(
        `[RES] ${req.method} ${req.originalUrl} ${res.statusCode} ${
          Date.now() - startedAt
        }ms`
      );
    });

    next();
  });
  app.get("/api-docs.json", (_, res) => {
    res.status(200).json(openApiDocument);
  });
  app.get("/api-docs", (_, res) => {
    res.status(200).type("html").send(`
<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Credential Issuance API Docs</title>
    <link rel="stylesheet" href="https://unpkg.com/swagger-ui-dist@5/swagger-ui.css" />
    <style>
      html { box-sizing: border-box; overflow-y: scroll; }
      *, *:before, *:after { box-sizing: inherit; }
      body { margin: 0; background: #fafafa; }
    </style>
  </head>
  <body>
    <div id="swagger-ui"></div>
    <script src="https://unpkg.com/swagger-ui-dist@5/swagger-ui-bundle.js"></script>
    <script src="https://unpkg.com/swagger-ui-dist@5/swagger-ui-standalone-preset.js"></script>
    <script>
      window.onload = function () {
        window.ui = SwaggerUIBundle({
          url: "/api-docs.json",
          dom_id: "#swagger-ui",
          deepLinking: true,
          presets: [SwaggerUIBundle.presets.apis, SwaggerUIStandalonePreset],
          layout: "StandaloneLayout"
        });
      };
    </script>
  </body>
</html>
    `);
  });
  app.use("/static", express.static("static"));
  app.use(
    "/oobi",
    express.static(join(__dirname, "schemas"), {
      setHeaders: (res) => {
        res.setHeader("Content-Type", "application/schema+json");
      },
    })
  );
  app.use(router);
  app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
    console.error(
      `[ERR] ${req.method} ${req.originalUrl} query=${stringifyForLog(
        req.query
      )} body=${stringifyForLog(req.body)}`,
      err?.stack ?? err
    );

    if (res.headersSent) {
      next(err);
      return;
    }

    const parsedError = err as Error & { status?: number; type?: string };
    if (
      parsedError.status === 413 ||
      parsedError.type === "entity.too.large"
    ) {
      res.status(413).json({
        error:
          "request entity too large; remove very large fields (for example base64 picture) or increase JSON_BODY_LIMIT.",
      });
      return;
    }

    res.status(500).json({
      error: err.message ?? "Internal Server Error",
    });
  });

  app.listen(config.port, async () => {
    if (
      !isLocalhostUrl(config.keria.url) &&
      isLocalhostUrl(config.oobiEndpoint)
    ) {
      log(
        `[WARN] OOBI_ENDPOINT (${config.oobiEndpoint}) points to localhost while KERIA_ENDPOINT (${config.keria.url}) is remote. The KERIA service cannot resolve localhost OOBIs.`
      );
    }

    await signifyReady();
    const brans = await loadBrans();

    const signifyClient = await getSignifyClient(brans.bran);
    const signifyClientIssuer = await getSignifyClient(brans.issuerBran);

    // Ensure identifiers exist first
    await ensureIdentifierExists(signifyClient, ISSUER_NAME);
    await ensureIdentifierExists(signifyClientIssuer, QVI_NAME);

    // Add end roles before creating registries (KERIA bug workaround)
    await ensureEndRoles(signifyClient, ISSUER_NAME);
    await ensureEndRoles(signifyClientIssuer, QVI_NAME);

    // Now create registries
    await ensureRegistryExists(signifyClient, ISSUER_NAME);
    await ensureRegistryExists(signifyClientIssuer, QVI_NAME);

    app.set("signifyClient", signifyClient);
    app.set("signifyClientIssuer", signifyClientIssuer);

    const qviCredentialId = await initializeCredentials(
      signifyClient,
      signifyClientIssuer
    );
    app.set("qviCredentialId", qviCredentialId);

    log(`Listening on port ${config.port}`);
  });
}

void startServer();
