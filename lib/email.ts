// Sends via Resend when RESEND_API_KEY is set; otherwise prints to the
// server console so local development needs no email account.

async function send(to: string, subject: string, text: string) {
  const key = process.env.RESEND_API_KEY;
  if (!key) {
    console.log(`\n──────── email → ${to} ────────\n${subject}\n\n${text}\n────────────────────────────────\n`);
    return { delivered: false as const };
  }
  const { Resend } = await import("resend");
  const resend = new Resend(key);
  await resend.emails.send({
    from: process.env.EMAIL_FROM || "Mizizi <onboarding@resend.dev>",
    to,
    subject,
    text,
  });
  return { delivered: true as const };
}

export function sendPasswordReset(to: string, url: string) {
  return send(
    to,
    "Reset your Mizizi password",
    `Someone asked to reset the password for this account.\n\nSet a new one:\n${url}\n\nThe link expires in 1 hour. If it wasn't you, ignore this email.`,
  );
}
