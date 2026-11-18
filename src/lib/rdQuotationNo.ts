import { PrismaClient } from "@prisma/client";

/**
 * Generate sequential R&D quotation numbers based on type:
 * - PROJECT_PROPOSAL: YYYYMMDDPQV1, YYYYMMDDPQV2, ...
 * - THREE_D_PRINT & PCB: YYYYMMDDQV1, YYYYMMDDQV2, ... (shared sequence for both 3D & PCB)
 */
export async function getNextRdQuotationNo(
  tx: any,
  type: "PROJECT_PROPOSAL" | "THREE_D_PRINT" | "PCB" = "THREE_D_PRINT",
  dateOverride?: Date
): Promise<string> {
  const now = dateOverride || new Date();
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const dd = String(now.getDate()).padStart(2, "0");
  const datePrefix = `${yyyy}${mm}${dd}`;

  // Both THREE_D_PRINT and PCB share the "QV" prefix and sequential counter
  let codePrefix = "QV";
  if (type === "PROJECT_PROPOSAL") codePrefix = "PQV";
  else codePrefix = "QV";

  const basePattern = `${datePrefix}${codePrefix}`;

  try {
    let existingList: { quotationNo: string }[] = [];
    if (Array.isArray(tx)) {
      existingList = tx.map((q: any) =>
        typeof q === "string" ? { quotationNo: q } : q
      );
    } else if (tx?.rdQuotation?.findMany) {
      existingList = await tx.rdQuotation.findMany({
        where: {
          quotationNo: {
            startsWith: basePattern,
          },
        },
        select: { quotationNo: true },
      });
    } else if (tx?.$queryRawUnsafe) {
      try {
        const rows: any = await tx.$queryRawUnsafe(
          "SELECT quotationNo FROM `RdQuotation` WHERE quotationNo LIKE ?",
          `${basePattern}%`
        );
        existingList = Array.isArray(rows) ? rows : [];
      } catch {
        existingList = [];
      }
    }

    if (!existingList || existingList.length === 0) {
      return `${basePattern}1`;
    }

    let highestNum = 0;
    for (const item of existingList) {
      const match = item.quotationNo.match(new RegExp(`^${basePattern}(\\d+)$`));
      if (match) {
        const val = parseInt(match[1], 10);
        if (!isNaN(val) && val > highestNum) {
          highestNum = val;
        }
      }
    }

    return `${basePattern}${highestNum + 1}`;
  } catch (error) {
    return `${basePattern}1`;
  }
}
