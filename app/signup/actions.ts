"use server";

import { redirect } from "next/navigation";
import { signIn } from "@/auth";
import { emailTaken, createPasswordUser } from "@/lib/credentials";
import { checkPasswordStrength } from "@/lib/password";
import { isRedirect } from "@/lib/redirect-error";

export async function signUp(formData: FormData) {
  const name = String(formData.get("name") ?? "").trim().slice(0, 120);
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");

  if (!email.includes("@")) redirect("/signup?error=email");
  const weak = checkPasswordStrength(password);
  if (weak) redirect(`/signup?error=${encodeURIComponent(weak)}`);
  if (await emailTaken(email)) redirect("/signup?error=taken");

  await createPasswordUser({ email, name, password });

  try {
    await signIn("credentials", { email, password, redirectTo: "/feed" });
  } catch (err) {
    if (isRedirect(err)) throw err;
    redirect("/login?error=badcreds");
  }
}
