"use client"

import { signIn, signOut, useSession } from "next-auth/react"

export default function Navbar() {
  const { data: session, status } = useSession();

  return (
    <nav className="flex items-center justify-between p-4 bg-gray-800 border-b border-gray-700">
      <h1 className="text-2xl font-bold text-green-400">⛏️ ModVote</h1>
      
      <div>
        {status === "loading" ? (
          <div className="text-gray-400">Loading...</div>
        ) : session ? (
          <div className="flex items-center gap-4">
            <span className="text-sm font-medium">{session.user?.name}</span>
            <button 
              onClick={() => signOut()}
              className="px-4 py-2 text-sm bg-red-600 hover:bg-red-700 rounded-md transition"
            >
              Sign Out
            </button>
          </div>
        ) : (
          <button 
            onClick={() => signIn("discord")}
            className="px-4 py-2 text-sm bg-[#5865F2] hover:bg-[#4752C4] rounded-md transition font-semibold"
          >
            Login with Discord
          </button>
        )}
      </div>
    </nav>
  )
}