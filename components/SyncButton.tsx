// components/SyncButton.tsx
"use client"

export default function SyncButton() {
  return (
    <button 
      onClick={async () => {
        await navigator.clipboard.writeText(window.location.origin + "/api/sync");
        alert("Sync API Link copied to clipboard! Paste this into your Mod Sync config.");
      }}
      className="px-4 py-2 bg-gray-700 hover:bg-gray-600 border border-gray-500 rounded-md text-sm font-medium transition text-white shadow-sm flex items-center gap-2"
    >
      <span>🔗</span> Copy Auto-Sync Link
    </button>
  )
}