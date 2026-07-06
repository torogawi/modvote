"use client"

import { useState } from "react"
import VoteCard from "./VoteCard"

interface Candidate {
  id: string;
  modrinthId: string;
  name: string;
  description: string | null;
  iconUrl: string | null;
  voteCount: number;
}

export default function BallotGrid({ candidates, sessionId }: { candidates: Candidate[], sessionId: string }) {
  const [searchQuery, setSearchQuery] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 30;

  // 1. Filter mods based on search bar
  const filteredMods = candidates.filter(mod => 
    mod.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
    (mod.description && mod.description.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  // 2. Calculate pagination
  const totalPages = Math.ceil(filteredMods.length / itemsPerPage) || 1;
  const startIndex = (currentPage - 1) * itemsPerPage;
  const currentMods = filteredMods.slice(startIndex, startIndex + itemsPerPage);

  // Reset to page 1 if they type in the search bar
  const handleSearch = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchQuery(e.target.value);
    setCurrentPage(1);
  };

  return (
    <div className="w-full">
      {/* Search Bar */}
      <div className="mb-6 max-w-xl mx-auto">
        <input 
          type="text" 
          placeholder="🔍 Search for a mod..." 
          value={searchQuery}
          onChange={handleSearch}
          className="w-full bg-gray-900 border border-gray-700 text-white px-4 py-3 rounded-xl focus:outline-none focus:border-indigo-500 shadow-sm"
        />
      </div>

      {/* The Grid */}
      {currentMods.length === 0 ? (
        <p className="text-center text-gray-500 py-12">No mods found matching "{searchQuery}"</p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
          {currentMods.map((mod) => (
            <VoteCard key={mod.id} mod={mod} sessionId={sessionId} />
          ))}
        </div>
      )}

      {/* Pagination Controls */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-4 text-white">
          <button 
            onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
            disabled={currentPage === 1}
            className="px-4 py-2 bg-gray-800 hover:bg-gray-700 disabled:opacity-50 rounded-md transition"
          >
            ◀ Prev
          </button>
          
          <span className="font-semibold text-gray-400">
            Page {currentPage} of {totalPages}
          </span>
          
          <button 
            onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
            disabled={currentPage === totalPages}
            className="px-4 py-2 bg-gray-800 hover:bg-gray-700 disabled:opacity-50 rounded-md transition"
          >
            Next ▶
          </button>
        </div>
      )}
    </div>
  )
}