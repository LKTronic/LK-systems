export interface ThreeDPrintPricingSettings {
  materialType?: string;
  materialDensity: number;
  filamentDiameterMm: number;
  filamentPricePerKg: number;
  costPerHour: number;
  markupPercent: number;
  // Aliases for compatibility
  spoolLengthMeters?: number;
  filamentPricePerSpool?: number;
}

export const MATERIAL_DENSITIES: Record<string, number> = {
  ABS: 1.05,
  PLA: 1.27,
  TPU: 1.30,
  PETG: 1.25,
  PETT: 1.45,
  HIPS: 1.04,
};

export const DEFAULT_THREE_D_PRINT_PRICING: ThreeDPrintPricingSettings = {
  materialType: "ABS",
  materialDensity: 1.05,
  filamentDiameterMm: 1.75,
  filamentPricePerKg: 10000,
  filamentPricePerSpool: 10000,
  spoolLengthMeters: 330,
  costPerHour: 200,
  markupPercent: 35,
};
