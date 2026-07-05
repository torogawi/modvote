// app/actions/voting.ts
"use server"

import { prisma } from "@/lib/prisma"
import { fetchWeeklyCandidates } from "@/lib/modrinth"
import { getServerSession } from "next-auth/next"
import { authOptions } from "@/lib/auth"
import { revalidatePath } from "next/cache"

/**
 * ACTION 1: Open a new Weekly Voting Session
 */
// Replace createVotingSession in app/actions/voting.ts
export async function createVotingSession() {
  try {
    const existingSession = await prisma.votingSession.findFirst({
      where: { status: "OPEN" }
    });
    if (existingSession) return { error: "A voting session is already open!" };

    const settings = await prisma.systemSettings.findUnique({ where: { id: "default" } });
    if (!settings) return { error: "Admin settings not configured." };

    // Fetch the filtered valid mods from the top 100
    let validMods = await fetchWeeklyCandidates(100); // Pass 100 as the limit
    
    if (validMods.length === 0) return { error: "Could not find any compatible mods!" };

    // Shuffle the array randomly to get a unique ballot every time
    validMods = validMods.sort(() => 0.5 - Math.random());
    
    // Slice exactly 30 mods
    const finalCandidates = validMods.slice(0, 30);

    const endDate = new Date();
    endDate.setDate(endDate.getDate() + settings.voteDurationDays);

    const session = await prisma.votingSession.create({
      data: {
        endDate,
        status: "OPEN",
        candidates: {
          create: [
            // Insert the 30 Mods
            ...finalCandidates.map(mod => ({
              modrinthId: mod.project_id,
              name: mod.title,
              description: mod.description || "No description provided.",
              iconUrl: mod.icon_url || null
            })),
            // INJECT THE FAKE "REROLL" OPTION AT THE END
            {
              modrinthId: "reroll-ballot",
              name: "🔄 Reroll Ballot",
              description: "None of these look fun? Vote here to scrap this ballot and generate 30 new random popular mods!",
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
/**
 * ACTION 2: Cast a Vote
 */
export async function castVote(sessionId: string, candidateId: string) {
  // 1. Verify user is logged in
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return { error: "You must be logged in with Discord to vote." };
  }

  try {
    // 2. Use a Prisma Transaction
    // This ensures both database writes succeed. If one fails, both rollback.
    await prisma.$transaction([
      // Attempt to register the user's vote
      prisma.vote.create({
        data: {
          userId: session.user.id,
          sessionId: sessionId,
          candidateId: candidateId
        }
      }),
      
      // Increment the vote count on the specific mod
      prisma.modCandidate.update({
        where: { id: candidateId },
        data: { voteCount: { increment: 1 } }
      })
    ]);

    revalidatePath("/"); // Update UI immediately
    return { success: true };

  } catch (error: any) {
    // P2002 is Prisma's error code for a Unique Constraint Violation
    // This catches our @@unique([userId, sessionId]) from the schema!
    if (error.code === 'P2002') {
      return { error: "You have already voted in this week's session!" };
    }
    console.error("Voting error:", error);
    return { error: "An unexpected error occurred while voting." };
  }
}