"use server";

import { redirect } from "next/navigation";
import { consumeResetToken, setUserPassword } from "@/lib/credentials";
import { checkPasswordStrength } from "@/lib/password";

export async function resetPassword(formData: FormData) {
  const token = String(formData.get("token") ?? "");
  const password = String(formData.get("password") ?? "");
  const confirm = String(formData.get("confirm") ?? "");

  if (password !== confirm) redirect(`/reset/${token}?error=match`);
  const weak = checkPasswordStrength(password);
  if (weak) redirect(`/reset/${token}?error=${encodeURIComponent(weak)}`);

  const userId = await consumeResetToken(token);
  if (!userId) redirect(`/reset/${token}?error=expired`);

  await setUserPassword(userId, password);
  redirect("/login?reset=1");
}
