// lib/auth.ts
import { NextAuthOptions } from "next-auth"
import DiscordProvider from "next-auth/providers/discord"
import { PrismaAdapter } from "@auth/prisma-adapter"
import { prisma } from "@/lib/prisma"

export const authOptions: NextAuthOptions = {
  adapter: PrismaAdapter(prisma) as any,
  providers: [
    DiscordProvider({
      clientId: process.env.DISCORD_CLIENT_ID!,
      clientSecret: process.env.DISCORD_CLIENT_SECRET!,
    }),
  ],
  callbacks: {
    // Attach the user's database ID to the session so we can use it in Server Actions
    async session({ session, user }) {
      if (session.user) {
        session.user.id = user.id;
        // Optionally attach the role if you want to use it for admin routes later
        // session.user.role = (user as any).role; 
      }
      return session;
    }
  },
}