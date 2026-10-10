import NextAuth from "next-auth";
import { authConfig } from "@/auth.config";

// Redirects unauthenticated users to /login for everything not listed as public in authConfig.
export default NextAuth(authConfig).auth;

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|manifest.webmanifest|icons/).*)"],
};
