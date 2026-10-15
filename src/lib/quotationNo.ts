import { PrismaClient } from "@prisma/client";

/**
 * Generate the next suggested quotation number formatted as QT-YYYY-XXXX (e.g., QT-2026-0001)
 */
export async function getNextQuotationNo(tx: any): Promise<string> {
  const currentYear = new Date().getFullYear();
  const prefix = `QT-${currentYear}-`;

  try {
    const latest = await tx.quotation.findFirst({
      where: {
        quotationNo: {
          startsWith: prefix,
        },
      },
      orderBy: { id: "desc" },
      select: { quotationNo: true },
    });

    if (!latest || !latest.quotationNo) {
      return `${prefix}0001`;
    }

    const parts = latest.quotationNo.split("-");
    const lastNum = parseInt(parts[parts.length - 1], 10);
    const nextNum = isNaN(lastNum) ? 1 : lastNum + 1;
    return `${prefix}${nextNum.toString().padStart(4, "0")}`;
  } catch (error) {
    return `${prefix}0001`;
  }
}
