export type ProductChecklistType = "BATTERY" | "INVERTER";

export interface BatteryInfo {
  arrivedDate: string;
  modelNumber: string;
  macAddress: string;
  serialNumberBattery: string;
  serialNumberBox: string;
  batteryInput: string;
  physicalDamage: string;
}

export interface InverterInfo {
  arrivedDate: string;
  modelNumber: string;
  macAddress?: string;
  serialNumber?: string;
  serialNumberBox: string;
  serialNumberInverter: string;
  batterySystem: string;
  physicalDamage: string;
}

export interface ChecklistTestItem {
  id: string;
  key: string;
  label: string;
  passed: boolean;
  comment: string;
}

export type NoteColor = "default" | "teal" | "blue" | "green" | "amber" | "red";

export interface ChecklistNoteItem {
  id: string;
  text: string;
  bold?: boolean;
  highlight?: boolean;
  color?: NoteColor;
}

export interface ProductChecklist {
  id: string;
  checklistNo: string;
  type: ProductChecklistType;
  batteryInfo?: BatteryInfo;
  inverterInfo?: InverterInfo;
  checkedDate: string;
  tests: ChecklistTestItem[];
  checkedByName: string;
  checkedByDesignation?: string;
  additionalNotes: ChecklistNoteItem[];
  overallQcPassed: boolean;
  createdAt: string;
  updatedAt: string;
}

/**
 * Returns default test items based on product type
 */
export function getDefaultTestItems(type: ProductChecklistType): ChecklistTestItem[] {
  if (type === "INVERTER") {
    return [
      { id: "test-pv", key: "pvStatus", label: "PV Status", passed: true, comment: "" },
      { id: "test-ac", key: "acStatus", label: "AC Status", passed: true, comment: "" },
      { id: "test-disp", key: "displayStatus", label: "Display Status", passed: true, comment: "" },
      { id: "test-out", key: "outputStatus", label: "Output Status", passed: true, comment: "" },
      { id: "test-chg", key: "batteryChargingStatus", label: "Battery Charging Status", passed: true, comment: "" },
      { id: "test-ptb", key: "batteryPointBackStatus", label: "Battery Point Back Status", passed: true, comment: "" },
      { id: "test-load", key: "loadTestStatus", label: "Load Test Status", passed: true, comment: "" },
      { id: "test-qc", key: "qcPassedStatus", label: "QC Passed Status", passed: true, comment: "" },
    ];
  } else {
    return [
      { id: "test-disp", key: "displayStatus", label: "Display Status", passed: true, comment: "" },
      { id: "test-out", key: "outputStatus", label: "Output Status", passed: true, comment: "" },
      { id: "test-chg", key: "batteryChargingStatus", label: "Battery Charging Status", passed: true, comment: "" },
      { id: "test-ptb", key: "batteryPointBackStatus", label: "Battery Point Back Status", passed: true, comment: "" },
      { id: "test-load", key: "loadTestStatus", label: "Load Test Status", passed: true, comment: "" },
      { id: "test-qc", key: "qcPassedStatus", label: "QC Passed Status", passed: true, comment: "" },
    ];
  }
}

export function getDefaultBatteryInfo(): BatteryInfo {
  const today = new Date().toISOString().split("T")[0];
  return {
    arrivedDate: today,
    modelNumber: "",
    macAddress: "",
    serialNumberBattery: "",
    serialNumberBox: "",
    batteryInput: "",
    physicalDamage: "None / No physical damage observed",
  };
}

export function getDefaultInverterInfo(): InverterInfo {
  const today = new Date().toISOString().split("T")[0];
  return {
    arrivedDate: today,
    modelNumber: "",
    macAddress: "",
    serialNumber: "",
    serialNumberBox: "",
    serialNumberInverter: "",
    batterySystem: "48V DC",
    physicalDamage: "None / No physical damage observed",
  };
}

/**
 * Returns an instant auto-generated checklist reference number for the given product type
 */
export function formatAutoChecklistNo(type: ProductChecklistType, date: Date = new Date(), seq: number = 1): string {
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");
  const prefix = type === "BATTERY" ? "QC-BAT" : "QC-INV";
  const seqStr = String(seq).padStart(2, "0");
  return `${prefix}-${yyyy}${mm}${dd}-${seqStr}`;
}
