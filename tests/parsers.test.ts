import { describe, it, expect } from "vitest";
import {
  autoDetectColumnMapping,
  processRawRowsWithMapping,
} from "@/lib/parsers/csv-excel";
import { extractStructuredInfoHeuristic } from "@/lib/parsers/resume";
import { sanitizeForSpreadsheet, normalizeEmail, sanitizeFileName } from "@/lib/utils/sanitize";

describe("Spreadsheet & CSV Parsers", () => {
  it("should auto-detect standard and ambiguous column headers", () => {
    const headers = ["Recruiter Name", "HR Email", "Company Name", "Job Title"];
    const { mapping, isAmbiguous } = autoDetectColumnMapping(headers);

    expect(isAmbiguous).toBe(false);
    expect(mapping.nameColumn).toBe("Recruiter Name");
    expect(mapping.emailColumn).toBe("HR Email");
    expect(mapping.companyColumn).toBe("Company Name");
    expect(mapping.roleColumn).toBe("Job Title");
  });

  it("should flag ambiguous headers when required columns are absent", () => {
    const headers = ["Col1", "Col2", "Col3"];
    const { isAmbiguous } = autoDetectColumnMapping(headers);
    expect(isAmbiguous).toBe(true);
  });

  it("should validate emails, skip empty rows, and detect duplicates", () => {
    const rawRows = [
      { _originalRowIndex: "2", Name: "Alice Smith", Email: "alice@techcorp.com", Company: "TechCorp" },
      { _originalRowIndex: "3", Name: "Bob Jones", Email: "invalid-email-address", Company: "Initech" },
      { _originalRowIndex: "4", Name: "Alice S.", Email: "ALICE@TECHCORP.COM", Company: "TechCorp" }, // duplicate normalized
      { _originalRowIndex: "5", Name: "", Email: "carol@example.com", Company: "" }, // missing company
    ];

    const mapping = {
      nameColumn: "Name",
      emailColumn: "Email",
      companyColumn: "Company",
    };

    const { contacts, stats } = processRawRowsWithMapping(rawRows, mapping);

    expect(stats.totalRows).toBe(4);
    expect(stats.validCount).toBe(1); // Only Alice #1 is valid and non-duplicate
    expect(stats.invalidCount).toBe(3); // Bob (bad email), Alice #2 (duplicate), Carol (missing company)
    expect(stats.duplicateCount).toBe(1);

    expect(contacts[0].isValid).toBe(true);
    expect(contacts[1].isValid).toBe(false);
    expect(contacts[1].validationErrors).toContain("Invalid email format");
    expect(contacts[2].isDuplicate).toBe(true);
    expect(contacts[3].isValid).toBe(false);
    expect(contacts[3].validationErrors).toContain("Company name is required");
  });

  it("should sanitize spreadsheet values to mitigate formula injection (CWE-1236)", () => {
    expect(sanitizeForSpreadsheet("=CMD|' /C calc'!A0")).toBe("'=CMD|' /C calc'!A0");
    expect(sanitizeForSpreadsheet("+12345")).toBe("'+12345");
    expect(sanitizeForSpreadsheet("-54321")).toBe("'-54321");
    expect(sanitizeForSpreadsheet("@SUM(A1:A10)")).toBe("'@SUM(A1:A10)");
    expect(sanitizeForSpreadsheet("Normal Recruiter Name")).toBe("Normal Recruiter Name");
  });

  it("should normalize email addresses", () => {
    expect(normalizeEmail("  John.Doe@Example.COM  ")).toBe("john.doe@example.com");
  });

  it("should sanitize filenames to prevent path traversal", () => {
    expect(sanitizeFileName("../../etc/passwd")).toBe("passwd");
    expect(sanitizeFileName("..\\..\\windows\\system32\\cmd.exe")).toBe("cmd.exe");
    expect(sanitizeFileName("my_resume (1).pdf")).toBe("my_resume__1_.pdf");
  });
});

describe("Resume Text Parser", () => {
  it("should structure plain text resume into candidate profile without hallucinations", () => {
    const rawResume = `
Jane Doe
jane.doe@example.com | (555) 123-4567 | San Francisco, CA

SUMMARY
Experienced Full Stack Engineer with 5 years building high-concurrency Node.js and React systems.

SKILLS
TypeScript, React, Next.js, Node.js, PostgreSQL, Docker, Redis, Tailwind CSS

EXPERIENCE
Acme Cloud Systems - Senior Software Engineer
2022 - Present
• Designed microservices handling 10,000 requests per second.
• Reduced database query latency by 45% using Redis caching.

EDUCATION
University of California, Berkeley - B.S. in Computer Science
Graduated 2021

PROJECTS
OpenSource Analytics Platform
Engineered an end-to-end data processing pipeline using Kafka and Next.js.
`;

    const profile = extractStructuredInfoHeuristic(rawResume);

    expect(profile.fullName).toBe("Jane Doe");
    expect(profile.email).toBe("jane.doe@example.com");
    expect(profile.skills).toContain("TypeScript");
    expect(profile.skills).toContain("Next.js");
    expect(profile.skills).toContain("PostgreSQL");
    expect(profile.education.length).toBeGreaterThan(0);
    expect(profile.projects.length).toBeGreaterThan(0);
  });
});

