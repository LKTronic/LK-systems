/**
 * Formats a date string or Date object into DD/MM/YYYY format safely without timezone shift.
 * Example: "2026-09-08" -> "08/09/2026"
 */
export function formatDateDMY(dateInput: string | Date | null | undefined): string {
  if (!dateInput) return "";

  if (typeof dateInput === "string") {
    const datePart = dateInput.includes("T") ? dateInput.split("T")[0] : dateInput;
    const parts = datePart.split("-");
    if (parts.length === 3) {
      const [y, m, d] = parts;
      return `${d.padStart(2, "0")}/${m.padStart(2, "0")}/${y}`;
    }
  }

  const d = new Date(dateInput);
  if (isNaN(d.getTime())) return "";
  const day = d.getUTCDate().toString().padStart(2, "0");
  const month = (d.getUTCMonth() + 1).toString().padStart(2, "0");
  const year = d.getUTCFullYear();
  return `${day}/${month}/${year}`;
}

/**
 * Formats numeric or string amount as LKR currency.
 * Example: 1500 -> "1,500.00 LKR"
 */
export function formatLKR(amount: number | string | null | undefined): string {
  if (amount === null || amount === undefined || isNaN(Number(amount))) return "0.00 LKR";
  const num = Number(amount);
  return `${num.toLocaleString("en-LK", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} LKR`;
}

export interface StorageLocationInfo {
  section?: string;
  rack?: string;
  shelf?: string;
  raw: string;
}

/**
 * Extracts storage warehouse location (Section, Rack, Shelf) from additional notes or description.
 * Example: "SECTION: 3   RACK: E" -> { section: "3", rack: "E", raw: "SECTION: 3   RACK: E" }
 */
export function extractStorageLocation(
  additionalNote?: string | null,
  description?: string | null
): StorageLocationInfo | null {
  const text = `${additionalNote || ""}\n${description || ""}`;
  if (!text.trim()) return null;

  // 1. Look for explicit SECTION and/or RACK patterns
  const sectionMatch = text.match(/SECTION\s*:\s*([A-Za-z0-9\-\/]+)/i);
  const rackMatch = text.match(/RACK\s*:\s*([A-Za-z0-9\-\/]+)/i);
  const shelfMatch = text.match(/SHELF\s*:\s*([A-Za-z0-9\-\/]+)/i);

  if (sectionMatch || rackMatch || shelfMatch) {
    const section = sectionMatch ? sectionMatch[1].trim() : undefined;
    const rack = rackMatch ? rackMatch[1].trim() : undefined;
    const shelf = shelfMatch ? shelfMatch[1].trim() : undefined;

    const parts: string[] = [];
    if (section) parts.push(`SECTION: ${section}`);
    if (rack) parts.push(`RACK: ${rack}`);
    if (shelf) parts.push(`SHELF: ${shelf}`);

    return {
      section,
      rack,
      shelf,
      raw: parts.join("   "),
    };
  }

  // 2. Fallback check for location keywords in short note
  if (additionalNote && additionalNote.length < 60 && !additionalNote.includes("http")) {
    const lower = additionalNote.toLowerCase();
    if (
      lower.includes("section") ||
      lower.includes("rack") ||
      lower.includes("shelf") ||
      lower.includes("drawer")
    ) {
      return {
        raw: additionalNote.replace(/^[A-Z0-9_-]+\s*\n*/, "").trim(),
      };
    }
  }

  return null;
}

