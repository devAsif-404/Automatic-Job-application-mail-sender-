import { z } from "zod";

export const EmailSchema = z
  .string()
  .trim()
  .min(3, "Email is required")
  .max(254, "Email is too long")
  .email("Invalid email format");

export const ContactRowSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(150),
  email: EmailSchema,
  company: z.string().trim().min(1, "Company name is required").max(150),
  role: z.string().trim().max(150).optional().nullable(),
  jobDescription: z.string().trim().max(10000).optional().nullable(),
  jobUrl: z.string().trim().url("Invalid URL format").optional().nullable().or(z.literal("")),
});

export const ResumeStructuredDataSchema = z.object({
  fullName: z.string().default(""),
  email: z.string().default(""),
  phone: z.string().default(""),
  location: z.string().default(""),
  summary: z.string().default(""),
  education: z.array(
    z.object({
      institution: z.string().default(""),
      degree: z.string().default(""),
      fieldOfStudy: z.string().default(""),
      graduationYear: z.string().default(""),
    })
  ).default([]),
  skills: z.array(z.string()).default([]),
  experience: z.array(
    z.object({
      company: z.string().default(""),
      title: z.string().default(""),
      startDate: z.string().default(""),
      endDate: z.string().default(""),
      highlights: z.array(z.string()).default([]),
    })
  ).default([]),
  projects: z.array(
    z.object({
      name: z.string().default(""),
      description: z.string().default(""),
      technologies: z.array(z.string()).default([]),
      link: z.string().optional().default(""),
    })
  ).default([]),
  certifications: z.array(z.string()).default([]),
  achievements: z.array(z.string()).default([]),
  tools: z.array(z.string()).default([]),
});

export type ResumeStructuredData = z.infer<typeof ResumeStructuredDataSchema>;

export const GeneratedEmailDraftSchema = z.object({
  subject: z.string().min(5, "Subject too short").max(200, "Subject too long"),
  greeting: z.string().min(2, "Greeting too short").max(100, "Greeting too long"),
  emailBody: z.string().min(30, "Email body too short").max(10000, "Email body too long"),
  coverLetter: z.string().min(30, "Cover letter too short").max(10000, "Cover letter too long"),
  validationNotes: z.string().optional().default("Generated strictly adhering to verified resume facts."),
});

export type GeneratedEmailDraft = z.infer<typeof GeneratedEmailDraftSchema>;

export const SmtpConfigSchema = z.object({
  host: z.string().min(1, "SMTP Host is required"),
  port: z.coerce.number().int().min(1).max(65535).default(587),
  secure: z.boolean().default(false),
  user: z.string().min(1, "SMTP User / Email is required"),
  pass: z.string().min(1, "SMTP Password or App Password is required"),
  from: z.string().min(1, "Sender 'From' name and email is required"),
  replyTo: z.string().email("Invalid reply-to email").optional().or(z.literal("")),
});

export type SmtpConfig = z.infer<typeof SmtpConfigSchema>;

export const SendBatchRequestSchema = z.object({
  campaignName: z.string().min(1, "Campaign name is required").max(100),
  contactIds: z.array(z.string()).min(1, "At least one contact must be selected"),
  delayMs: z.number().int().min(500).max(60000).default(3000),
  concurrency: z.number().int().min(1).max(5).default(2),
});

export type SendBatchRequest = z.infer<typeof SendBatchRequestSchema>;
