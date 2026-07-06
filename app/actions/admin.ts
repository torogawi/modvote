// app/actions/admin.ts
"use server"

import { prisma } from "@/lib/prisma"
import { getServerSession } from "next-auth/next"
import { authOptions } from "@/lib/auth"
import { revalidatePath } from "next/cache"
import { syncServerData } from "@/lib/pterodactyl"

async function checkAdmin() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return false;

  const settings = await prisma.systemSettings.findUnique({ where: { id: "default" } });
  if (!settings) return true; 

  return settings.adminDiscordId === session.user.id;
}

export async function getSettings() {
  return await prisma.systemSettings.findUnique({ where: { id: "default" } });
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
      serverIp: formData.get("serverIp") as string,
      automodpackFingerprint: formData.get("automodpackFingerprint") as string,
    },
    create: {
      id: "default",
      adminDiscordId: session!.user!.id,
      serverVersion: formData.get("serverVersion") as string,
      modLoader: formData.get("modLoader") as string,
      voteDurationDays: parseInt(formData.get("voteDurationDays") as string),
      allowedCategories: formData.get("allowedCategories") as string,
      serverIp: formData.get("serverIp") as string,
      automodpackFingerprint: formData.get("automodpackFingerprint") as string,
    }
  });

  revalidatePath("/admin");
  return { success: true };
}

export async function runServerSync() {
  const isAdmin = await checkAdmin();
  if (!isAdmin) return { error: "Unauthorized." };

  const { detectedVersion, installedFiles } = await syncServerData();
  
  if (detectedVersion) {
    await prisma.systemSettings.update({
      where: { id: "default" },
      data: { serverVersion: detectedVersion }
    });
  }

  await prisma.installedMod.deleteMany();
  
  if (installedFiles.length > 0) {
    await prisma.installedMod.createMany({
      data: installedFiles.map(filename => ({
        modrinthId: filename,
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
  const isAdmin = await checkAdmin();
  if (!isAdmin) return { error: "Unauthorized." };

  await prisma.vote.deleteMany();
  await prisma.modCandidate.deleteMany();
  await prisma.votingSession.deleteMany();
  await prisma.installedMod.deleteMany();
  
  revalidatePath("/");
  return { success: true };
}

export async function manuallyAddModToBallot(formData: FormData) {
  const isAdmin = await checkAdmin();
  if (!isAdmin) return { error: "Unauthorized." };

  let modId = formData.get("modId") as string;
  if (!modId) return { error: "Please enter a Modrinth ID or URL." };

  if (modId.includes("modrinth.com/mod/")) {
    modId = modId.split("modrinth.com/mod/")[1].split("/")[0];
  }

  const session = await prisma.votingSession.findFirst({ where: { status: "OPEN" } });
  if (!session) return { error: "There is no open voting session right now." };

  try {
    const response = await fetch(`https://api.modrinth.com/v2/project/${modId}`);
    if (!response.ok) return { error: "Could not find that mod on Modrinth." };
    const mod = await response.json();

    await prisma.modCandidate.create({
      data: {
        sessionId: session.id,
        modrinthId: mod.id,
        name: mod.title,
        description: mod.description,
        iconUrl: mod.icon_url || null
      }
    });

    revalidatePath("/");
    return { success: true };
  } catch (e) {
    return { error: "Failed to add mod." };
  }
}