import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import Facebook from "next-auth/providers/facebook";
import { provisionUser, getUserByEmail } from "@/lib/provision";

export const { handlers, signIn, signOut, auth } = NextAuth({
  trustHost: true,
  session: { strategy: "jwt" },
  pages: { signIn: "/login" },
  providers: [Google, Facebook],
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
