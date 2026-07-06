// app/actions/voting.ts
"use server"

import { prisma } from "@/lib/prisma"
import { fetchWeeklyCandidates } from "@/lib/modrinth"
import { getServerSession } from "next-auth/next"
import { authOptions } from "@/lib/auth"
import { revalidatePath } from "next/cache"

export async function createVotingSession() {
  try {
    const existingSession = await prisma.votingSession.findFirst({
      where: { status: "OPEN" }
    });
    if (existingSession) return { error: "A voting session is already open!" };

    const settings = await prisma.systemSettings.findUnique({ where: { id: "default" } });
    if (!settings) return { error: "Admin settings not configured." };

    // Fetch up to 300 valid mods
    let validMods = await fetchWeeklyCandidates(300);
    
    if (validMods.length === 0) return { error: "Could not find any compatible mods!" };

    // Shuffle the array randomly to get a unique ballot
    validMods = validMods.sort(() => 0.5 - Math.random());
    
    // Slice exactly up to 300 mods
    const finalCandidates = validMods.slice(0, 300);

    const endDate = new Date();
    endDate.setDate(endDate.getDate() + settings.voteDurationDays);

    const session = await prisma.votingSession.create({
      data: {
        endDate,
        status: "OPEN",
        candidates: {
          create: [
            ...finalCandidates.map(mod => ({
              modrinthId: mod.project_id,
              name: mod.title,
              description: mod.description || "No description provided.",
              iconUrl: mod.icon_url || null
            })),
            {
              modrinthId: "reroll-ballot",
              name: "🔄 Reroll Ballot",
              description: "None of these look fun? Vote here to scrap this ballot and generate a brand new random set of mods!",
              iconUrl: null
            }
          ]
        }
      }
    });

    revalidatePath("/");
    return { success: true, sessionId: session.id };
  } catch (error) {
    console.error("Failed to create session:", error);
    return { error: "Failed to fetch mods from Modrinth." };
  }
}

export async function castVote(sessionId: string, candidateId: string) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return { error: "You must be logged in with Discord to vote." };
  }

  try {
    await prisma.$transaction([
      prisma.vote.create({
        data: {
          userId: session.user.id,
          sessionId: sessionId,
          candidateId: candidateId
        }
      }),
      prisma.modCandidate.update({
        where: { id: candidateId },
        data: { voteCount: { increment: 1 } }
      })
    ]);

    revalidatePath("/");
    return { success: true };

  } catch (error: any) {
    if (error.code === 'P2002') {
      return { error: "You have already voted in this week's session!" };
    }
    console.error("Voting error:", error);
    return { error: "An unexpected error occurred while voting." };
  }
}