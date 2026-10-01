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

