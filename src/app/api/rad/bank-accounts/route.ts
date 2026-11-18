import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getBankAccounts, saveBankAccounts, BankAccount } from "@/lib/bankAccounts";

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const accounts = await getBankAccounts();
    return NextResponse.json({ bankAccounts: accounts });
  } catch (error: any) {
    console.error("GET /api/rad/bank-accounts error:", error);
    return NextResponse.json(
      { error: "Failed to retrieve bank accounts: " + (error?.message || String(error)) },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { bankAccounts } = body;

    if (!Array.isArray(bankAccounts) || bankAccounts.length === 0) {
      return NextResponse.json(
        { error: "Invalid payload: bankAccounts must be a non-empty array" },
        { status: 400 }
      );
    }

    // Validate account fields
    for (const acc of bankAccounts) {
      if (!acc.accountName?.trim() || !acc.accountNumber?.trim() || !acc.bankName?.trim()) {
        return NextResponse.json(
          { error: "Account Name, Account Number, and Bank Name are required for all accounts." },
          { status: 400 }
        );
      }
    }

    const updated = await saveBankAccounts(bankAccounts);
    return NextResponse.json({ success: true, bankAccounts: updated });
  } catch (error: any) {
    console.error("POST /api/rad/bank-accounts error:", error);
    return NextResponse.json(
      { error: "Failed to save bank accounts: " + (error?.message || String(error)) },
      { status: 500 }
    );
  }
}

