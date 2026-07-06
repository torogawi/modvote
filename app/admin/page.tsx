// app/admin/page.tsx
import { getServerSession } from "next-auth/next"
import { authOptions } from "@/lib/auth"
import { getSettings, saveSettings, runServerSync, factoryResetSystem } from "@/app/actions/admin"
import Navbar from "@/components/Navbar"
import { redirect } from "next/navigation"

export default async function AdminPanel() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect("/");

  const settings = await getSettings();
  if (settings && settings.adminDiscordId !== session.user.id) redirect("/");

  return (
    <main className="max-w-6xl mx-auto min-h-screen flex flex-col">
      <Navbar />
      <div className="p-6 mt-8 max-w-2xl mx-auto w-full">
        <h1 className="text-3xl font-bold mb-6 text-indigo-400">⚙️ Server Administration</h1>
        
        {/* === NEW QUICK ACTIONS === */}
        <div className="grid grid-cols-2 gap-4 mb-8">
          <form action={async () => { "use server"; await runServerSync(); }}>
            <button type="submit" className="w-full py-3 bg-blue-600 hover:bg-blue-500 rounded-md font-bold transition text-white shadow-md">
              🔄 Sync Panel & Mods
            </button>
          </form>
          
          <form action={async () => { "use server"; await factoryResetSystem(); }}>
            <button type="submit" className="w-full py-3 bg-red-800 hover:bg-red-600 rounded-md font-bold transition text-white shadow-md">
              ☢️ Factory Reset System
            </button>
          </form>
        </div>

        {/* === STANDARD SETTINGS === */}
        <form action={async (formData) => { "use server"; await saveSettings(formData); }} className="bg-gray-800 p-6 rounded-xl border border-gray-700 flex flex-col gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-400 mb-1">Minecraft Version (Auto-Synced if available)</label>
            <input type="text" name="serverVersion" defaultValue={settings?.serverVersion || "1.21.1"} className="w-full bg-gray-900 border border-gray-600 rounded p-2 text-white" />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-400 mb-1">Mod Loader</label>
            <select name="modLoader" defaultValue={settings?.modLoader || "fabric"} className="w-full bg-gray-900 border border-gray-600 rounded p-2 text-white">
              <option value="fabric">Fabric</option>
              <option value="forge">Forge</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-400 mb-1">Voting Duration (Days)</label>
            <input type="number" name="voteDurationDays" defaultValue={settings?.voteDurationDays || 7} className="w-full bg-gray-900 border border-gray-600 rounded p-2 text-white" />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-400 mb-1">Allowed Mod Categories</label>
            <input type="text" name="allowedCategories" defaultValue={settings?.allowedCategories || "adventure,magic,technology,worldgen,food"} className="w-full bg-gray-900 border border-gray-600 rounded p-2 text-white" />
          </div>

          <button type="submit" className="mt-4 w-full py-3 bg-indigo-600 hover:bg-indigo-500 rounded-md font-bold transition text-white">
            Save Manual Settings
          </button>
        </form>
      </div>
    </main>
  )
}