import { prisma } from "../db/prisma";
import { sendApplicationEmail } from "../email/smtp";
import { getActiveSmtpConfig } from "../settings/config";

/**
 * Executes sending for a campaign using persistent database queue.
 */
export async function runCampaignQueue(campaignId: string): Promise<void> {
  const campaign = await prisma.campaign.findUnique({
    where: { id: campaignId },
    include: {
      jobs: {
        where: {
          status: { in: ["PENDING", "QUEUED", "PROCESSING"] },
        },
        include: {
          contact: true,
          draft: {
            include: {
              resume: true,
            },
          },
        },
        orderBy: { createdAt: "asc" },
      },
    },
  });

  if (!campaign) {
    throw new Error(`Campaign ${campaignId} not found.`);
  }

  // Load SMTP config
  const smtpConfig = await getActiveSmtpConfig();
  if (!smtpConfig) {
    await prisma.campaign.update({
      where: { id: campaignId },
      data: { status: "FAILED" },
    });
    throw new Error("No active SMTP configuration found. Please configure SMTP in Settings.");
  }

  // Mark campaign running
  await prisma.campaign.update({
    where: { id: campaignId },
    data: {
      status: "RUNNING",
      startedAt: campaign.startedAt || new Date(),
    },
  });

  // Track counts
  let sentCount = campaign.sentCount;
  let failedCount = campaign.failedCount;
  let skippedCount = campaign.skippedCount;

  for (const job of campaign.jobs) {
    // Check if campaign was cancelled or paused
    const liveCampaign = await prisma.campaign.findUnique({
      where: { id: campaignId },
      select: { status: true },
    });

    if (liveCampaign?.status === "PAUSED") {
      console.log(`[Queue] Campaign ${campaignId} was PAUSED. Halting execution.`);
      return;
    }

    if (liveCampaign?.status === "CANCELLED") {
      console.log(`[Queue] Campaign ${campaignId} was CANCELLED. Cancelling remaining jobs.`);
      await prisma.sendingJob.updateMany({
        where: {
          campaignId,
          status: { in: ["PENDING", "QUEUED"] },
        },
        data: { status: "CANCELLED" },
      });
      return;
    }

    // Safety checks
    const { contact, draft } = job;

    if (!contact.isValid || contact.isExcluded) {
      skippedCount++;
      await prisma.sendingJob.update({
        where: { id: job.id },
        data: {
          status: "SKIPPED",
          lastError: "Contact is invalid or excluded.",
        },
      });
      continue;
    }

    if (!draft.isApproved) {
      skippedCount++;
      await prisma.sendingJob.update({
        where: { id: job.id },
        data: {
          status: "SKIPPED",
          lastError: "Draft was not approved by user.",
        },
      });
      continue;
    }

    // Check duplicate delivery prevention: has this contact already received an email?
    const existingSentJob = await prisma.sendingJob.findFirst({
      where: {
        contactId: contact.id,
        status: "SENT",
        id: { not: job.id },
      },
    });

    if (existingSentJob) {
      skippedCount++;
      await prisma.sendingJob.update({
        where: { id: job.id },
        data: {
          status: "SKIPPED",
          lastError: "Duplicate prevention safeguard: email already sent to this contact.",
        },
      });
      continue;
    }

    // Mark job PROCESSING
    await prisma.sendingJob.update({
      where: { id: job.id },
      data: { status: "PROCESSING" },
    });

    const startTime = Date.now();
    let attemptStatus = "FAILED";
    let attemptResponse = "";
    let attemptError = "";

    try {
      const emailResult = await sendApplicationEmail({
        smtpConfig,
        to: contact.email,
        toName: contact.name,
        subject: draft.subject,
        bodyText: draft.emailBody,
        attachmentPath: draft.resume.filePath,
        attachmentFileName: draft.resume.originalName,
        attachmentMimeType: draft.resume.mimeType,
      });

      const durationMs = Date.now() - startTime;

      if (emailResult.success) {
        attemptStatus = "SUCCESS";
        attemptResponse = emailResult.response || "250 Accepted by SMTP";
        sentCount++;

        await prisma.sendingJob.update({
          where: { id: job.id },
          data: {
            status: "SENT",
            smtpMessageId: emailResult.messageId || null,
            acceptedAt: new Date(),
            attempts: job.attempts + 1,
            lastError: null,
          },
        });

        // Update draft status
        await prisma.applicationDraft.update({
          where: { id: draft.id },
          data: { status: "SENT" },
        });
      } else {
        attemptError = emailResult.errorMessage || "SMTP sending failed.";
        failedCount++;

        await prisma.sendingJob.update({
          where: { id: job.id },
          data: {
            status: "FAILED",
            attempts: job.attempts + 1,
            lastError: attemptError,
          },
        });
      }

      // Record SmtpAttempt
      await prisma.smtpAttempt.create({
        data: {
          sendingJobId: job.id,
          attemptNumber: job.attempts + 1,
          status: attemptStatus,
          response: attemptResponse || null,
          errorMessage: attemptError || null,
          durationMs,
        },
      });
    } catch (sendErr: any) {
      const durationMs = Date.now() - startTime;
      attemptError = sendErr.message || String(sendErr);
      failedCount++;

      await prisma.sendingJob.update({
        where: { id: job.id },
        data: {
          status: "FAILED",
          attempts: job.attempts + 1,
          lastError: attemptError,
        },
      });

      await prisma.smtpAttempt.create({
        data: {
          sendingJobId: job.id,
          attemptNumber: job.attempts + 1,
          status: "FAILED",
          errorMessage: attemptError,
          durationMs,
        },
      });
    }

    // Update live counts on campaign
    const remainingPending = Math.max(0, campaign.totalCount - sentCount - failedCount - skippedCount);
    await prisma.campaign.update({
      where: { id: campaignId },
      data: {
        sentCount,
        failedCount,
        skippedCount,
        pendingCount: remainingPending,
      },
    });

    // Configurable delay between sends
    if (campaign.delayMs > 0) {
      await new Promise((res) => setTimeout(res, campaign.delayMs));
    }
  }

  // Final status update for campaign
  const finalStatus = failedCount > 0 && sentCount === 0 ? "FAILED" : "COMPLETED";
  await prisma.campaign.update({
    where: { id: campaignId },
    data: {
      status: finalStatus,
      completedAt: new Date(),
      pendingCount: 0,
      sentCount,
      failedCount,
      skippedCount,
    },
  });

  // Audit event
  await prisma.auditEvent.create({
    data: {
      action: "CAMPAIGN_COMPLETED",
      entityType: "Campaign",
      entityId: campaignId,
      details: JSON.stringify({
        campaignName: campaign.name,
        total: campaign.totalCount,
        sent: sentCount,
        failed: failedCount,
        skipped: skippedCount,
      }),
    },
  });
}
