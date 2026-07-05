"use client"

import { useState } from "react"
import { castVote } from "@/app/actions/voting"

interface VoteCardProps {
  mod: {
    id: string;
    name: string;
    description: string | null;
    iconUrl: string | null;
    voteCount: number;
  };
  sessionId: string;
}

export default function VoteCard({ mod, sessionId }: VoteCardProps) {
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  const handleVote = async () => {
    setLoading(true);
    setMessage("");
    
    // Call our Server Action from Step 2
    const result = await castVote(sessionId, mod.id);
    
    if (result?.error) {
      setMessage(`❌ ${result.error}`);
    } else {
      setMessage("✅ Vote cast successfully!");
    }
    
    setLoading(false);
  }

  return (
    <div className="flex flex-col p-4 bg-gray-800 rounded-xl border border-gray-700 shadow-lg">
      <div className="flex items-center gap-4 mb-4">
        {mod.iconUrl ? (
          <img src={mod.iconUrl} alt={mod.name} className="w-16 h-16 rounded-md shadow-sm" />
        ) : (
          <div className="w-16 h-16 bg-gray-700 rounded-md flex items-center justify-center text-2xl">📦</div>
        )}
        <div>
          <h3 className="text-xl font-bold">{mod.name}</h3>
          <p className="text-sm text-green-400 font-semibold">{mod.voteCount} Votes</p>
        </div>
      </div>
      
      <p className="text-gray-400 text-sm flex-grow mb-4 line-clamp-3">
        {mod.description}
      </p>

      {message && <p className="text-xs text-center mb-2 font-medium">{message}</p>}

      <button 
        onClick={handleVote}
        disabled={loading}
        className="w-full py-2 bg-green-600 hover:bg-green-500 disabled:bg-gray-600 rounded-md font-bold transition"
      >
        {loading ? "Voting..." : "Vote for this Mod"}
      </button>
    </div>
  )
}