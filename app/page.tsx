// app/page.tsx
import { prisma } from "@/lib/prisma"
import Navbar from "@/components/Navbar"
import VoteCard from "@/components/VoteCard"
import SyncButton from "@/components/SyncButton"
import { createVotingSession } from "@/app/actions/voting"
import { endSessionAndDeploy } from "@/app/actions/deploy"

export default async function Home() {
  // 1. Fetch the currently OPEN voting session
  const currentSession = await prisma.votingSession.findFirst({
    where: { status: "OPEN" },
    include: {
      candidates: {
        orderBy: { voteCount: 'desc' } 
      }
    }
  });

  // 2. Fetch the "Hall of Fame" (All active mods installed on the server)
  const installedMods = await prisma.installedMod.findMany({
    where: { isActive: true },
    orderBy: { dateInstalled: 'desc' } // Shows the newest mods at the top
  });

  return (
    <main className="max-w-6xl mx-auto min-h-screen flex flex-col">
      <Navbar />

      <div className="p-6 mt-8 flex-grow">
        
        {/* ================= VOTING SECTION ================= */}
        {!currentSession ? (
          <div className="text-center p-12 bg-gray-800 rounded-xl border border-gray-700 mb-12 shadow-lg">
            <h2 className="text-3xl font-extrabold mb-4 text-white">No active voting session</h2>
            <p className="text-gray-400 mb-8">The next voting period will begin soon. Check out the installed mods below!</p>
            
            <form action={async () => {
              "use server"
              await createVotingSession() 
            }}>
              <button type="submit" className="px-6 py-3 bg-indigo-600 hover:bg-indigo-500 rounded-md font-bold transition text-white shadow-md">
                Admin: Generate New Ballot
              </button>
            </form>
          </div>
        ) : (
          <div className="mb-16">
            <div className="mb-8 text-center flex flex-col items-center">
              <h2 className="text-4xl font-extrabold mb-2 text-transparent bg-clip-text bg-gradient-to-r from-green-400 to-blue-500 pb-2">
                Vote for next week's Mod!
              </h2>
              <p className="text-gray-300 mb-6 bg-gray-800 px-4 py-1 rounded-full border border-gray-700 shadow-sm">
                ⏳ Voting ends on: <span className="font-semibold text-white">{new Date(currentSession.endDate).toLocaleDateString()}</span>
              </p>
              
              <form action={async () => {
                "use server"
                await endSessionAndDeploy(); 
              }}>
                <button type="submit" className="px-4 py-2 bg-red-600 hover:bg-red-500 rounded-md font-bold transition text-white text-sm shadow-lg border border-red-400 flex items-center gap-2">
                  <span>⚠️</span> Admin: End Voting & Install Winner
                </button>
              </form>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {currentSession.candidates.map((mod) => (
                <VoteCard key={mod.id} mod={mod} sessionId={currentSession.id} />
              ))}
            </div>
          </div>
        )}

        {/* ================= HALL OF FAME ================= */}
        <div className="mt-8">
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 mb-6">
            <div className="flex items-center gap-4 flex-grow">
              <h2 className="text-2xl font-bold text-white">🏆 Server Hall of Fame</h2>
              <div className="h-px bg-gray-700 flex-grow hidden md:block"></div>
            </div>
            
            {/* The Auto-Sync Button we created above */}
            <SyncButton />
          </div>

          {installedMods.length === 0 ? (
            <p className="text-gray-500 italic bg-gray-900 p-6 rounded-lg border border-gray-800 text-center">
              No mods have won a vote yet. Start a session to crown the first winner!
            </p>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {installedMods.map((mod) => (
                <div key={mod.id} className="bg-gray-800 p-4 rounded-lg border border-gray-700 flex flex-col justify-between hover:border-gray-500 transition">
                  <h3 className="font-bold text-lg text-indigo-400 truncate" title={mod.name}>
                    {mod.name}
                  </h3>
                  <p className="text-xs text-gray-400 mt-2">
                    Installed: {new Date(mod.dateInstalled).toLocaleDateString()}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>

      </div>
    </main>
  );
}