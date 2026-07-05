"use server"

import { prisma } from "@/lib/prisma"
import { getServerSession } from "next-auth/next"
import { authOptions } from "@/lib/auth"
import { revalidatePath } from "next/cache"

// Helper to ensure only the Admin can do this
async function checkAdmin() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return false;

  const settings = await prisma.systemSettings.findUnique({ where: { id: "default" } });
  
  // If no settings exist yet, the FIRST person to log in and save becomes the admin!
  if (!settings) return true; 

  return settings.adminDiscordId === session.user.id;
}

export async function getSettings() {
  const settings = await prisma.systemSettings.findUnique({ where: { id: "default" } });
  return settings;
}

export async function saveSettings(formData: FormData) {
  const isAdmin = await checkAdmin();
  if (!isAdmin) return { error: "Unauthorized. You are not the admin." };

  const session = await getServerSession(authOptions);

  await prisma.systemSettings.upsert({
    where: { id: "default" },
    update: {
      serverVersion: formData.get("serverVersion") as string,
      modLoader: formData.get("modLoader") as string,
      voteDurationDays: parseInt(formData.get("voteDurationDays") as string),
      allowedCategories: formData.get("allowedCategories") as string,
    },
    create: {
      id: "default",
      adminDiscordId: session!.user!.id,
      serverVersion: formData.get("serverVersion") as string,
      modLoader: formData.get("modLoader") as string,
      voteDurationDays: parseInt(formData.get("voteDurationDays") as string),
      allowedCategories: formData.get("allowedCategories") as string,
    }
  });

  revalidatePath("/admin");
  return { success: true };
}

// Add this to the BOTTOM of app/actions/admin.ts
import { syncServerData } from "@/lib/pterodactyl"

export async function runServerSync() {
  const { detectedVersion, installedFiles } = await syncServerData();
  
  // Update version if we found it
  if (detectedVersion) {
    await prisma.systemSettings.update({
      where: { id: "default" },
      data: { serverVersion: detectedVersion }
    });
  }

  // Wipe the DB's installed mods and replace them with the ACTUAL files on the server
  await prisma.installedMod.deleteMany();
  
  if (installedFiles.length > 0) {
    await prisma.installedMod.createMany({
      data: installedFiles.map(filename => ({
        modrinthId: filename, // We don't have the ID, so we use the filename as a unique key
        name: filename,
        isActive: true
      }))
    });
  }

  revalidatePath("/");
  revalidatePath("/admin");
  return { success: true, version: detectedVersion, count: installedFiles.length };
}

export async function factoryResetSystem() {
  // Deletes EVERYTHING except Admin Settings
  await prisma.vote.deleteMany();
  await prisma.modCandidate.deleteMany();
  await prisma.votingSession.deleteMany();
  await prisma.installedMod.deleteMany();
  
  revalidatePath("/");
  return { success: true };
}