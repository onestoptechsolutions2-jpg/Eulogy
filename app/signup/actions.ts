"use server";

import { redirect } from "next/navigation";
import { emailTaken, createPasswordUser } from "@/lib/credentials";
import { checkPasswordStrength } from "@/lib/password";

export async function signUp(formData: FormData) {
  const name = String(formData.get("name") ?? "").trim().slice(0, 120);
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");

  if (!email.includes("@")) redirect("/signup?error=email");
  const weak = checkPasswordStrength(password);
  if (weak) redirect(`/signup?error=${encodeURIComponent(weak)}`);
  if (await emailTaken(email)) redirect("/signup?error=taken");

  await createPasswordUser({ email, name, password });

  // Sign-in happens on the login page (client-side credentials flow), which
  // sidesteps a next-auth v5 beta bug where signIn() from a Server Action
  // redirects through a GET /api/auth/callback and 500s.
  redirect("/login?created=1");
}
