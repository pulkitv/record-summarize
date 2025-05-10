import type { NextAuthOptions, Session } from "next-auth"
import GoogleProvider from "next-auth/providers/google"

declare module "next-auth" {
  interface Session {
    accessToken?: string;
  }
}

export const authConfig: NextAuthOptions = {
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID || "",
      clientSecret: process.env.GOOGLE_CLIENT_SECRET || "",
      authorization: {
        params: {
          scope: "openid email profile https://www.googleapis.com/auth/gmail.send",
        },
      },
    }),
  ],
  secret: process.env.NEXTAUTH_SECRET,
  session: {
    strategy: "jwt",
  },
  pages: {
    signIn: "/login",
    error: "/api/auth/error",
  },
  callbacks: {
    async jwt({ token, account, user }) {
      if (account) {
        token.accessToken = account.access_token
        token.user = user
      }
      return token
    },
    async session({ session, token }) {
      if (token?.user) {
        session.user = token.user
      }
      // 👇 expose the Gmail API token to the client/session
      if (token?.accessToken) {
        session.accessToken = token.accessToken as string
      }
      return session
    },
  },
}
