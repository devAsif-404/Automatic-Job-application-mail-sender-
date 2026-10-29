import pdfParse from "pdf-parse";
import mammoth from "mammoth";
import { ResumeStructuredData, ResumeStructuredDataSchema } from "../utils/validation";

/**
 * Extracts raw plain text from PDF or DOCX file buffers.
 */
export async function extractTextFromFileBuffer(
  buffer: Buffer,
  mimeType: string,
  fileName: string
): Promise<string> {
  const ext = fileName.split(".").pop()?.toLowerCase();

  if (mimeType === "application/pdf" || ext === "pdf") {
    try {
      const data = await pdfParse(buffer);
      if (!data.text || !data.text.trim()) {
        throw new Error("PDF file contains no readable text (it may be scanned/image-only).");
      }
      return data.text.trim();
    } catch (err: any) {
      throw new Error(`Failed to parse PDF document: ${err.message || err}`);
    }
  }

  if (
    mimeType === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
    ext === "docx"
  ) {
    try {
      const result = await mammoth.extractRawText({ buffer });
      if (!result.value || !result.value.trim()) {
        throw new Error("DOCX file contains no readable text.");
      }
      return result.value.trim();
    } catch (err: any) {
      throw new Error(`Failed to parse DOCX document: ${err.message || err}`);
    }
  }

  throw new Error("Unsupported file format. Please upload a PDF (.pdf) or Word document (.docx).");
}

/**
 * Heuristic fallback parser that structures raw resume text into fields
 * without hallucinating any content.
 */
export function extractStructuredInfoHeuristic(rawText: string): ResumeStructuredData {
  const lines = rawText.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);

  // Email detection
  const emailRegex = /([a-zA-Z0-9._-]+@[a-zA-Z0-9._-]+\.[a-zA-Z0-9_-]+)/;
  const emailMatch = rawText.match(emailRegex);
  const email = emailMatch ? emailMatch[1] : "";

  // Phone detection (various international formats)
  const phoneRegex = /(\+?\d{1,3}[-.\s]?)?(\(?\d{3}\)?[-.\s]?)?\d{3}[-.\s]?\d{4}/;
  const phoneMatch = rawText.match(phoneRegex);
  const phone = phoneMatch ? phoneMatch[0] : "";

  // Full Name detection: Typically first non-empty line with 2-4 words that isn't an email/URL/heading
  let fullName = "";
  for (const line of lines.slice(0, 5)) {
    if (
      !line.includes("@") &&
      !line.includes("http") &&
      !/resume|curriculum|cv|profile|contact/i.test(line) &&
      line.split(/\s+/).length >= 2 &&
      line.split(/\s+/).length <= 5
    ) {
      fullName = line;
      break;
    }
  }

  // Section splitting
  const sections: Record<string, string[]> = {
    summary: [],
    skills: [],
    experience: [],
    education: [],
    projects: [],
    certifications: [],
  };

  let currentSection = "summary";

  for (const line of lines) {
    const lower = line.toLowerCase();
    if (/^(skills|technical skills|skills & expertise|technologies)/i.test(lower)) {
      currentSection = "skills";
      continue;
    } else if (/^(experience|work experience|employment history|work history)/i.test(lower)) {
      currentSection = "experience";
      continue;
    } else if (/^(education|academic background|qualifications)/i.test(lower)) {
      currentSection = "education";
      continue;
    } else if (/^(projects|personal projects|key projects|academic projects)/i.test(lower)) {
      currentSection = "projects";
      continue;
    } else if (/^(certifications|licenses & certifications|achievements|awards)/i.test(lower)) {
      currentSection = "certifications";
      continue;
    }

    if (currentSection) {
      sections[currentSection].push(line);
    }
  }

  // Parse skills: split by commas, bullet points, pipes, or newlines
  const rawSkillsText = sections.skills.join(", ");
  const skillsList = rawSkillsText
    .split(/[,•|·\n\r/]/)
    .map((s) => s.trim())
    .filter((s) => s.length > 1 && s.length < 40 && !/^(skills|technologies|tools):?/i.test(s));
  const uniqueSkills = Array.from(new Set(skillsList));

  // Parse education
  const educationItems = sections.education.length > 0
    ? [
        {
          institution: sections.education[0] || "",
          degree: sections.education[1] || "",
          fieldOfStudy: "",
          graduationYear: (sections.education.join(" ").match(/\b(20\d{2}|19\d{2})\b/) || [""])[0],
        },
      ]
    : [];

  // Parse projects
  const projectItems = sections.projects.length > 0
    ? [
        {
          name: sections.projects[0] || "Featured Project",
          description: sections.projects.slice(1, 4).join(" "),
          technologies: [],
          link: "",
        },
      ]
    : [];

  // Parse experience
  const experienceItems = sections.experience.length > 0
    ? [
        {
          company: sections.experience[0] || "",
          title: sections.experience[1] || "",
          startDate: "",
          endDate: "",
          highlights: sections.experience.slice(2, 6),
        },
      ]
    : [];

  return ResumeStructuredDataSchema.parse({
    fullName: fullName || "Candidate",
    email: email || "",
    phone: phone || "",
    location: "",
    summary: sections.summary.slice(0, 4).join(" "),
    education: educationItems,
    skills: uniqueSkills,
    experience: experienceItems,
    projects: projectItems,
    certifications: sections.certifications.slice(0, 5),
    achievements: [],
    tools: uniqueSkills.filter((s) => /git|docker|linux|aws|azure|jira|figma|vs code/i.test(s)),
  });
}

