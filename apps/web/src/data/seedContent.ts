import * as XLSX from "xlsx";
import type { FileItem } from "../types/file";
import { generateStorageKey, putBlob } from "../services/blobStore";

// Builds a small but structurally valid PDF (correct xref byte offsets) purely from ASCII
// text, so seeded demo PDFs have real bytes for react-pdf/pdf.js to render instead of the
// "no content" placeholder. All content here is plain ASCII, so string length === byte length.
const buildSeedPdf = (title: string, lines: string[]): Blob => {
  const escape = (s: string) => s.replace(/([()\\])/g, "\\$1");

  const contentLines = [`BT /F1 20 Tf 72 720 Td (${escape(title)}) Tj ET`];
  let y = 680;
  for (const line of lines) {
    contentLines.push(`BT /F2 11 Tf 72 ${y} Td (${escape(line)}) Tj ET`);
    y -= 20;
  }
  const stream = contentLines.join("\n");

  const objectBodies = [
    "<</Type/Catalog/Pages 2 0 R>>",
    "<</Type/Pages/Kids[3 0 R]/Count 1>>",
    "<</Type/Page/Parent 2 0 R/MediaBox[0 0 612 792]/Resources<</Font<</F1 4 0 R/F2 5 0 R>>>>/Contents 6 0 R>>",
    "<</Type/Font/Subtype/Type1/BaseFont/Helvetica-Bold>>",
    "<</Type/Font/Subtype/Type1/BaseFont/Helvetica>>",
    `<</Length ${stream.length}>>stream\n${stream}\nendstream`,
  ];

  let pdf = "%PDF-1.4\n";
  const offsets: number[] = [];
  objectBodies.forEach((body, i) => {
    offsets.push(pdf.length);
    pdf += `${i + 1} 0 obj${body}endobj\n`;
  });

  const xrefOffset = pdf.length;
  pdf += `xref\n0 ${objectBodies.length + 1}\n0000000000 65535 f \n`;
  for (const off of offsets) {
    pdf += `${String(off).padStart(10, "0")} 00000 n \n`;
  }
  pdf += `trailer<</Size ${objectBodies.length + 1}/Root 1 0 R>>\nstartxref\n${xrefOffset}\n%%EOF`;

  return new Blob([pdf], { type: "application/pdf" });
};

const buildSeedSpreadsheet = (rows: (string | number)[][]): Blob => {
  const worksheet = XLSX.utils.aoa_to_sheet(rows);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "Sheet1");
  const out = XLSX.write(workbook, { type: "array", bookType: "xlsx" });
  return new Blob([out], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
};

const SEED_BLOB_BUILDERS: Record<string, () => Blob> = {
  "file-pdf-1": () =>
    buildSeedPdf("Website Redesign Scope", [
      "Objective: Refresh the marketing site IA and visual design.",
      "Timeline: 6 weeks, starting next sprint.",
      "Deliverables: Wireframes, component library, responsive templates.",
      "Stakeholders: Design, Marketing, Frontend Engineering.",
    ]),
  "file-shared-1": () =>
    buildSeedPdf("Company Policy Handbook", [
      "Section 1: Code of Conduct",
      "Section 2: Remote Work Guidelines",
      "Section 3: Paid Time Off",
      "Section 4: Security & Data Handling",
    ]),
  "file-sheet-1": () =>
    buildSeedSpreadsheet([
      ["Category", "Q3 Budget", "Q3 Actual", "Variance"],
      ["Engineering", 120000, 118500, 1500],
      ["Marketing", 45000, 47200, -2200],
      ["Sales", 60000, 58900, 1100],
      ["Operations", 30000, 29750, 250],
    ]),
};

// Seeded demo items ship with no bytes by default (see SEED_FILES) — this writes real
// content into IndexedDB for the handful of items that have a viewer (PDF/spreadsheet) and
// attaches the resulting storageKey, so opening them on a fresh install works out of the box
// instead of showing "no content to render" placeholders.
export const attachSeedContent = async (files: FileItem[]): Promise<FileItem[]> => {
  return Promise.all(
    files.map(async (item) => {
      const buildBlob = SEED_BLOB_BUILDERS[item.id];
      if (!buildBlob) return item;

      const storageKey = generateStorageKey();
      await putBlob(storageKey, buildBlob());
      return { ...item, storageKey };
    })
  );
};
