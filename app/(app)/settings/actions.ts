"use server";

import { redirect } from "next/navigation";
import { requireMember } from "@/lib/access";
import { verifyPassword, checkPasswordStrength } from "@/lib/password";
import { setUserPassword } from "@/lib/credentials";

export async function changePassword(formData: FormData) {
  const { user } = await requireMember();
  const current = String(formData.get("current") ?? "");
  const next = String(formData.get("next") ?? "");

  // if they already have a password, the current one must check out
  if (user.passwordHash && !(await verifyPassword(current, user.passwordHash))) {
    redirect("/settings?pw=wrong");
  }
  const weak = checkPasswordStrength(next);
  if (weak) redirect(`/settings?pw=${encodeURIComponent(weak)}`);

  await setUserPassword(user.id, next);
  redirect("/settings?pw=ok");
}
