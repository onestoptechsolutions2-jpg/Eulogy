"use server";

import { redirect } from "next/navigation";
import { issueLoginLink } from "@/lib/auth";
import { sendLoginLink } from "@/lib/email";

export async function requestLink(formData: FormData) {
  const email = String(formData.get("email") ?? "").trim();
  const url = await issueLoginLink(email);
  if (url) await sendLoginLink(email, url);
  // same response whether or not the address is on the tree
  redirect("/login?sent=1");
}
