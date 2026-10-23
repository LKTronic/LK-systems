import { PrismaClient } from "@prisma/client";

/**
 * Generate the next suggested quotation number formatted as YYYYMMDD (yearmonthdate, e.g., 20261023).
 * If the exact YYYYMMDD is already in use, suggests a sequential suffix (e.g. 20261023-01).
 * The field remains fully editable by the user to add custom suffixes (e.g. 20261023-23v).
 */
export async function getNextQuotationNo(tx: any): Promise<string> {
  const now = new Date();
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const dd = String(now.getDate()).padStart(2, "0");
  const datePrefix = `${yyyy}${mm}${dd}`;

  try {
    const existing = await tx.quotation.findUnique({
      where: { quotationNo: datePrefix },
      select: { quotationNo: true },
    });

    if (!existing) {
      return datePrefix;
    }

    const latest = await tx.quotation.findFirst({
      where: {
        quotationNo: {
          startsWith: `${datePrefix}-`,
        },
      },
      orderBy: { id: "desc" },
      select: { quotationNo: true },
    });

    if (!latest || !latest.quotationNo) {
      return `${datePrefix}-01`;
    }

    const parts = latest.quotationNo.split("-");
    const lastNum = parseInt(parts[parts.length - 1], 10);
    const nextNum = isNaN(lastNum) ? 1 : lastNum + 1;
    return `${datePrefix}-${nextNum.toString().padStart(2, "0")}`;
  } catch (error) {
    return datePrefix;
  }
}

