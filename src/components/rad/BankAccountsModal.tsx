"use client";

import React, { useState, useEffect } from "react";
import {
  Landmark,
  Plus,
  Pencil,
  Trash2,
  Check,
  Star,
  X,
  Loader2,
  AlertCircle,
  Building2,
  CheckCircle2,
} from "lucide-react";
import { BankAccount } from "@/lib/bankAccounts";

interface BankAccountsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onUpdated?: (accounts: BankAccount[]) => void;
}

export function BankAccountsModal({
  isOpen,
  onClose,
  onUpdated,
}: BankAccountsModalProps) {
  const [accounts, setAccounts] = useState<BankAccount[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Form state for Add / Edit
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formAccountName, setFormAccountName] = useState("");
  const [formAccountNumber, setFormAccountNumber] = useState("");
  const [formBankName, setFormBankName] = useState("");
  const [formBranch, setFormBranch] = useState("");
  const [formIsDefault, setFormIsDefault] = useState(false);

  useEffect(() => {
    if (isOpen) {
      loadAccounts();
    }
  }, [isOpen]);

  const loadAccounts = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/rad/bank-accounts");
      if (res.ok) {
        const data = await res.json();
        setAccounts(data.bankAccounts || []);
      } else {
        setError("Failed to load bank accounts.");
      }
    } catch (e) {
      setError("Network error while loading bank accounts.");
    } finally {
      setIsLoading(false);
    }
  };

  const resetForm = () => {
    setEditingId(null);
    setFormAccountName("LK TRONICS TRADING PVT LTD");
    setFormAccountNumber("");
    setFormBankName("Hatton National Bank (HNB)");
    setFormBranch("Biyagama Branch");
    setFormIsDefault(false);
    setIsFormOpen(false);
  };

  const handleStartAdd = () => {
    resetForm();
    setIsFormOpen(true);
  };

  const handleStartEdit = (acc: BankAccount) => {
    setEditingId(acc.id);
    setFormAccountName(acc.accountName);
    setFormAccountNumber(acc.accountNumber);
    setFormBankName(acc.bankName);
    setFormBranch(acc.branch);
    setFormIsDefault(Boolean(acc.isDefault));
    setIsFormOpen(true);
  };

  const handleSaveForm = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formAccountName.trim() || !formAccountNumber.trim() || !formBankName.trim()) {
      setError("Please fill in Account Name, Account Number, and Bank Name.");
      return;
    }

    let updatedList: BankAccount[] = [];

    if (editingId) {
      // Editing existing account
      updatedList = accounts.map((acc) => {
        if (acc.id === editingId) {
          return {
            ...acc,
            accountName: formAccountName.trim(),
            accountNumber: formAccountNumber.trim(),
            bankName: formBankName.trim(),
            branch: formBranch.trim() || "Head Office",
            isDefault: formIsDefault,
          };
        }
        return formIsDefault ? { ...acc, isDefault: false } : acc;
      });
    } else {
      // Adding new account
      const newAcc: BankAccount = {
        id: `bank-${Date.now()}`,
        accountName: formAccountName.trim(),
        accountNumber: formAccountNumber.trim(),
        bankName: formBankName.trim(),
        branch: formBranch.trim() || "Head Office",
        isDefault: formIsDefault || accounts.length === 0,
      };

      if (newAcc.isDefault) {
        updatedList = accounts.map((acc) => ({ ...acc, isDefault: false }));
        updatedList.push(newAcc);
      } else {
        updatedList = [...accounts, newAcc];
      }
    }

    await persistAccounts(updatedList, editingId ? "Account updated successfully." : "New bank account added successfully.");
    resetForm();
  };

  const handleSetDefault = async (targetId: string) => {
    const updatedList = accounts.map((acc) => ({
      ...acc,
      isDefault: acc.id === targetId,
    }));
    await persistAccounts(updatedList, "Default bank account updated.");
  };

  const handleDelete = async (targetId: string) => {
    if (accounts.length <= 1) {
      setError("Cannot delete the only bank account. At least one bank account must remain.");
      return;
    }

    if (!confirm("Are you sure you want to delete this bank account?")) {
      return;
    }

    const filtered = accounts.filter((acc) => acc.id !== targetId);
    // If deleted was default, make the first one default
    if (!filtered.some((acc) => acc.isDefault)) {
      filtered[0].isDefault = true;
    }

    await persistAccounts(filtered, "Bank account removed successfully.");
  };

  const persistAccounts = async (newList: BankAccount[], successMsg: string) => {
    setIsSaving(true);
    setError(null);
    setSuccess(null);
    try {
      const res = await fetch("/api/rad/bank-accounts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bankAccounts: newList }),
      });

      if (res.ok) {
        const data = await res.json();
        const saved = data.bankAccounts || newList;
        setAccounts(saved);
        setSuccess(successMsg);
        onUpdated?.(saved);
        setTimeout(() => setSuccess(null), 3000);
      } else {
        const data = await res.json().catch(() => ({}));
        setError(data.error || "Failed to update bank accounts.");
      }
    } catch (e) {
      setError("Network error while saving bank accounts.");
    } finally {
      setIsSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-2xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-950/50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-teal-950/80 border border-teal-800/80 flex items-center justify-center text-teal-400">
              <Landmark className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                Settlement Bank Accounts
              </h2>
              <p className="text-xs text-slate-400">
                Configure corporate bank accounts for 3D Print, PCB, and Project Proposals
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 overflow-y-auto space-y-4 flex-1">
          {error && (
            <div className="p-3 bg-red-950/50 border border-red-800/70 rounded-xl text-xs text-red-300 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 text-red-400" />
              <span>{error}</span>
            </div>
          )}

          {success && (
            <div className="p-3 bg-teal-950/50 border border-teal-800/70 rounded-xl text-xs text-teal-300 flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 shrink-0 text-teal-400" />
              <span>{success}</span>
            </div>
          )}

          {/* Accounts List */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                Configured Accounts ({accounts.length})
              </span>
              {!isFormOpen && (
                <button
                  type="button"
                  onClick={handleStartAdd}
                  className="px-3 py-1.5 rounded-lg bg-teal-600 hover:bg-teal-500 text-white text-xs font-medium flex items-center gap-1.5 transition-colors shadow-sm"
                >
                  <Plus className="w-4 h-4" />
                  <span>Add New Account</span>
                </button>
              )}
            </div>

            {isLoading ? (
              <div className="py-8 flex items-center justify-center text-slate-400 gap-2 text-xs">
                <Loader2 className="w-4 h-4 animate-spin text-teal-400" />
                <span>Loading bank accounts...</span>
              </div>
            ) : accounts.length === 0 ? (
              <div className="py-8 text-center text-slate-500 text-xs">
                No bank accounts found. Click &quot;Add New Account&quot; to configure one.
              </div>
            ) : (
              accounts.map((acc) => (
                <div
                  key={acc.id}
                  className={`p-4 rounded-xl border transition-all ${
                    acc.isDefault
                      ? "bg-teal-950/30 border-teal-800/70 ring-1 ring-teal-500/20"
                      : "bg-slate-950/60 border-slate-800 hover:border-slate-700"
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold text-sm text-white flex items-center gap-1.5">
                          <Building2 className="w-4 h-4 text-teal-400" />
                          {acc.bankName}
                        </span>
                        {acc.isDefault && (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-teal-500/20 text-teal-300 border border-teal-500/30 flex items-center gap-1">
                            <Star className="w-3 h-3 fill-teal-400 text-teal-400" />
                            DEFAULT
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-slate-300">
                        <span className="text-slate-400">Account No:</span>{" "}
                        <span className="font-mono font-medium text-amber-400">
                          {acc.accountNumber}
                        </span>
                      </div>
                      <div className="text-xs text-slate-400">
                        <span className="text-slate-500">Name:</span> {acc.accountName}
                      </div>
                      <div className="text-xs text-slate-400">
                        <span className="text-slate-500">Branch:</span> {acc.branch}
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-1.5 shrink-0">
                      {!acc.isDefault && (
                        <button
                          type="button"
                          onClick={() => handleSetDefault(acc.id)}
                          disabled={isSaving}
                          title="Set as Default Account"
                          className="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium border border-slate-700 transition-colors"
                        >
                          Make Default
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => handleStartEdit(acc)}
                        disabled={isSaving}
                        title="Edit Account Details"
                        className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 transition-colors"
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                      {accounts.length > 1 && (
                        <button
                          type="button"
                          onClick={() => handleDelete(acc.id)}
                          disabled={isSaving}
                          title="Delete Account"
                          className="p-1.5 rounded-lg bg-red-950/40 hover:bg-red-900/60 text-red-400 hover:text-red-200 border border-red-900/40 transition-colors"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Add / Edit Form */}
          {isFormOpen && (
            <form
              onSubmit={handleSaveForm}
              className="p-4 rounded-xl bg-slate-950 border border-teal-800/80 space-y-4 animate-in slide-in-from-top-2 duration-150"
            >
              <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                <span className="text-xs font-bold text-teal-400 uppercase tracking-wider flex items-center gap-1.5">
                  <Landmark className="w-4 h-4" />
                  {editingId ? "Edit Bank Account" : "Add New Bank Account"}
                </span>
                <button
                  type="button"
                  onClick={resetForm}
                  className="text-slate-400 hover:text-slate-200 text-xs"
                >
                  Cancel
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="sm:col-span-2">
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Beneficiary Account Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={formAccountName}
                    onChange={(e) => setFormAccountName(e.target.value)}
                    placeholder="e.g. LK TRONICS TRADING PVT LTD"
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-teal-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Bank Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={formBankName}
                    onChange={(e) => setFormBankName(e.target.value)}
                    placeholder="e.g. Hatton National Bank (HNB) / Commercial Bank"
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-teal-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Account Number *
                  </label>
                  <input
                    type="text"
                    required
                    value={formAccountNumber}
                    onChange={(e) => setFormAccountNumber(e.target.value)}
                    placeholder="e.g. 047010021564"
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white font-mono focus:outline-none focus:border-teal-500"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Bank Branch *
                  </label>
                  <input
                    type="text"
                    required
                    value={formBranch}
                    onChange={(e) => setFormBranch(e.target.value)}
                    placeholder="e.g. Biyagama Branch / Homagama Branch"
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-teal-500"
                  />
                </div>

                <div className="sm:col-span-2 flex items-center gap-2 pt-1">
                  <input
                    type="checkbox"
                    id="modal-is-default"
                    checked={formIsDefault}
                    onChange={(e) => setFormIsDefault(e.target.checked)}
                    className="w-4 h-4 rounded border-slate-700 bg-slate-900 text-teal-500 focus:ring-teal-500"
                  />
                  <label htmlFor="modal-is-default" className="text-xs text-slate-300 font-medium cursor-pointer">
                    Set this as the default settlement account for new quotations
                  </label>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-800">
                <button
                  type="button"
                  onClick={resetForm}
                  className="px-3 py-1.5 rounded-lg bg-slate-800 text-slate-300 text-xs font-medium hover:bg-slate-700 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  className="px-4 py-1.5 rounded-lg bg-teal-600 hover:bg-teal-500 text-white text-xs font-semibold flex items-center gap-1.5 transition-colors shadow-sm disabled:opacity-50"
                >
                  {isSaving ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Check className="w-3.5 h-3.5" />
                  )}
                  <span>{editingId ? "Save Changes" : "Add Account"}</span>
                </button>
              </div>
            </form>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3.5 border-t border-slate-800 bg-slate-950 flex items-center justify-between text-xs text-slate-400">
          <span>Changes are saved permanently in the system.</span>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-white text-xs font-medium transition-colors"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}

