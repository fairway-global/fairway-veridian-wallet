import nodemailer, { SentMessageInfo, Transporter } from "nodemailer";
import { config } from "../config";
import { log } from "../log";

interface MailInput {
  to: string;
  subject: string;
  html: string;
  text: string;
}

let transporterPromise: Promise<Transporter> | null = null;

function maskEmail(value: string): string {
  const normalized = String(value || "").trim();
  const atIndex = normalized.indexOf("@");
  if (atIndex <= 1) {
    return normalized;
  }

  return `${normalized.slice(0, 2)}***${normalized.slice(atIndex)}`;
}

function logMailDebug(message: string, details?: Record<string, unknown>) {
  if (!config.mailDebug) {
    return;
  }

  if (details) {
    log(`[mail][debug] ${message}`, details);
    return;
  }

  log(`[mail][debug] ${message}`);
}

async function withMailTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  message: string
): Promise<T> {
  let timeoutHandle: ReturnType<typeof setTimeout> | null = null;

  try {
    return await Promise.race([
      promise,
      new Promise<T>((_, reject) => {
        timeoutHandle = setTimeout(() => {
          reject(new Error(message));
        }, timeoutMs);
      }),
    ]);
  } finally {
    if (timeoutHandle) {
      clearTimeout(timeoutHandle);
    }
  }
}

export function isMailConfigured(): boolean {
  return Boolean(
    String(config.smtpHost || "").trim() &&
      String(config.smtpUser || "").trim() &&
      String(config.smtpPassword || "").trim() &&
      String(config.mailFromAddress || "").trim()
  );
}

async function getTransporter(): Promise<Transporter> {
  if (!isMailConfigured()) {
    throw new Error("SMTP mailer is not configured");
  }

  if (!transporterPromise) {
    logMailDebug("creating transporter", {
      host: config.smtpHost,
      port: config.smtpPort,
      secure: config.smtpSecure,
      authUser: config.smtpUser,
      from: config.mailFromAddress,
      connectionTimeoutMs: config.smtpConnectionTimeoutMs,
      greetingTimeoutMs: config.smtpGreetingTimeoutMs,
      socketTimeoutMs: config.smtpSocketTimeoutMs,
      dnsTimeoutMs: config.smtpDnsTimeoutMs,
    });

    transporterPromise = Promise.resolve(
      nodemailer.createTransport({
        host: config.smtpHost,
        port: config.smtpPort,
        secure: config.smtpSecure,
        connectionTimeout: config.smtpConnectionTimeoutMs,
        greetingTimeout: config.smtpGreetingTimeoutMs,
        socketTimeout: config.smtpSocketTimeoutMs,
        dnsTimeout: config.smtpDnsTimeoutMs,
        auth: {
          user: config.smtpUser,
          pass: config.smtpPassword,
        },
      })
    );
  }

  return transporterPromise;
}

export async function sendTransactionalEmail(input: MailInput): Promise<void> {
  const startedAt = Date.now();

  try {
    const transporter = await getTransporter();
    logMailDebug("sendMail start", {
      to: maskEmail(input.to),
      subject: input.subject,
    });

    const info = await withMailTimeout<SentMessageInfo>(
      transporter.sendMail({
        from: `"${config.mailFromName}" <${config.mailFromAddress}>`,
        to: input.to,
        subject: input.subject,
        html: input.html,
        text: input.text,
      }),
      config.smtpSocketTimeoutMs,
      "SMTP send timed out"
    );
    logMailDebug("sendMail success", {
      to: maskEmail(input.to),
      subject: input.subject,
      messageId: info.messageId,
      accepted:
        Array.isArray(info.accepted) && info.accepted.length
          ? info.accepted.join(", ")
          : "",
      rejected:
        Array.isArray(info.rejected) && info.rejected.length
          ? info.rejected.join(", ")
          : "",
      response: String(info.response || "").trim(),
      elapsedMs: Date.now() - startedAt,
    });
  } catch (error) {
    log(
      "[mail] send failed",
      {
        host: config.smtpHost,
        port: config.smtpPort,
        secure: config.smtpSecure,
        authUser: config.smtpUser,
        from: config.mailFromAddress,
        to: maskEmail(input.to),
        subject: input.subject,
        elapsedMs: Date.now() - startedAt,
        error: error instanceof Error ? error.message : "unknown error",
      }
    );
    transporterPromise = null;
    throw error;
  }
}

export async function sendTransactionalEmailBestEffort(
  input: MailInput,
  context: string
): Promise<void> {
  if (!isMailConfigured()) {
    log(`[mail] skipped ${context}: SMTP mailer is not configured`);
    return;
  }

  try {
    await sendTransactionalEmail(input);
  } catch (error) {
    log(
      `[mail] failed ${context}: ${
        error instanceof Error ? error.message : "unknown error"
      }`
    );
  }
}
