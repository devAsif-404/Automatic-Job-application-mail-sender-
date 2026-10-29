import { Queue, Worker, Job } from "bullmq";
import IORedis from "ioredis";
import { runCampaignQueue } from "./db-queue";

const redisUrl = process.env.REDIS_URL || "redis://localhost:6379";

let redisConnection: IORedis | null = null;
let emailQueue: Queue | null = null;

try {
  redisConnection = new IORedis(redisUrl, {
    maxRetriesPerRequest: null,
    enableReadyCheck: false,
    retryStrategy: (times) => {
      if (times > 2) return null; // stop reconnecting if redis isn't present
      return Math.min(times * 500, 2000);
    },
  });

  redisConnection.on("error", (err) => {
    // Suppress noisy logs if redis is not running locally; the db-queue takes over
    if (process.env.DEBUG_REDIS) {
      console.warn("[Redis] Connection error:", err.message);
    }
  });

  emailQueue = new Queue("bulk-email-queue", {
    connection: redisConnection,
    defaultJobOptions: {
      attempts: 3,
      backoff: {
        type: "exponential",
        delay: 5000,
      },
      removeOnComplete: true,
      removeOnFail: false,
    },
  });
} catch (e) {
  console.log("[BullMQ] Redis not available, using in-memory / persistent DB queue.");
}

export { emailQueue };

/**
 * Enqueues a campaign into BullMQ if Redis is active, or invokes the DB queue runner directly.
 */
export async function enqueueCampaign(campaignId: string): Promise<void> {
  if (emailQueue && redisConnection && redisConnection.status === "ready") {
    try {
      await emailQueue.add("send-campaign", { campaignId }, { jobId: `campaign-${campaignId}` });
      console.log(`[BullMQ] Enqueued campaign ${campaignId} into Redis.`);
      return;
    } catch (err: any) {
      console.warn("[BullMQ] Redis enqueue failed, falling back to persistent DB queue:", err.message);
    }
  }

  // Fallback / standard DB queue runner
  runCampaignQueue(campaignId).catch((err) => {
    console.error(`[DB Queue] Error processing campaign ${campaignId}:`, err);
  });
}

/**
 * Initializes BullMQ worker if running in dedicated worker process.
 */
export function startWorker(): Worker | null {
  if (!redisConnection) return null;

  const worker = new Worker(
    "bulk-email-queue",
    async (job: Job<{ campaignId: string }>) => {
      console.log(`[BullMQ Worker] Processing campaign ${job.data.campaignId}...`);
      await runCampaignQueue(job.data.campaignId);
    },
    {
      connection: redisConnection,
      concurrency: 1,
    }
  );

  worker.on("completed", (job) => {
    console.log(`[BullMQ Worker] Campaign ${job.data.campaignId} completed!`);
  });

  worker.on("failed", (job, err) => {
    console.error(`[BullMQ Worker] Campaign ${job?.data.campaignId} failed:`, err.message);
  });

  return worker;
}
