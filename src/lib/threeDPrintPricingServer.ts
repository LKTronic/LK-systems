import { prisma } from "@/lib/prisma";
import {
  ThreeDPrintPricingSettings,
  DEFAULT_THREE_D_PRINT_PRICING,
} from "@/lib/threeDPrintPricing";

let cachedPricing: { data: ThreeDPrintPricingSettings; timestamp: number } | null = null;
const CACHE_TTL_MS = 30 * 1000; // 30 seconds

export async function getThreeDPrintPricing(): Promise<ThreeDPrintPricingSettings> {
  const now = Date.now();
  if (cachedPricing && now - cachedPricing.timestamp < CACHE_TTL_MS) {
    return cachedPricing.data;
  }

  try {
    const setting = await prisma.systemSetting.findUnique({
      where: { key: "rd3dPrintPricing" },
    });

    if (setting && setting.value) {
      try {
        const parsed = JSON.parse(setting.value);
        if (parsed && typeof parsed === "object") {
          const price = Number(parsed.filamentPricePerKg) >= 0
            ? Number(parsed.filamentPricePerKg)
            : (Number(parsed.filamentPricePerSpool) >= 0 ? Number(parsed.filamentPricePerSpool) : 10000);
          const sanitized: ThreeDPrintPricingSettings = {
            materialType: parsed.materialType || "PLA",
            materialDensity: Number(parsed.materialDensity) > 0 ? Number(parsed.materialDensity) : 1.27,
            filamentDiameterMm: Number(parsed.filamentDiameterMm) > 0 ? Number(parsed.filamentDiameterMm) : 1.75,
            filamentPricePerKg: price,
            filamentPricePerSpool: price,
            spoolLengthMeters: Number(parsed.spoolLengthMeters) > 0 ? Number(parsed.spoolLengthMeters) : 330,
            costPerHour: Number(parsed.costPerHour) >= 0 ? Number(parsed.costPerHour) : 200,
            markupPercent: Number(parsed.markupPercent) >= 0 ? Number(parsed.markupPercent) : 35,
          };
          cachedPricing = { data: sanitized, timestamp: now };
          return sanitized;
        }
      } catch (e) {
        console.error("Failed to parse rd3dPrintPricing JSON setting:", e);
      }
    }
  } catch (error) {
    console.error("Database error while reading rd3dPrintPricing:", error);
  }

  return { ...DEFAULT_THREE_D_PRINT_PRICING };
}

export async function saveThreeDPrintPricing(
  settings: Partial<ThreeDPrintPricingSettings>
): Promise<ThreeDPrintPricingSettings> {
  const price = Number(settings.filamentPricePerKg) >= 0
    ? Number(settings.filamentPricePerKg)
    : (Number(settings.filamentPricePerSpool) >= 0 ? Number(settings.filamentPricePerSpool) : 10000);
  const sanitized: ThreeDPrintPricingSettings = {
    materialType: settings.materialType || "PLA",
    materialDensity: Number(settings.materialDensity) > 0 ? Number(settings.materialDensity) : 1.27,
    filamentDiameterMm: Number(settings.filamentDiameterMm) > 0 ? Number(settings.filamentDiameterMm) : 1.75,
    filamentPricePerKg: price,
    filamentPricePerSpool: price,
    spoolLengthMeters: Number(settings.spoolLengthMeters) > 0 ? Number(settings.spoolLengthMeters) : 330,
    costPerHour: Number(settings.costPerHour) >= 0 ? Number(settings.costPerHour) : 200,
    markupPercent: Number(settings.markupPercent) >= 0 ? Number(settings.markupPercent) : 35,
  };

  await prisma.systemSetting.upsert({
    where: { key: "rd3dPrintPricing" },
    update: { value: JSON.stringify(sanitized) },
    create: { key: "rd3dPrintPricing", value: JSON.stringify(sanitized) },
  });

  cachedPricing = { data: sanitized, timestamp: Date.now() };
  return sanitized;
}
