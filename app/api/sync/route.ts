import { prisma } from "@/lib/prisma"
import { NextResponse } from "next/server"

// This creates a public API endpoint at http://localhost:3000/api/sync
export async function GET() {
  try {
    const settings = await prisma.systemSettings.findUnique({ where: { id: "default" } });
    const installedMods = await prisma.installedMod.findMany({ where: { isActive: true } });

    // We output a standard JSON manifest that Sync Mods and Launchers can read
    const manifest = {
      manifestVersion: 1,
      serverInfo: {
        gameVersion: settings?.serverVersion || "1.21.1",
        loader: settings?.modLoader || "fabric",
      },
      // Maps your database into a clean list of required files
      requiredFiles: installedMods.map(mod => ({
        filename: mod.name,
        required: true
      }))
    };

    return NextResponse.json(manifest);
  } catch (error) {
    return NextResponse.json({ error: "Failed to fetch sync data" }, { status: 500 });
  }
}