export type RdQuotationType = "PROJECT_PROPOSAL" | "THREE_D_PRINT" | "PCB";

export interface ThreeDPrintSpecs {
  printingTechnology: string;
  infillDensity: string;
  material: string;
  availableColors: string;
  printQuality: string;
  leadTime?: string;
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
}

export const DEFAULT_THREE_D_PRINT_SPECS: ThreeDPrintSpecs = {
  printingTechnology: "FDM (Fused Deposition Modeling)",
  infillDensity: "50%",
  material: "PLA",
  availableColors: "Black, White, Yellow",
  printQuality: "Standard – 0.2 mm layer height",
  leadTime: "2 - 4 Working Days",
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
  "Validity of Quotation: This quotation is valid for a period of fourteen (14) days from the date of issue. Upon expiry of this period, the prices, availability, and terms specified herein shall be subject to change.",
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

export function formatValidityDaysText(days: number | string): string {
  const num = Number(days) || 4;
  const wordMap: Record<number, string> = {
    1: "one (01) day",
    2: "two (02) days",
    3: "three (03) days",
    4: "four (04) days",
    5: "five (05) days",
    6: "six (06) days",
    7: "seven (07) days",
    10: "ten (10) days",
    14: "fourteen (14) days",
    21: "twenty-one (21) days",
    30: "thirty (30) days",
  };
  return wordMap[num] || `${num} days`;
}

export function getProjectProposalTerms(validityDays: number | string = 4): string[] {
  const formattedDays = formatValidityDaysText(validityDays);
  return [
    `Quotation Validity: The prices and other service charges associated with the project are valid for ${formattedDays} from the date of issue.`,
    "Engineering Supervision: For your convenience, the project will be directed by an R&D engineer from start to finish, and all project milestones will be communicated directly via email.",
    "Hardware Warranty: If a warranty (for manufacturing faults) is provided for any hardware component used in the project, it is clearly stated in the quotation.",
    "Source Code & Design Documents: Please note that programming files, source codes, and system design documents are not included or provided as part of this project unless explicitly negotiated.",
    "Delivery & Transportation: Transportation, delivery, and freight charges are not included in this quotation and will be charged separately, if applicable.",
    "Scope of Work: This quotation covers only the products and scope specified in this proposal. Any additional components or materials required beyond the quoted scope shall be supplied and charged separately upon customer approval.",
    "Environmental Operating Conditions: The warranty shall be considered void if the electronic devices or equipment are operated, installed, or stored under environmental conditions that do not comply with the manufacturer’s specified operating requirements (excessive temperature, humidity, dust, moisture, corrosive substances, vibration).",
  ];
}

export function isDefaultProjectProposalTerm(term: string): boolean {
  const t = term.toLowerCase().trim();
  const prefixes = [
    "quotation validity",
    "the prices and other service charges",
    "engineering supervision",
    "for your convenience, the project will be directed",
    "hardware warranty",
    "if a warranty (for manufacturing faults)",
    "if a warranty for manufacturing faults",
    "source code & design documents",
    "source code and design documents",
    "please note that programming files",
    "delivery & transportation",
    "delivery and transportation",
    "transportation, delivery, and freight charges",
    "transportation, delivery and freight charges",
    "scope of work",
    "this quotation covers only the products and scope",
    "environmental operating conditions",
    "environmental conditions",
    "the warranty shall be considered void if the electronic devices",
  ];
  return prefixes.some((prefix) => t.includes(prefix));
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
  { productOrService: "ASUS RT-N12+ B1 3 IN 1 ROUTER/AP/RANGE EXTENDER 90IG01N0-BG310", quantity: 1 },
  { productOrService: "Industrial Modbus Serial RS232 RS485 RS422 to WiFi Ethernet Converter Device TC-P IP Telnet 4M Flash D-TU Connector HF2211", quantity: 6 },
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

