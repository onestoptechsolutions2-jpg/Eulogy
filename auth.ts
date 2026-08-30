import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import Facebook from "next-auth/providers/facebook";
import Credentials from "next-auth/providers/credentials";
import { provisionUser, getUserByEmail } from "@/lib/provision";
import { verifyPassword } from "@/lib/password";

// Email + password. Keep the DEFAULT id ("credentials") — a custom id here
// makes signIn() from a Server Action redirect to a GET /api/auth/callback
// and 500 (next-auth v5 beta bug).
const password = Credentials({
  name: "Email and password",
  credentials: { email: {}, password: {} },
  authorize: async (c) => {
    const email = String(c?.email ?? "").trim().toLowerCase();
    const secret = String(c?.password ?? "");
    if (!email || !secret) return null;
    const u = await getUserByEmail(email);
    if (!u || !u.passwordHash) return null;
    if (!(await verifyPassword(secret, u.passwordHash))) return null;
    return { id: u.id, email: u.email, name: u.name };
  },
});

// Dev-only password-less sign-in, so the app is testable without OAuth
// credentials. Never available in production.
const devProvider =
  process.env.NODE_ENV !== "production"
    ? [
        Credentials({
          id: "dev",
          name: "Dev sign-in",
          credentials: { email: { label: "Email", type: "email" } },
          authorize: (c) =>
            c?.email ? { id: "dev", email: String(c.email), name: "Dev User" } : null,
        }),
      ]
    : [];

export const { handlers, signIn, signOut, auth } = NextAuth({
  trustHost: true,
  session: { strategy: "jwt" },
  pages: { signIn: "/login" },
  providers: [Google, Facebook, password, ...devProvider],
  callbacks: {
    async signIn({ user }) {
      if (!user.email) return false;
      await provisionUser({
        email: user.email,
        name: user.name ?? "",
        image: user.image ?? "",
      });
      return true;
    },
    async jwt({ token }) {
      if (token.email && !token.uid) {
        const u = await getUserByEmail(token.email);
        if (u) token.uid = u.id;
      }
      return token;
    },
    async session({ session, token }) {
      if (token.uid) session.userId = token.uid as string;
      return session;
    },
  },
});
