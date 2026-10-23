import nodemailer from "nodemailer";

function gmailCredentials() {
  return {
    user: process.env.GMAIL_SMTP_USER || process.env.SMTP_USER || "",
    pass: process.env.GMAIL_SMTP_APP_PASSWORD || process.env.SMTP_PASS || "",
  };
}

export function isGmailFallbackConfigured() {
  const { user, pass } = gmailCredentials();
  return Boolean(user && pass);
}

function escapeHtml(value: string) {
  return value.replace(/[&<>'"]/g, character => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" })[character] ?? character);
}

export async function sendPasswordResetEmail(to: string, actionLink: string) {
  const { user, pass } = gmailCredentials();
  if (!user || !pass) throw new Error("GMAIL_SMTP_NOT_CONFIGURED");
  const transporter = nodemailer.createTransport({ service: "gmail", auth: { user, pass } });
  const safeLink = escapeHtml(actionLink);
  await transporter.sendMail({
    from: `Review Saathi <${user}>`,
    replyTo: user,
    to,
    subject: "Reset your Review Saathi password",
    headers: {
      "Auto-Submitted": "auto-generated",
      "X-Auto-Response-Suppress": "All",
    },
    text: `Reset your Review Saathi password using this link: ${actionLink}\n\nIf you did not request this, you can ignore this email.`,
    html: `<!doctype html><html><body style="margin:0;background:#f4f7f6;color:#173b3c;font-family:Arial,Helvetica,sans-serif;padding:32px 16px"><div style="max-width:560px;margin:auto;background:#fff;border:1px solid #dce8e5;border-radius:16px;overflow:hidden"><div style="background:#075f62;padding:28px 32px;color:#fff;font-size:20px;font-weight:700">Review Saathi<div style="color:#c9efea;font-size:13px;font-weight:400;margin-top:6px">Simple feedback for growing businesses</div></div><div style="padding:36px 32px 28px"><h1 style="margin:0;font-size:26px">Reset your password</h1><p style="color:#526d6d;font-size:15px;line-height:1.65">We received a request to reset your Review Saathi password.</p><p><a href="${safeLink}" style="display:inline-block;padding:14px 22px;border-radius:8px;background:#e47b45;color:#fff;font-weight:700;text-decoration:none">Reset password</a></p><p style="color:#6c8584;font-size:13px;line-height:1.6">If you did not request this, you can safely ignore this email.</p><p style="color:#6c8584;font-size:12px;line-height:1.5;word-break:break-word">If the button does not work, copy this link:<br><a href="${safeLink}" style="color:#075f62">${safeLink}</a></p></div><div style="border-top:1px solid #e5eeec;padding:20px 32px;color:#78908f;font-size:12px">© Review Saathi</div></div></body></html>`,
  });
}
