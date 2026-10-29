import { GoogleGenerativeAI } from "@google/generative-ai";
import { GeneratedEmailDraft, GeneratedEmailDraftSchema } from "../utils/validation";
import { buildApplicationDraftPrompt, DraftPromptInput } from "./prompts";
import { redactSensitive } from "../utils/sanitize";

const DEFAULT_MODEL = process.env.GEMINI_MODEL || "gemini-2.5-flash";

/**
 * Exponential backoff helper for handling Gemini rate limits (429) or transient network issues.
 */
async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  retries = 3,
  initialDelayMs = 1500
): Promise<T> {
  let attempt = 0;
  while (attempt < retries) {
    try {
      return await fn();
    } catch (error: any) {
      attempt++;
      const errorMessage = String(error?.message || error);
      const isRateLimit = errorMessage.includes("429") || /quota|rate limit/i.test(errorMessage);
      const isTransient = isRateLimit || errorMessage.includes("503") || errorMessage.includes("ECONNRESET");

      if (attempt >= retries || !isTransient) {
        throw error;
      }

      const delay = initialDelayMs * Math.pow(2, attempt - 1);
      console.warn(`[Gemini API] Transient error (${errorMessage.slice(0, 80)}). Retrying in ${delay}ms... (Attempt ${attempt}/${retries})`);
      await new Promise((res) => setTimeout(res, delay));
    }
  }
  throw new Error("Maximum retry attempts reached for Gemini API.");
}

/**
 * Fallback draft generator used when no Gemini API key is configured
 * or for offline test verification.
 */
function generateDeterministicFallbackDraft(input: DraftPromptInput): GeneratedEmailDraft {
  const hrGreeting = input.hrName && input.hrName.trim() ? input.hrName.trim() : "Hiring Team";
  const candidateName = input.resumeData.fullName || "Candidate";
  const role = input.targetRole || "Software Engineer";
  const company = input.companyName;
  const topSkills = input.resumeData.skills.slice(0, 5).join(", ") || "software engineering best practices";
  const topProject = input.resumeData.projects[0];
  const projectMention = topProject
    ? `including ${topProject.name} (${topProject.technologies?.slice(0, 3).join(", ") || "full-stack architecture"})`
    : "building scalable web systems";

  const subject = `Application for ${role} - ${candidateName}`;
  const greeting = `Dear ${hrGreeting},`;

  const emailBody = `I hope this email finds you well.

I am writing to express my strong interest in joining ${company} as a ${role}. With hands-on experience in ${topSkills}, I specialize in building robust, performant applications, ${projectMention}.

I have attached my complete resume for your review. I would welcome the opportunity to discuss how my technical background aligns with ${company}'s goals.

Thank you for your time and consideration.

Best regards,
${candidateName}
${input.resumeData.email || ""}
${input.resumeData.phone || ""}`;

  const coverLetter = `Dear ${hrGreeting},

I am writing to apply for the ${role} position at ${company}. Having reviewed your engineering culture and current initiatives, I am eager to contribute my technical foundation in ${topSkills} to your team.

Throughout my experience, I have focused on writing clean, scalable code and delivering high-impact solutions. A notable highlight from my work includes ${topProject ? topProject.name + ": " + (topProject.description || "delivering modular, test-driven applications") : "collaborating across full product lifecycles to design resilient web architectures"}.

I admire ${company}'s focus on engineering excellence and would be thrilled to bring my problem-solving skills, curiosity, and collaborative mindset to your team. My resume is attached with comprehensive details on my education, projects, and professional background.

Thank you for considering my application. I look forward to the possibility of discussing this opportunity further.

Sincerely,
${candidateName}`;

  return {
    subject,
    greeting,
    emailBody,
    coverLetter,
    validationNotes: "Draft generated deterministically using verified resume details (offline mode).",
  };
}

/**
 * Generates an ATS-friendly, personalized application email and cover letter using Google Gemini API.
 */
export async function generateApplicationDraft(
  input: DraftPromptInput,
  customApiKey?: string
): Promise<GeneratedEmailDraft> {
  const apiKey = customApiKey || process.env.GEMINI_API_KEY;

  if (!apiKey || apiKey.trim() === "" || apiKey === "your_gemini_api_key_here") {
    console.info("[Gemini AI] No valid GEMINI_API_KEY provided; using truthful offline profile generator.");
    return generateDeterministicFallbackDraft(input);
  }

  const { systemInstruction, userPrompt } = buildApplicationDraftPrompt(input);

  const modelName = process.env.GEMINI_MODEL || DEFAULT_MODEL;

  const runGeneration = async (): Promise<GeneratedEmailDraft> => {
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({
      model: modelName,
      systemInstruction,
      generationConfig: {
        responseMimeType: "application/json",
        temperature: 0.3,
        maxOutputTokens: 2048,
      },
    });

    // 30 second timeout promise
    const timeoutPromise = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error("Gemini API request timed out after 30 seconds.")), 30000)
    );

    const apiPromise = model.generateContent(userPrompt);
    const result = await Promise.race([apiPromise, timeoutPromise]);
    const responseText = result.response.text();

    if (!responseText) {
      throw new Error("Empty response received from Gemini API.");
    }

    // Clean JSON markdown fences if present
    const cleanJson = responseText
      .replace(/^```json\s*/i, "")
      .replace(/^```\s*/i, "")
      .replace(/```$/i, "")
      .trim();

    let parsed: any;
    try {
      parsed = JSON.parse(cleanJson);
    } catch (parseErr) {
      throw new Error(`Failed to parse Gemini output as JSON: ${cleanJson.slice(0, 100)}...`);
    }

    // Validate with Zod schema
    const validation = GeneratedEmailDraftSchema.safeParse(parsed);
    if (!validation.success) {
      console.warn("[Gemini API] Output schema validation mismatch:", validation.error.format());
      throw new Error(`Malformed AI draft format: ${validation.error.errors[0]?.message}`);
    }

    return validation.data;
  };

  try {
    return await retryWithBackoff(runGeneration, 3, 2000);
  } catch (err: any) {
    const safeError = redactSensitive(err?.message || String(err));
    console.error("[Gemini API Error]", safeError);
    // If API quota or network completely failed, return safe truthful fallback
    return generateDeterministicFallbackDraft(input);
  }
}

