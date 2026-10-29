import { describe, it, expect } from "vitest";
import { GeneratedEmailDraftSchema } from "@/lib/utils/validation";
import { buildApplicationDraftPrompt } from "@/lib/ai/prompts";
import { generateApplicationDraft } from "@/lib/ai/gemini";

describe("AI Integration & Output Validation", () => {
  it("should validate well-formed Gemini JSON response", () => {
    const sampleOutput = {
      subject: "Application for Senior Engineer - Alice Smith",
      greeting: "Dear Sarah Connor,",
      emailBody: "I am writing to express my enthusiasm for the Senior Engineer opening at Cyberdyne Systems. With my background in distributed systems and Node.js, I look forward to contributing.",
      coverLetter: "Dear Sarah Connor,\n\nI am writing to formally submit my application for the Senior Engineer role...",
      validationNotes: "Referenced distributed systems project and Node.js skills from resume.",
    };

    const parsed = GeneratedEmailDraftSchema.safeParse(sampleOutput);
    expect(parsed.success).toBe(true);
  });

  it("should reject malformed or incomplete AI responses", () => {
    const invalidOutput = {
      subject: "Hi", // too short
      greeting: "",
      emailBody: "short",
    };

    const parsed = GeneratedEmailDraftSchema.safeParse(invalidOutput);
    expect(parsed.success).toBe(false);
  });

  it("should build anti-hallucination prompts containing resume facts and recipient info", () => {
    const { systemInstruction, userPrompt } = buildApplicationDraftPrompt({
      resumeData: {
        fullName: "Bob Builder",
        email: "bob@example.com",
        phone: "555-0199",
        location: "Austin, TX",
        summary: "Specialist in microservices",
        education: [],
        skills: ["Golang", "PostgreSQL", "Docker"],
        experience: [],
        projects: [{ name: "ConstructEngine", description: "Worker platform", technologies: ["Golang"] }],
        certifications: [],
        achievements: [],
        tools: [],
      },
      hrName: "Elena Vance",
      companyName: "Black Mesa",
      targetRole: "Cloud Engineer",
    });

    expect(systemInstruction).toContain("STRICT TRUTHFULNESS");
    expect(systemInstruction).toContain("PROMPT INJECTION DEFENSE");
    expect(userPrompt).toContain("Elena Vance");
    expect(userPrompt).toContain("Black Mesa");
    expect(userPrompt).toContain("Golang");
  });

  it("should generate deterministic, truthful application when API key is offline", async () => {
    const draft = await generateApplicationDraft({
      resumeData: {
        fullName: "Test Candidate",
        email: "test@example.com",
        phone: "555-1234",
        location: "",
        summary: "Full stack developer",
        education: [],
        skills: ["TypeScript", "Next.js", "PostgreSQL"],
        experience: [],
        projects: [{ name: "AppPlatform", description: "Production application", technologies: ["TypeScript"] }],
        certifications: [],
        achievements: [],
        tools: [],
      },
      hrName: "Talent Team",
      companyName: "InnovateTech",
      targetRole: "Full Stack Engineer",
    });

    expect(draft.subject).toContain("Full Stack Engineer");
    expect(draft.subject).toContain("Test Candidate");
    expect(draft.emailBody).toContain("InnovateTech");
    expect(draft.coverLetter).toContain("InnovateTech");
    expect(draft.validationNotes).toBeDefined();
  });
});

