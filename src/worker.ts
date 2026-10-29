import dotenv from "dotenv";
dotenv.config();

import { startWorker } from "./lib/queue/bullmq";
import { prisma } from "./lib/db/prisma";
import { runCampaignQueue } from "./lib/queue/db-queue";

console.log("=========================================");
console.log("  AI Job Application Platform - Worker   ");
console.log("=========================================");

const bullWorker = startWorker();
if (bullWorker) {
  console.log("[Worker] BullMQ Worker listening on 'bulk-email-queue'");
} else {
  console.log("[Worker] Running in Persistent Database Queue Polling mode");
}

// Background poller that picks up any unstarted RUNNING or PENDING campaigns
let isPolling = false;
async function pollPendingCampaigns() {
  if (isPolling) return;
  isPolling = true;

  try {
    const activeCampaigns = await prisma.campaign.findMany({
      where: { status: "RUNNING" },
      select: { id: true },
    });

    for (const c of activeCampaigns) {
      console.log(`[Worker] Resuming active campaign ${c.id}...`);
      await runCampaignQueue(c.id);
    }
  } catch (err: any) {
    console.error("[Worker] Error in poll loop:", err.message);
  } finally {
    isPolling = false;
  }
}

// Poll every 5 seconds for pending/interrupted campaigns
setInterval(pollPendingCampaigns, 5000);
pollPendingCampaigns();

process.on("SIGINT", async () => {
  console.log("[Worker] Shutting down gracefully...");
  if (bullWorker) await bullWorker.close();
  process.exit(0);
});

