import { Resend } from "resend";

async function send(to: string, subject: string, text: string) {
  const key = process.env.RESEND_API_KEY;
  if (!key) {
    // dev fallback: print the link to the server console
    console.log(`\n──────── email → ${to} ────────\n${subject}\n\n${text}\n────────────────────────────────\n`);
    return { delivered: false as const };
  }
  const resend = new Resend(key);
  await resend.emails.send({
    from: process.env.EMAIL_FROM || "Mizizi <onboarding@resend.dev>",
    to,
    subject,
    text,
  });
  return { delivered: true as const };
}

export function sendLoginLink(to: string, url: string) {
  return send(
    to,
    "Your Mizizi sign-in link",
    `Click to sign in:\n${url}\n\nThe link works once and expires in 15 minutes. If you didn't request it, ignore this email.`,
  );
}

export function sendInvite(to: string, url: string, treeName: string, inviter: string) {
  return send(
    to,
    `${inviter} invited you to the ${treeName} family tree`,
    `${inviter} added you to the ${treeName} family tree on Mizizi.\n\nAccept the invitation:\n${url}\n\nThe link expires in 14 days.`,
  );
}
