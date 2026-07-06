// app/page.tsx
import { prisma } from "@/lib/prisma"
import Navbar from "@/components/Navbar"
import BallotGrid from "@/components/BallotGrid"
import CountdownTimer from "@/components/CountdownTimer"
import { getServerSession } from "next-auth/next"
import { authOptions } from "@/lib/auth"

export default async function Home() {
  const session = await getServerSession(authOptions);
  const settings = await prisma.systemSettings.findUnique({ where: { id: "default" } });
  
  // ==========================================
  // UNLOGGED IN VIEW (THE GUIDE)
  // ==========================================
  if (!session?.user) {
    return (
      <main className="max-w-6xl mx-auto min-h-screen flex flex-col">
        <Navbar />
        <div className="p-6 mt-8 max-w-4xl mx-auto w-full">
          <div className="bg-gray-800 p-8 rounded-2xl border border-gray-700 shadow-2xl text-center mb-8">
            <h1 className="text-4xl font-extrabold text-white mb-4">Welcome to the Server!</h1>
            <p className="text-gray-400 text-lg mb-8">Please log in with Discord in the top right to view this week's mod ballot.</p>
          </div>

          <div className="bg-gray-900 border border-gray-800 p-8 rounded-2xl shadow-lg">
            <h2 className="text-2xl font-bold text-indigo-400 mb-6">🛠️ How to join the server</h2>
            
            <div className="space-y-6 text-gray-300">
              <div className="flex gap-4 items-start">
                <div className="bg-indigo-600 text-white w-8 h-8 rounded-full flex items-center justify-center font-bold flex-shrink-0">1</div>
                <div>
                  <h3 className="text-white font-bold text-lg">Install Fabric Loader</h3>
                  <p className="mb-2">You need the Fabric Mod Loader for Minecraft {settings?.serverVersion || "1.21.1"}.</p>
                  <a href="https://fabricmc.net/use/installer/" target="_blank" className="text-indigo-400 hover:underline text-sm font-bold">Download Fabric Installer ↗</a>
                </div>
              </div>

              <div className="flex gap-4 items-start">
                <div className="bg-indigo-600 text-white w-8 h-8 rounded-full flex items-center justify-center font-bold flex-shrink-0">2</div>
                <div>
                  <h3 className="text-white font-bold text-lg">Install AutoModpack</h3>
                  <p className="mb-2">Download AutoModpack and put it in your <code>%appdata%/.minecraft/mods</code> folder.</p>
                  <a href="https://modrinth.com/mod/automodpack/versions" target="_blank" className="text-indigo-400 hover:underline text-sm font-bold">Download AutoModpack ↗</a>
                </div>
              </div>

              <div className="flex gap-4 items-start">
                <div className="bg-indigo-600 text-white w-8 h-8 rounded-full flex items-center justify-center font-bold flex-shrink-0">3</div>
                <div>
                  <h3 className="text-white font-bold text-lg">Join the Server</h3>
                  <p className="mb-2">Launch Minecraft using the Fabric Profile, click Multiplayer, and join using this IP:</p>
                  <code className="bg-black px-3 py-1 rounded border border-gray-700 text-green-400 font-mono text-lg">{settings?.serverIp || "IP Not Set"}</code>
                </div>
              </div>

              <div className="flex gap-4 items-start">
                <div className="bg-indigo-600 text-white w-8 h-8 rounded-full flex items-center justify-center font-bold flex-shrink-0">4</div>
                <div>
                  <h3 className="text-white font-bold text-lg">Verify the Connection</h3>
                  <p className="mb-2">When joining for the first time, AutoModpack will ask you for a fingerprint to verify the server is safe. Paste this exact code:</p>
                  <code className="bg-black px-3 py-1 rounded border border-gray-700 text-yellow-400 font-mono text-sm break-all">{settings?.automodpackFingerprint || "Fingerprint Not Set"}</code>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>
    )
  }

  // ==========================================
  // LOGGED IN VIEW (THE BALLOT)
  // ==========================================
  const currentSession = await prisma.votingSession.findFirst({
    where: { status: "OPEN" },
    include: { candidates: { orderBy: { voteCount: 'desc' } } }
  });

  const installedMods = await prisma.installedMod.findMany({
    where: { isActive: true },
    orderBy: { dateInstalled: 'desc' } 
  });

  return (
    <main className="max-w-6xl mx-auto min-h-screen flex flex-col">
      <Navbar />

      <div className="p-6 mt-8 flex-grow">
        {!currentSession ? (
          <div className="text-center p-12 bg-gray-800 rounded-xl border border-gray-700 mb-12 shadow-lg">
            <h2 className="text-3xl font-extrabold mb-4 text-white">No active voting session</h2>
            <p className="text-gray-400 mb-8">The next voting period will begin soon. Check out the installed mods below!</p>
          </div>
        ) : (
          <div className="mb-16">
            <div className="mb-8 text-center flex flex-col items-center">
              <h2 className="text-4xl font-extrabold mb-2 text-transparent bg-clip-text bg-gradient-to-r from-green-400 to-blue-500 pb-2">
                Vote for next week's Mod!
              </h2>
              <p className="text-gray-300 mb-6 flex flex-col md:flex-row items-center justify-center gap-3 bg-gray-800 px-5 py-3 rounded-xl border border-gray-700 shadow-sm">
                <span>⏳ Voting ends on: {new Date(currentSession.endDate).toLocaleDateString()}</span>
                <CountdownTimer endDate={currentSession.endDate} />
              </p>
            </div>

            {/* THE SMART GRID */}
            <BallotGrid candidates={currentSession.candidates} sessionId={currentSession.id} />
          </div>
        )}

        {/* HALL OF FAME */}
        <div className="mt-8">
          <div className="flex items-center gap-4 mb-6">
            <h2 className="text-2xl font-bold text-white">🏆 Server Hall of Fame</h2>
            <div className="h-px bg-gray-700 flex-grow"></div>
          </div>

          {installedMods.length === 0 ? (
            <p className="text-gray-500 italic bg-gray-900 p-6 rounded-lg border border-gray-800 text-center">
              No mods have won a vote yet. Start a session to crown the first winner!
            </p>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {installedMods.map((mod) => (
                <div key={mod.id} className="bg-gray-800 p-4 rounded-lg border border-gray-700 flex flex-col justify-between hover:border-gray-500 transition">
                  <h3 className="font-bold text-lg text-indigo-400 truncate" title={mod.name}>{mod.name}</h3>
                  <p className="text-xs text-gray-400 mt-2">Installed: {new Date(mod.dateInstalled).toLocaleDateString()}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </main>
  );
}