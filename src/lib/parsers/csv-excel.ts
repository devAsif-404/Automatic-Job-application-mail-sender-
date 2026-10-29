import ExcelJS from "exceljs";
import { parse as parseCsv } from "csv-parse/sync";
import { normalizeEmail } from "../utils/sanitize";
import { ContactRowSchema } from "../utils/validation";

export interface ColumnMapping {
  nameColumn: string;
  emailColumn: string;
  companyColumn: string;
  roleColumn?: string;
  jobDescColumn?: string;
  jobUrlColumn?: string;
}

export interface ParsedContactRow {
  rowNumber: number;
  name: string;
  email: string;
  normalizedEmail: string;
  company: string;
  role?: string | null;
  jobDescription?: string | null;
  jobUrl?: string | null;
  isValid: boolean;
  validationErrors?: string | null;
  isDuplicate: boolean;
  isExcluded: boolean;
}

export interface SpreadsheetParseResult {
  headers: string[];
  suggestedMapping: ColumnMapping;
  isAmbiguous: boolean;
  rawRows: Record<string, string>[];
  parsedContacts: ParsedContactRow[];
  stats: {
    totalRows: number;
    validCount: number;
    invalidCount: number;
    duplicateCount: number;
  };
}

/**
 * Normalizes header string for fuzzy matching (removes symbols, lowercases, trims).
 */
function normalizeHeader(header: string): string {
  return header.toLowerCase().replace(/[^a-z0-9]/g, "");
}

/**
 * Detects the best matching column name for a target field using heuristics.
 */
function findBestHeaderMatch(headers: string[], patterns: RegExp[]): string | undefined {
  for (const pattern of patterns) {
    const found = headers.find((h) => pattern.test(h.trim()));
    if (found) return found;
  }
  return undefined;
}

/**
 * Automatically detects column mappings for imported spreadsheet headers.
 */
export function autoDetectColumnMapping(headers: string[]): {
  mapping: ColumnMapping;
  isAmbiguous: boolean;
} {
  const nameCol =
    findBestHeaderMatch(headers, [
      /^(hr\s*name|recruiter\s*name|contact\s*name|talent\s*acquisition|hiring\s*manager)$/i,
      /^(name|full\s*name|contact|person)$/i,
      /name/i,
    ]) || "";

  const emailCol =
    findBestHeaderMatch(headers, [
      /^(hr\s*email|recruiter\s*email|contact\s*email|work\s*email)$/i,
      /^(email|email\s*address|e-mail)$/i,
      /email/i,
    ]) || "";

  const companyCol =
    findBestHeaderMatch(headers, [
      /^(company\s*name|organization\s*name|employer\s*name)$/i,
      /^(company|organization|org|employer|firm|business)$/i,
      /company/i,
    ]) || "";

  const roleCol = findBestHeaderMatch(headers, [
    /^(job\s*title|role|position|designation|job\s*role|opening)$/i,
    /title|role|position/i,
  ]);

  const jobDescCol = findBestHeaderMatch(headers, [
    /^(job\s*description|jd|description|requirements|job\s*details)$/i,
    /description|requirements/i,
  ]);

  const jobUrlCol = findBestHeaderMatch(headers, [
    /^(job\s*url|job\s*link|url|link|posting|job\s*posting)$/i,
    /url|link/i,
  ]);

  const isAmbiguous = !nameCol || !emailCol || !companyCol;

  return {
    mapping: {
      nameColumn: nameCol || (headers[0] ?? ""),
      emailColumn: emailCol || (headers[1] ?? ""),
      companyColumn: companyCol || (headers[2] ?? ""),
      roleColumn: roleCol,
      jobDescColumn: jobDescCol,
      jobUrlColumn: jobUrlCol,
    },
    isAmbiguous,
  };
}

/**
 * Parses raw buffer of an Excel or CSV file into row objects.
 */
export async function parseSpreadsheetBuffer(
  buffer: Buffer,
  fileName: string
): Promise<{ headers: string[]; rawRows: Record<string, string>[] }> {
  const ext = fileName.split(".").pop()?.toLowerCase();

  if (ext === "csv" || ext === "txt") {
    const content = buffer.toString("utf-8");
    const records: string[][] = parseCsv(content, {
      skip_empty_lines: true,
      trim: true,
      relax_column_count: true,
    });

    if (records.length === 0) {
      throw new Error("The uploaded CSV file is empty.");
    }

    const headers = records[0].map((h) => h.trim());
    const rawRows: Record<string, string>[] = [];

    for (let i = 1; i < records.length; i++) {
      const record = records[i];
      // Skip if all cells are empty
      if (record.every((cell) => !cell || !cell.trim())) continue;

      const rowObj: Record<string, string> = { _originalRowIndex: String(i + 1) };
      headers.forEach((h, colIndex) => {
        rowObj[h] = record[colIndex]?.trim() || "";
      });
      rawRows.push(rowObj);
    }

    return { headers, rawRows };
  }

  if (ext === "xlsx" || ext === "xls") {
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(buffer);

    const worksheet = workbook.worksheets[0];
    if (!worksheet) {
      throw new Error("No worksheets found in the Excel workbook.");
    }

    const headers: string[] = [];
    const rawRows: Record<string, string>[] = [];

    worksheet.eachRow((row, rowNumber) => {
      const values = Array.isArray(row.values) ? row.values.slice(1) : [];

      if (rowNumber === 1) {
        values.forEach((v) => {
          headers.push(String(v ?? "").trim());
        });
      } else {
        const isEmpty = values.every((v) => v === null || v === undefined || String(v).trim() === "");
        if (isEmpty) return;

        const rowObj: Record<string, string> = { _originalRowIndex: String(rowNumber) };
        headers.forEach((h, colIdx) => {
          const val = values[colIdx];
          rowObj[h] = val !== null && val !== undefined ? String(val).trim() : "";
        });
        rawRows.push(rowObj);
      }
    });

    if (headers.length === 0) {
      throw new Error("No header row found in the Excel sheet.");
    }

    return { headers, rawRows };
  }

  throw new Error("Unsupported spreadsheet format. Please upload .xlsx, .xls, or .csv file.");
}

/**
 * Validates and maps raw rows into verified ParsedContactRow records.
 */
export function processRawRowsWithMapping(
  rawRows: Record<string, string>[],
  mapping: ColumnMapping,
  existingEmails: Set<string> = new Set()
): {
  contacts: ParsedContactRow[];
  stats: {
    totalRows: number;
    validCount: number;
    invalidCount: number;
    duplicateCount: number;
  };
} {
  const contacts: ParsedContactRow[] = [];
  const seenInBatch = new Set<string>();

  let validCount = 0;
  let invalidCount = 0;
  let duplicateCount = 0;

  for (const raw of rawRows) {
    const rowNumber = parseInt(raw._originalRowIndex || "0", 10);
    const rawName = (raw[mapping.nameColumn] || "").trim();
    const rawEmail = (raw[mapping.emailColumn] || "").trim();
    const rawCompany = (raw[mapping.companyColumn] || "").trim();
    const rawRole = mapping.roleColumn ? (raw[mapping.roleColumn] || "").trim() : null;
    const rawDesc = mapping.jobDescColumn ? (raw[mapping.jobDescColumn] || "").trim() : null;
    const rawUrl = mapping.jobUrlColumn ? (raw[mapping.jobUrlColumn] || "").trim() : null;

    const normalizedEmail = normalizeEmail(rawEmail);
    const errors: string[] = [];

    // Zod validation
    const validationResult = ContactRowSchema.safeParse({
      name: rawName,
      email: rawEmail,
      company: rawCompany,
      role: rawRole || undefined,
      jobDescription: rawDesc || undefined,
      jobUrl: rawUrl || undefined,
    });

    if (!validationResult.success) {
      for (const err of validationResult.error.errors) {
        errors.push(err.message);
      }
    }

    // Check duplicate
    let isDuplicate = false;
    if (normalizedEmail) {
      if (seenInBatch.has(normalizedEmail) || existingEmails.has(normalizedEmail)) {
        isDuplicate = true;
        duplicateCount++;
      } else {
        seenInBatch.add(normalizedEmail);
      }
    }

    const isValid = errors.length === 0;

    if (isValid && !isDuplicate) {
      validCount++;
    } else {
      invalidCount++;
    }

    contacts.push({
      rowNumber,
      name: rawName,
      email: rawEmail,
      normalizedEmail,
      company: rawCompany,
      role: rawRole,
      jobDescription: rawDesc,
      jobUrl: rawUrl,
      isValid,
      validationErrors: errors.length > 0 ? errors.join("; ") : null,
      isDuplicate,
      isExcluded: false,
    });
  }

  return {
    contacts,
    stats: {
      totalRows: contacts.length,
      validCount,
      invalidCount,
      duplicateCount,
    },
  };
}
