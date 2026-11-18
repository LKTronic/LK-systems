import { prisma } from "@/lib/prisma";

export interface BankAccount {
  id: string;
  accountName: string;
  accountNumber: string;
  bankName: string;
  branch: string;
  isDefault?: boolean;
  notes?: string;
}

export const DEFAULT_BANK_ACCOUNTS: BankAccount[] = [
  {
    id: "hnb-biyagama",
    accountName: "LK TRONICS TRADING PVT LTD",
    accountNumber: "047010021564",
    bankName: "Hatton National Bank (HNB)",
    branch: "Biyagama Branch",
    isDefault: true,
  },
  {
    id: "comm-homagama",
    accountName: "LK TRONICS",
    accountNumber: "1000525586",
    bankName: "Commercial Bank",
    branch: "Homagama Branch",
    isDefault: false,
  },
];

let cachedBankAccounts: { data: BankAccount[]; timestamp: number } | null = null;
const CACHE_TTL_MS = 30 * 1000; // 30 seconds

export async function getBankAccounts(): Promise<BankAccount[]> {
  const now = Date.now();
  if (cachedBankAccounts && now - cachedBankAccounts.timestamp < CACHE_TTL_MS) {
    return cachedBankAccounts.data;
  }

  try {
    const setting = await prisma.systemSetting.findUnique({
      where: { key: "rdBankAccounts" },
    });

    if (setting && setting.value) {
      try {
        const parsed = JSON.parse(setting.value);
        if (Array.isArray(parsed) && parsed.length > 0) {
          cachedBankAccounts = { data: parsed, timestamp: now };
          return parsed;
        }
      } catch (e) {
        console.error("Failed to parse rdBankAccounts JSON setting:", e);
      }
    }
  } catch (error) {
    console.error("Database error while reading rdBankAccounts:", error);
  }

  // Fallback to defaults
  cachedBankAccounts = { data: DEFAULT_BANK_ACCOUNTS, timestamp: now };
  return DEFAULT_BANK_ACCOUNTS;
}

export async function saveBankAccounts(accounts: BankAccount[]): Promise<BankAccount[]> {
  if (!Array.isArray(accounts) || accounts.length === 0) {
    throw new Error("At least one bank account must be configured.");
  }

  // Ensure unique IDs and valid fields
  const cleaned: BankAccount[] = accounts.map((acc, index) => ({
    id: acc.id?.trim() || `bank-${Date.now()}-${index}`,
    accountName: acc.accountName?.trim() || "LK TRONICS TRADING PVT LTD",
    accountNumber: acc.accountNumber?.trim() || "",
    bankName: acc.bankName?.trim() || "Hatton National Bank (HNB)",
    branch: acc.branch?.trim() || "Biyagama Branch",
    isDefault: Boolean(acc.isDefault),
    notes: acc.notes?.trim() || undefined,
  }));

  // Ensure exactly one account is marked as default
  const defaultIdx = cleaned.findIndex((acc) => acc.isDefault);
  if (defaultIdx === -1) {
    cleaned[0].isDefault = true;
  } else {
    cleaned.forEach((acc, i) => {
      acc.isDefault = i === defaultIdx;
    });
  }

  const jsonValue = JSON.stringify(cleaned);

  await prisma.systemSetting.upsert({
    where: { key: "rdBankAccounts" },
    update: { value: jsonValue },
    create: { key: "rdBankAccounts", value: jsonValue },
  });

  cachedBankAccounts = { data: cleaned, timestamp: Date.now() };
  return cleaned;
}

export function resolveDefaultBankAccount(accounts: BankAccount[]): BankAccount | undefined {
  if (!accounts || accounts.length === 0) return undefined;
  return accounts.find((a) => a.isDefault) || accounts[0];
}

export async function getDefaultBankAccount(): Promise<BankAccount> {
  const accounts = await getBankAccounts();
  return resolveDefaultBankAccount(accounts) || DEFAULT_BANK_ACCOUNTS[0];
}
