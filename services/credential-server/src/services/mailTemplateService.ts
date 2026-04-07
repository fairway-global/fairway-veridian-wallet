function escapeHtml(value: string): string {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function renderParagraphs(lines: string[]): string {
  return lines
    .filter(Boolean)
    .map(
      (line) =>
        `<p style="margin:0 0 14px;color:#35544b;font-size:15px;line-height:1.7;">${escapeHtml(
          line
        )}</p>`
    )
    .join("");
}

export function buildEmailTemplate(input: {
  eyebrow?: string;
  title: string;
  intro?: string;
  lines: string[];
  ctaLabel?: string;
  ctaUrl?: string;
  footer?: string;
}): string {
  const eyebrow = input.eyebrow
    ? `<div style="margin-bottom:12px;color:#177a62;font-size:12px;font-weight:800;letter-spacing:0.12em;text-transform:uppercase;">${escapeHtml(
        input.eyebrow
      )}</div>`
    : "";
  const intro = input.intro
    ? `<p style="margin:0 0 16px;color:#1c332d;font-size:16px;line-height:1.75;font-weight:600;">${escapeHtml(
        input.intro
      )}</p>`
    : "";
  const cta =
    input.ctaLabel && input.ctaUrl
      ? `
        <div style="margin:28px 0 10px;">
          <a href="${escapeHtml(input.ctaUrl)}" style="display:inline-block;padding:14px 22px;border-radius:999px;background:#177a62;color:#ffffff;font-size:14px;font-weight:800;text-decoration:none;">
            ${escapeHtml(input.ctaLabel)}
          </a>
        </div>
      `
      : "";
  const footer = input.footer
    ? `<p style="margin:24px 0 0;color:#5d7c73;font-size:13px;line-height:1.7;">${escapeHtml(
        input.footer
      )}</p>`
    : "";

  return `
    <!doctype html>
    <html lang="en">
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <title>${escapeHtml(input.title)}</title>
      </head>
      <body style="margin:0;padding:24px;background:#edf7f2;font-family:Arial,Helvetica,sans-serif;">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:640px;margin:0 auto;border-spacing:0;">
          <tr>
            <td style="padding:0;">
              <div style="padding:34px 32px;border-radius:28px;background:#ffffff;border:1px solid rgba(15,61,49,0.08);box-shadow:0 24px 60px rgba(15,61,49,0.08);">
                ${eyebrow}
                <h1 style="margin:0 0 14px;color:#0f2e27;font-size:28px;line-height:1.15;">${escapeHtml(
                  input.title
                )}</h1>
                ${intro}
                ${renderParagraphs(input.lines)}
                ${cta}
                ${footer}
              </div>
            </td>
          </tr>
        </table>
      </body>
    </html>
  `;
}

export function buildPasswordResetEmail(input: {
  resetUrl: string;
  expiresInText: string;
}): { subject: string; html: string; text: string } {
  const subject = "Reset your Fairwallet password";
  const lines = [
    "We received a request to reset your Fairwallet password.",
    `This link expires in ${input.expiresInText}.`,
    "If you did not request this change, you can safely ignore this email.",
  ];

  return {
    subject,
    html: buildEmailTemplate({
      eyebrow: "Fairwallet Security",
      title: "Reset your password",
      intro: "Use the secure link below to choose a new password.",
      lines,
      ctaLabel: "Reset password",
      ctaUrl: input.resetUrl,
      footer:
        "For security, this link can only be used once. If it expires, request a new reset email from the login page.",
    }),
    text: [
      subject,
      "",
      ...lines,
      "",
      `Reset link: ${input.resetUrl}`,
    ].join("\n"),
  };
}

export function buildPasswordChangedEmail(): {
  subject: string;
  html: string;
  text: string;
} {
  const subject = "Your Fairwallet password was changed";
  const lines = [
    "This is a confirmation that your Fairwallet password has been updated successfully.",
    "If you did not make this change, contact your administrator immediately and reset your password again.",
  ];

  return {
    subject,
    html: buildEmailTemplate({
      eyebrow: "Fairwallet Security",
      title: "Password updated",
      intro: "Your account security details were changed.",
      lines,
    }),
    text: [subject, "", ...lines].join("\n"),
  };
}

export function buildAccountCreatedEmail(input: {
  role: string;
  issuerName: string;
  signInUrl: string;
  resetUrl: string;
}): { subject: string; html: string; text: string } {
  const roleLabel = String(input.role || "").trim() || "account";
  const subject = "Your Fairwallet account is ready";
  const lines = [
    `A Fairwallet ${roleLabel} account has been created for ${input.issuerName}.`,
    "You can sign in with the email address this message was sent to.",
    "If you were not given a password separately, use the password reset option on the sign-in page to set one securely.",
  ];

  return {
    subject,
    html: buildEmailTemplate({
      eyebrow: "Fairwallet Access",
      title: "Your account is ready",
      intro: "Your organization can now access Fairwallet Credential Manager.",
      lines,
      ctaLabel: "Open sign in",
      ctaUrl: input.signInUrl,
      footer: `Need a password reset instead? Open ${input.resetUrl} from your browser.`,
    }),
    text: [
      subject,
      "",
      ...lines,
      "",
      `Sign in: ${input.signInUrl}`,
      `Reset password: ${input.resetUrl}`,
    ].join("\n"),
  };
}

export function buildIssuerApplicationReceivedEmail(input: {
  organizationName: string;
}): { subject: string; html: string; text: string } {
  const subject = "Your Fairwallet issuer request was received";
  const lines = [
    `We received your issuer access request for ${input.organizationName}.`,
    "Our team will review the request and contact you as soon as it is approved or if more information is needed.",
  ];

  return {
    subject,
    html: buildEmailTemplate({
      eyebrow: "Fairwallet Access",
      title: "Issuer request received",
      intro: "Thanks for requesting issuer access.",
      lines,
      footer: "You do not need to submit the same request again while this one is pending.",
    }),
    text: [subject, "", ...lines].join("\n"),
  };
}

export function buildIssuerApplicationApprovedEmail(input: {
  organizationName: string;
  signInUrl: string;
  resetUrl: string;
}): { subject: string; html: string; text: string } {
  const subject = "Your Fairwallet issuer access is ready";
  const lines = [
    `Your issuer request for ${input.organizationName} has been approved.`,
    "Your access is now ready. If you do not already have a password, use the password reset option from sign in to set one securely.",
  ];

  return {
    subject,
    html: buildEmailTemplate({
      eyebrow: "Fairwallet Access",
      title: "Issuer access approved",
      intro: "Your organization can now sign in and start credential operations.",
      lines,
      ctaLabel: "Open sign in",
      ctaUrl: input.signInUrl,
      footer: `Need to set a password first? Open ${input.resetUrl} from your browser.`,
    }),
    text: [
      subject,
      "",
      ...lines,
      "",
      `Sign in: ${input.signInUrl}`,
      `Reset password: ${input.resetUrl}`,
    ].join("\n"),
  };
}

export function buildIssuerApplicationRejectedEmail(input: {
  organizationName: string;
  adminNote?: string | null;
}): { subject: string; html: string; text: string } {
  const lines = [
    `Your issuer request for ${input.organizationName} was reviewed but was not approved at this time.`,
    input.adminNote
      ? `Review note: ${input.adminNote}`
      : "If you believe this was unexpected, reply to your administrator or submit a new request with updated details.",
  ];
  const subject = "Update on your Fairwallet issuer request";

  return {
    subject,
    html: buildEmailTemplate({
      eyebrow: "Fairwallet Access",
      title: "Issuer request update",
      intro: "There is an update on your issuer access request.",
      lines,
    }),
    text: [subject, "", ...lines].join("\n"),
  };
}

export function buildAccountStatusChangedEmail(input: {
  role: string;
  issuerName: string;
  isActive: boolean;
}): { subject: string; html: string; text: string } {
  const roleLabel = String(input.role || "").trim() || "account";
  const subject = input.isActive
    ? "Your Fairwallet access was restored"
    : "Your Fairwallet access was updated";
  const lines = input.isActive
    ? [
        `Your Fairwallet ${roleLabel} access for ${input.issuerName} has been re-enabled by an administrator.`,
        "You can sign in again using your existing email and password.",
      ]
    : [
        `Your Fairwallet ${roleLabel} access for ${input.issuerName} has been disabled by an administrator.`,
        "If you believe this is unexpected, contact your administrator for clarification.",
      ];

  return {
    subject,
    html: buildEmailTemplate({
      eyebrow: "Fairwallet Access",
      title: input.isActive ? "Access restored" : "Access updated",
      intro: "There is an update on your account access.",
      lines,
    }),
    text: [subject, "", ...lines].join("\n"),
  };
}

export function buildAccountChangeRequestReviewedEmail(input: {
  fieldName: string;
  requestedValue: string;
  status: "approved" | "rejected";
  adminNote?: string | null;
}): { subject: string; html: string; text: string } {
  const friendlyField =
    input.fieldName === "issuer_name"
      ? "organization name"
      : input.fieldName === "email"
        ? "email"
        : input.fieldName;
  const subject =
    input.status === "approved"
      ? "Your Fairwallet request was approved"
      : "Update on your Fairwallet request";
  const lines = [
    input.status === "approved"
      ? `Your request to change ${friendlyField} to ${input.requestedValue} has been approved.`
      : `Your request to change ${friendlyField} to ${input.requestedValue} was reviewed but was not approved at this time.`,
    input.adminNote
      ? `Review note: ${input.adminNote}`
      : input.status === "approved"
        ? "The updated information is now active on your account."
        : "If you still need this change, you can submit a new request with updated details.",
  ];

  return {
    subject,
    html: buildEmailTemplate({
      eyebrow: "Fairwallet Access",
      title:
        input.status === "approved"
          ? "Request approved"
          : "Request update",
      intro: "There is an update on the request you submitted.",
      lines,
    }),
    text: [subject, "", ...lines].join("\n"),
  };
}
