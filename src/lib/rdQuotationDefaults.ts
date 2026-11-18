export type RdQuotationType = "PROJECT_PROPOSAL" | "THREE_D_PRINT" | "PCB";

export const MATERIAL_DENSITIES: Record<string, number> = {
  ABS: 1.05,
  PLA: 1.27,
  TPU: 1.30,
  "TPU (Flexible)": 1.30,
  PETG: 1.25,
  PETT: 1.45,
  HIPS: 1.04,
  Nylon: 1.14,
  Resin: 1.15,
  "Standard Resin": 1.15,
  "Tough Resin": 1.15,
};

export function getMaterialDensity(materialName?: string | null, fallback: number = 1.05): number {
  if (!materialName) return fallback;
  const upper = materialName.toUpperCase().trim();
  if (upper.includes("PLA")) return 1.27;
  if (upper.includes("TPU") || upper.includes("FLEX")) return 1.30;
  if (upper.includes("PETT")) return 1.45;
  if (upper.includes("PETG") || upper.includes("PET")) return 1.25;
  if (upper.includes("HIPS")) return 1.04;
  if (upper.includes("ABS")) return 1.05;
  if (upper.includes("NYLON")) return 1.14;
  if (upper.includes("RESIN")) return 1.15;
  return MATERIAL_DENSITIES[materialName] || fallback;
}

export interface ThreeDPrintSpecs {
  printingTechnology: string;
  infillDensity: string;
  material: string;
  availableColors: string;
  printQuality: string;
  leadTime?: string;
  // 3D Printing Cost Calculator Parameters
  filamentPricePerKg?: number;
  costPerHour?: number;
  markupPercent?: number;
  materialDensity?: number;
  filamentDiameterMm?: number;
  pricingMode?: "MANUAL" | "AUTO";
  spoolLengthMeters?: number;
  filamentPricePerSpool?: number;
  itemCalcDetails?: Array<{
    calcMode?: "MANUAL" | "AUTO";
    filamentLengthM?: number | string;
    printTimeMinutes?: number | string;
    printTimeHours?: number | string;
  }>;
}

export interface PcbSpecs {
  layers: string;
  dimensions: string;
  material: string;
  thickness: string;
  copperWeight: string;
  solderMaskColor: string;
  silkscreenColor: string;
  surfaceFinish: string;
  leadTime?: string;
}

export interface RdQuotationItemInput {
  id?: string | number;
  itemIndex: number;
  itemType?: "HARDWARE" | "SERVICE";
  productOrService: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  notes?: string;
  calcMode?: "MANUAL" | "AUTO";
  filamentLengthM?: number | string;
  printTimeMinutes?: number | string;
  printTimeHours?: number | string;
}

export const DEFAULT_THREE_D_PRINT_SPECS: ThreeDPrintSpecs = {
  printingTechnology: "FDM (Fused Deposition Modeling)",
  infillDensity: "50%",
  material: "ABS",
  availableColors: "Black, White, Yellow",
  printQuality: "Standard – 0.2 mm layer height",
  leadTime: "2 - 4 Working Days",
  filamentPricePerKg: 10000,
  filamentPricePerSpool: 10000,
  costPerHour: 200,
  markupPercent: 35,
  materialDensity: 1.05,
  filamentDiameterMm: 1.75,
  spoolLengthMeters: 330,
  pricingMode: "AUTO",
};

export const DEFAULT_PCB_SPECS: PcbSpecs = {
  layers: "2 Layers",
  dimensions: "100 x 100 mm",
  material: "FR-4",
  thickness: "1.6 mm",
  copperWeight: "1 oz",
  solderMaskColor: "Green",
  silkscreenColor: "White",
  surfaceFinish: "HASL with lead",
  leadTime: "12 - 21 Working Days",
};

export const DEFAULT_THREE_D_PRINT_TERMS = [
  "Validity of Quotation: This quotation is valid for a period of fourteen (14) days from the date of issue. Upon expiry of this period, the prices, availability, and terms specified herein shall be subject to change and may be adjusted based on market conditions, supplier revisions, or other applicable factors.",
  "Printing Job Scheduling & Availability: All 3D printing jobs are scheduled subject to the availability of printers at the LK TRONICS R&D facility. Customers are requested to confirm machine availability with the relevant officer in the LK TRONICS R&D Department prior to order placement.",
  "Design Responsibility & Warranty: Printing will be performed strictly according to the STL file provided by the customer. LK TRONICS shall not be liable for any design inaccuracies or dimensional errors arising from customer-supplied files. No warranty is applicable to 3D-printed parts, as they are custom-produced based on client specifications.",
  "Delivery Terms: If delivery charges are not specified in the quotation table, the client shall be responsible for either collecting the goods from our store or bearing the applicable delivery cost if delivery is required. LK TRONICS will not be held liable for any damages that may occur during transportation or delivery.",
  "Payment Terms: To commence the printing job, a full payment or an 80% advance payment is required. Cancellations are non-refundable once payment has been made. Completed 3D-printed parts will be released to the client only upon receipt of full payment.",
];

export const DEFAULT_PCB_TERMS = [
  "Validity of Quotation: This quotation is valid for a period of five (05) days from the date of issue. Upon expiry of this period, the prices, availability, and terms specified herein shall be subject to change and may be adjusted based on market conditions, supplier revisions, or other applicable factors.",
  "PCB Printing Job Scheduling & Availability: All PCB printing and fabrication jobs are scheduled subject to the availability of PCB production equipment at the LK TRONICS R&D facility. Customers are requested to confirm machine availability and estimated production lead time with the relevant officer in the LK TRONICS R&D Department prior to order placement.",
  "PCB Design Responsibility & Warranty: PCB printing and fabrication will be carried out strictly according to the design files provided by the customer, including Gerber files, drill files, PCB layouts, dimensions, and other relevant specifications. LK TRONICS shall not be responsible for any design errors, incorrect footprints, track-routing issues, component placement errors, dimensional inaccuracies, or other defects arising from customer-supplied files.\n\nCustomers are therefore advised to verify and approve all design files before production. As PCBs are custom-manufactured according to individual customer specifications, no warranty is applicable for design-related issues; however, any confirmed manufacturing defect attributable to the PCB production process will be reviewed separately.\n\nAll PCB fabrication is carried out based on the final customer-approved design. Even if PCB design assistance is provided by LK TRONICS, the customer is responsible for verifying the design before production, and LK TRONICS shall not be liable for design, compatibility, or functional issues after approval.",
  "Delivery Terms: If delivery charges are not specified in the quotation table, the client shall be responsible for either collecting the goods from our store or bearing the applicable delivery cost if delivery is required. LK TRONICS will not be held liable for any damages that may occur during transportation or delivery.",
  "Payment Terms: To commence the printing job, a full payment is required. Cancellations are non-refundable once payment has been made. Completed 3D-printed parts will be released to the client only upon receipt of full payment.",
];

export const DEFAULT_PROJECT_PROPOSAL_INTRO =
  "Develop an IoT-based system to collect operational data from petrol pumps and transmit it securely to a cloud platform for real-time monitoring, data logging, and analysis. The system will enable remote access to pump operating parameters, fuel dispensing data, and equipment status, subject to the availability of compatible communication interfaces. This solution will improve operational visibility, support performance monitoring, and facilitate efficient data management.";

const VALIDITY_ONES = [
  "zero", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine",
  "ten", "eleven", "twelve", "thirteen", "fourteen", "fifteen", "sixteen",
  "seventeen", "eighteen", "nineteen",
];
const VALIDITY_TENS = [
  "", "", "twenty", "thirty", "forty", "fifty", "sixty", "seventy", "eighty", "ninety",
];

export function numberToWordsValidity(num: number): string {
  const n = Math.abs(Math.round(num));
  if (n < 20) return VALIDITY_ONES[n] || String(n);
  if (n < 100) {
    const tens = VALIDITY_TENS[Math.floor(n / 10)];
    const remainder = n % 10;
    return remainder > 0 ? `${tens}-${VALIDITY_ONES[remainder]}` : tens;
  }
  if (n < 1000) {
    const hundreds = VALIDITY_ONES[Math.floor(n / 100)] + " hundred";
    const remainder = n % 100;
    return remainder > 0 ? `${hundreds} ${numberToWordsValidity(remainder)}` : hundreds;
  }
  return String(n);
}

export function formatValidityDaysText(days: number | string): string {
  const num = Math.max(1, Math.round(Number(days) || 14));
  const word = numberToWordsValidity(num);
  const padded = num < 10 ? `0${num}` : String(num);
  const unit = num === 1 ? "day" : "days";
  return `${word} (${padded}) ${unit}`;
}

export function getThreeDPrintTerms(validityDays: number | string = 14): string[] {
  const daysText = formatValidityDaysText(validityDays);
  return [
    `Validity of Quotation: This quotation is valid for a period of ${daysText} from the date of issue. Upon expiry of this period, the prices, availability, and terms specified herein shall be subject to change and may be adjusted based on market conditions, supplier revisions, or other applicable factors.`,
    ...DEFAULT_THREE_D_PRINT_TERMS.slice(1),
  ];
}

export function getPcbTerms(validityDays: number | string = 5): string[] {
  const daysText = formatValidityDaysText(validityDays);
  return [
    `Validity of Quotation: This quotation is valid for a period of ${daysText} from the date of issue. Upon expiry of this period, the prices, availability, and terms specified herein shall be subject to change and may be adjusted based on market conditions, supplier revisions, or other applicable factors.`,
    ...DEFAULT_PCB_TERMS.slice(1),
  ];
}

export function getProjectProposalTerms(validityDays: number | string = 4): string[] {
  return [
    "Engineering Supervision: For your convenience, the project will be directed by an R&D engineer from start to finish, and all project milestones will be communicated directly via email.",
    "Warranty: If a warranty (for manufacturing faults) is provided for any component used in the project, it is clearly stated in the quotation.",
    "Source Code & Design Documents: Please note that programming files, source codes, and system design documents are not included or provided as part of this project unless explicitly negotiated.",
    "Delivery & Transportation: Transportation, delivery, and freight charges are not included in this quotation and will be charged separately, if applicable.",
    "Scope of Work: This quotation covers only the products and scope specified in this proposal. Any additional components or materials required beyond the quoted scope shall be supplied and charged separately upon customer approval.",
    "Environmental Operating Conditions: The warranty shall be considered void if the electronic devices or equipment are operated, installed, or stored under environmental conditions that do not comply with the manufacturer’s specified operating requirements (excessive temperature, humidity, dust, moisture, corrosive substances, vibration).",
  ];
}

function normalizeTermForMatch(term: string): string {
  return term
    .toLowerCase()
    .replace(/^(\d+[\.\)]|[•\-\*])\s*/, "") // remove leading bullet or number
    .replace(/’/g, "'") // normalize curly apostrophe
    .replace(/&/g, "and") // normalize & to and
    .replace(/\s+/g, " ") // collapse multiple spaces
    .trim();
}

const DEFAULT_TERMS_NORMALIZED: string[] = [
  normalizeTermForMatch("Engineering Supervision: For your convenience, the project will be directed by an R&D engineer from start to finish, and all project milestones will be communicated directly via email."),
  normalizeTermForMatch("Warranty: If a warranty (for manufacturing faults) is provided for any component used in the project, it is clearly stated in the quotation."),
  normalizeTermForMatch("Hardware Warranty: If a warranty (for manufacturing faults) is provided for any component used in the project, it is clearly stated in the quotation."),
  normalizeTermForMatch("Hardware Warranty: If a warranty (for manufacturing faults) is provided for any hardware component used in the project, it is clearly stated in the quotation."),
  normalizeTermForMatch("Source Code & Design Documents: Please note that programming files, source codes, and system design documents are not included or provided as part of this project unless explicitly negotiated."),
  normalizeTermForMatch("Delivery & Transportation: Transportation, delivery, and freight charges are not included in this quotation and will be charged separately, if applicable."),
  normalizeTermForMatch("Scope of Work: This quotation covers only the products and scope specified in this proposal. Any additional components or materials required beyond the quoted scope shall be supplied and charged separately upon customer approval."),
  normalizeTermForMatch("Environmental Operating Conditions: The warranty shall be considered void if the electronic devices or equipment are operated, installed, or stored under environmental conditions that do not comply with the manufacturer's specified operating requirements (excessive temperature, humidity, dust, moisture, corrosive substances, vibration)."),
];

export function isDefaultProjectProposalTerm(term: string): boolean {
  const norm = normalizeTermForMatch(term);
  if (!norm) return false;
  if (
    norm.startsWith(
      "quotation validity: the prices and other service charges associated with the project are valid for"
    )
  ) {
    return true;
  }
  return DEFAULT_TERMS_NORMALIZED.includes(norm);
}

export function extractAdditionalTerms(rawTerms: string | null | undefined): string[] {
  if (!rawTerms) return [];
  return rawTerms
    .split(/\n+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0 && !isDefaultProjectProposalTerm(s));
}

export function getProjectProposalCombinedTerms(
  additionalTermsText: string | null | undefined,
  validityDays: number | string = 4
): string[] {
  const defaultTerms = getProjectProposalTerms(validityDays);
  const additional = extractAdditionalTerms(additionalTermsText);
  return [...additional, ...defaultTerms];
}

export const DEFAULT_PROJECT_PROPOSAL_TERMS = getProjectProposalTerms(4);

export const DEFAULT_PROJECT_PROPOSAL_HARDWARE = [
  { productOrService: "Arduino Nano", quantity: 12 },
  { productOrService: "LM2696 Buck converter", quantity: 12 },
  { productOrService: "8pin serial connector", quantity: 12 },
  { productOrService: "HLK-20M05 AC-DC 220V to 5V Power Supply", quantity: 12 },
];

export const DEFAULT_PROJECT_PROPOSAL_SERVICES = [
  { productOrService: "Testing / Engineering Charges", quantity: 1 },
  { productOrService: "IOT Installation and Programing", quantity: 1 },
];

export const DEFAULT_PROJECT_PROPOSAL_MILESTONES = [
  { phase: "Phase 1: Architecture & Circuit Design", duration: "3-5 Days", status: "Design Sign-off" },
  { phase: "Phase 2: Hardware Sourcing & Assembly", duration: "5-7 Days", status: "Component Integration" },
  { phase: "Phase 3: Firmware Implementation & Calibration", duration: "4-6 Days", status: "Stress Testing" },
  { phase: "Phase 4: Final QA, Documentation & Handover", duration: "2-3 Days", status: "Ready for Delivery" },
];

export const LK_TRONICS_BANK_DETAILS = {
  accountName: "LK TRONICS TRADING PVT LTD",
  accountNumber: "047010021564",
  bankName: "Hatton National Bank (HNB)",
  branch: "Biyagama",
};

export interface ThreeDPrintCostBreakdown {
  costPerMeter: number;
  materialCost: number;
  laborCost: number;
  baseCost: number;
  markupAmount: number;
  rawUnitPrice: number;
  unitPrice: number;
  weightKg?: number;
}

/**
 * Omni Calculator 3D Printing Cost Formula:
 * material cost = ρ * π * (d/2)² * L * price
 * where:
 *   ρ = Density of material in g/cm³ (ABS: 1.05, PLA: 1.27, TPU: 1.30, PETG: 1.25)
 *   d = Filament diameter in mm (default 1.75 mm)
 *   L = Length of filament used in meters
 *   price = Cost of material per kg (LKR)
 *
 * labor cost = (time_minutes / 60) * hourlyRate
 * final price = (material cost + labor cost) * (1 + markup / 100)
 */
export function calculate3DPrintPrice(
  filamentLengthM: number | string,
  printTimeMinutes: number | string,
  pricePerKgOrSpoolLength: number | string = 10000,
  filamentPricePerSpoolOrCostPerHour: number | string = 10000,
  costPerHourOrMarkup: number | string = 200,
  markupPercentOrDensity: number | string = 35,
  densityGPerCm3: number | string = 1.05,
  diameterMm: number | string = 1.75
): ThreeDPrintCostBreakdown {
  const len = Number(filamentLengthM) >= 0 ? Number(filamentLengthM) : 0;
  const mins = Number(printTimeMinutes) >= 0 ? Number(printTimeMinutes) : 0;

  let priceKg = 10000;
  let hourlyRate = 200;
  let markup = 35;
  let rho = 1.05;
  let d = 1.75;

  const arg3 = Number(pricePerKgOrSpoolLength);
  const arg4 = Number(filamentPricePerSpoolOrCostPerHour);
  const arg5 = Number(costPerHourOrMarkup);
  const arg6 = Number(markupPercentOrDensity);

  if (arg3 > 0 && arg3 <= 1000 && arg4 > 1000) {
    // Legacy positional arguments: (len, mins, spoolLen, priceSpool, costPerHour, markupPercent)
    priceKg = arg4;
    hourlyRate = arg5 >= 0 ? arg5 : 200;
    markup = arg6 >= 0 ? arg6 : 35;
    rho = Number(densityGPerCm3) > 0 ? Number(densityGPerCm3) : 1.05;
  } else {
    // Standard Omni Calculator parameters: (len, mins, pricePerKg, costPerHour, markupPercent, density, diameter)
    priceKg = arg3 >= 0 ? arg3 : 10000;
    hourlyRate = arg4 >= 0 ? arg4 : 200;
    markup = arg5 >= 0 ? arg5 : 35;
    rho = arg6 > 0 ? arg6 : (Number(densityGPerCm3) > 0 ? Number(densityGPerCm3) : 1.05);
  }

  if (Number(diameterMm) > 0) {
    d = Number(diameterMm);
  }

  // Volume in cm³ = π * (d / 2)² * L (when d is in mm and L is in meters)
  const volumeCm3 = Math.PI * Math.pow(d / 2, 2) * len;

  // Weight in kg = (Volume in cm³ * Density in g/cm³) / 1000
  const weightKg = (volumeCm3 * rho) / 1000;

  // Material cost = Weight in kg * Price per kg
  const materialCost = weightKg * priceKg;

  // Labor cost = (minutes / 60) * hourlyRate
  const laborCost = (mins / 60) * hourlyRate;

  // Base cost = Material cost + Labor cost
  const baseCost = materialCost + laborCost;

  // Markup amount = Base cost * (markup / 100)
  const markupAmount = baseCost * (markup / 100);

  // Raw calculated price
  const rawPrice = baseCost + markupAmount;
  const rawUnitPrice = Math.round(rawPrice * 100) / 100;

  // Final Unit Price rounded UP to the nearest multiple of 10 (e.g. 741.19 -> 750, 435 -> 440)
  const unitPrice = rawPrice > 0 ? Math.ceil(rawPrice / 10) * 10 : 0;

  // Effective cost per meter for reporting
  const costPerMeter = len > 0 ? materialCost / len : 0;

  return {
    costPerMeter: Math.round(costPerMeter * 100) / 100,
    materialCost: Math.round(materialCost * 100) / 100,
    laborCost: Math.round(laborCost * 100) / 100,
    baseCost: Math.round(baseCost * 100) / 100,
    markupAmount: Math.round(markupAmount * 100) / 100,
    rawUnitPrice,
    unitPrice,
    weightKg: Math.round(weightKg * 10000) / 10000,
  };
}


