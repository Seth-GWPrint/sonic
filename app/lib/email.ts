import nodemailer from "nodemailer";

const smtpPort = Number(process.env.SMTP_PORT || "587");
const smtpSecure =
  process.env.SMTP_SECURE === "true" || smtpPort === 465;

function getRequiredEnv(name: string): string {
  const value = process.env[name]?.trim();

  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }

  return value;
}

export const emailTransporter = nodemailer.createTransport({
  host: getRequiredEnv("SMTP_HOST"),
  port: smtpPort,
  secure: smtpSecure,
  auth: {
    user: getRequiredEnv("SMTP_USER"),
    pass: getRequiredEnv("SMTP_PASSWORD"),
  },

  // For port 587, require encryption after connecting.
  requireTLS: !smtpSecure,
});

export async function verifyEmailConnection() {
  await emailTransporter.verify();
}

type SendEmailOptions = {
  to: string | string[];
  subject: string;
  text: string;
  html?: string;
  replyTo?: string;
};

export async function sendEmail({
  to,
  subject,
  text,
  html,
  replyTo,
}: SendEmailOptions) {
  const fromAddress = getRequiredEnv("EMAIL_FROM_ADDRESS");
  const fromName =
    process.env.EMAIL_FROM_NAME?.trim() || "Granite Woods Printing";

  return emailTransporter.sendMail({
    from: {
      name: fromName,
      address: fromAddress,
    },
    to,
    subject,
    text,
    html,
    replyTo:
      replyTo ||
      process.env.EMAIL_REPLY_TO?.trim() ||
      fromAddress,
  });
}