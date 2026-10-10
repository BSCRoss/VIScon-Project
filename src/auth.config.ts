import type { NextAuthConfig } from "next-auth";

/** Edge-safe part of the Auth.js config (no Prisma). Used by middleware and by src/auth.ts. */
export const authConfig = {
  pages: { signIn: "/login" },
  session: { strategy: "jwt" },
  providers: [],
  callbacks: {
    authorized({ auth, request }) {
      const { pathname } = request.nextUrl;
      const isPublic =
        pathname === "/" ||
        pathname === "/login" ||
        pathname === "/register" ||
        pathname.startsWith("/api/import") ||
        pathname.startsWith("/api/health") ||
        pathname.startsWith("/api/auth");
      return isPublic || !!auth?.user;
    },
    jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.username = user.username;
      }
      return token;
    },
    session({ session, token }) {
      if (typeof token.id === "string") session.user.id = token.id;
      if (typeof token.username === "string") session.user.username = token.username;
      return session;
    },
  },
} satisfies NextAuthConfig;
