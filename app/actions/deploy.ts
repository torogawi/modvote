// app/actions/deploy.ts
"use server"

import { prisma } from "@/lib/prisma"
import { resolveModAndDependencies } from "@/lib/modrinth"
import { setServerPowerState, uploadModsViaFTP } from "@/lib/pterodactyl"
import fs from "fs"
import path from "path"
import os from "os"
import { revalidatePath } from "next/cache"

// Helper function to pause execution
const delay = (ms: number) => new Promise(res => setTimeout(res, ms));

export async function endSessionAndDeploy() {
  try {
    const settings = await prisma.systemSettings.findUnique({ where: { id: "default" } });
    if (!settings) return { error: "Admin settings missing." };

    const session = await prisma.votingSession.findFirst({
      where: { status: "OPEN" },
      include: { candidates: true }
    });

    if (!session) return { error: "No open voting session found." };

    const winner = session.candidates.reduce((prev, current) => {
      return (prev.voteCount > current.voteCount) ? prev : current;
    });

    // 1. Close the voting session
    await prisma.votingSession.update({
      where: { id: session.id },
      data: { status: "CLOSED" }
    });
// ==========================================
    // REROLL BALLOT INTERCEPTOR
    // ==========================================
    if (winner.modrinthId === "reroll-ballot") {
      console.log("🔄 Reroll Ballot won! Scrapping session and generating a new one...");
      
      // Import createVotingSession dynamically to prevent circular dependency errors
      const { createVotingSession } = await import("./voting");
      await createVotingSession(); // Generate the new ballot!
      
      revalidatePath("/");
      return { success: true, winnerName: "Reroll", fileCount: 0 };
    }
    console.log(`🏆 Winner is ${winner.name}! Starting Deployment Protocol...`);

    // 2. Shut down the Minecraft Server
    console.log("🛑 Sending STOP command to Minecraft Server...");
    await setServerPowerState("stop");

    // 3. Resolve mod files and download them to Vercel's temporary directory
    const filesToDownload = await resolveModAndDependencies(winner.modrinthId, settings.serverVersion, settings.modLoader);
    
    // Use os.tmpdir() instead of process.cwd() so it works perfectly on free hosting!
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "modvote-")); 

    for (const file of filesToDownload) {
      const filePath = path.join(tempDir, file.filename);
      console.log(`⬇️ Downloading ${file.filename} to temporary server space...`);
      const response = await fetch(file.url);
      if (!response.ok) throw new Error(`Failed to download ${file.filename}`);
      const arrayBuffer = await response.arrayBuffer();
      fs.writeFileSync(filePath, Buffer.from(arrayBuffer));
    }

    // 4. Upload files to PebbleHost via FTP
    console.log("🚀 Uploading files to PebbleHost...");
    await uploadModsViaFTP(tempDir);

    // 5. Clean up temporary files
    fs.rmSync(tempDir, { recursive: true, force: true });

    // 6. Give the server a few seconds to process the file writes, then START it
    console.log("⏳ Waiting 5 seconds before restart...");
    await delay(5000);
    console.log("🟢 Sending START command to Minecraft Server...");
    await setServerPowerState("start");

    // 7. Save to Hall of Fame
    await prisma.installedMod.upsert({
      where: { modrinthId: winner.modrinthId },
      update: { dateInstalled: new Date(), isActive: true },
      create: { modrinthId: winner.modrinthId, name: winner.name }
    });

    revalidatePath("/");
    return { success: true, winnerName: winner.name, fileCount: filesToDownload.length };
  } catch (error: any) {
    console.error("Deployment Error:", error);
    return { error: error.message || "Failed to deploy the mod." };
  }
}