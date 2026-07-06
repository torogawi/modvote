// app/api/cron/route.ts
export const maxDuration = 60; // Allows Vercel extra time to handle heavy mod downloads

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { sendServerCommand } from '@/lib/pterodactyl';
import { createVotingSession } from '@/app/actions/voting';
import { endSessionAndDeploy } from '@/app/actions/deploy';

export async function GET(request: Request) {
  // 1. Security: Ensure only Vercel can trigger this script
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return new Response('Unauthorized', { status: 401 });
  }

  try {
    const currentSession = await prisma.votingSession.findFirst({
      where: { status: "OPEN" },
      include: { candidates: { orderBy: { voteCount: 'desc' } } }
    });

    // SCENARIO A: No active ballot. (A previous one ended yesterday).
    // Action: Start a brand new ballot!
    if (!currentSession) {
      await createVotingSession();
      await sendServerCommand('tellraw @a {"text":"[ModVote] A brand new mod ballot has started for this week! Vote now on the server website!","color":"green","bold":true}');
      return NextResponse.json({ status: "Started new session" });
    }

    const now = new Date();
    const endDate = new Date(currentSession.endDate);

    // SCENARIO B: The timer has expired!
    // Action: Announce, Close, Install, Restart.
    if (now >= endDate) {
      const winner = currentSession.candidates[0];
      await sendServerCommand(`tellraw @a {"text":"[ModVote] Voting has ended! The winner is ${winner.name}! The server will restart in 10 seconds to install it!","color":"red","bold":true}`);
      
      await endSessionAndDeploy();
      return NextResponse.json({ status: "Ended session and deployed winner" });
    }

    // SCENARIO C: Vote is active.
    // Action: Send daily chat reminder with Top 3 standings.
    const daysLeft = Math.ceil((endDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    const top3 = currentSession.candidates.slice(0, 3);
    
    let chatMsg = `[ModVote] ${daysLeft} days left to vote! Current Standings: `;
    top3.forEach((mod, index) => {
      chatMsg += `${index + 1}. ${mod.name} (${mod.voteCount} votes) `;
    });

    await sendServerCommand(`tellraw @a {"text":"${chatMsg}","color":"yellow"}`);
    
    return NextResponse.json({ status: "Sent daily reminder" });

  } catch (error) {
    console.error("Cron Error:", error);
    return NextResponse.json({ error: "Cron execution failed" }, { status: 500 });
  }
}