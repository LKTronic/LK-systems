"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { AppLayout } from "@/components/AppLayout";
import {
  Users,
  UserPlus,
  Edit2,
  UserCheck,
  UserX,
  Shield,
  Loader2,
  X,
  Check,
  AlertCircle,
  Lock,
  Crown,
  Trash2,
} from "lucide-react";

interface UserItem {
  id: number;
  name: string;
  username: string;
  role: "SUPERADMIN" | "ADMIN" | "STAFF";
  status: "ACTIVE" | "INACTIVE";
  createdAt: string;
}

export default function UsersPage() {
  const { data: session } = useSession();
  const currentUserRole = (session?.user as any)?.role || "STAFF";
  const currentUserId = parseInt((session?.user as any)?.id || "0", 10);
  const isSuperAdmin = currentUserRole === "SUPERADMIN";

  const [users, setUsers] = useState<UserItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Add / Edit Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<UserItem | null>(null);

  const [formName, setFormName] = useState("");
  const [formUsername, setFormUsername] = useState("");
  const [formPassword, setFormPassword] = useState("");
  const [formRole, setFormRole] = useState<"SUPERADMIN" | "ADMIN" | "STAFF">("STAFF");
  const [formStatus, setFormStatus] = useState<"ACTIVE" | "INACTIVE">("ACTIVE");

  const [modalError, setModalError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const fetchUsers = async () => {
    setIsLoading(true);
    try {
      const res = await fetch("/api/users");
      if (res.ok) {
        const data = await res.json();
        setUsers(data);
      }
    } catch (err) {
      console.error("Failed to load users:", err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const handleOpenAddModal = () => {
    setEditingUser(null);
    setFormName("");
    setFormUsername("");
    setFormPassword("");
    setFormRole("STAFF");
    setFormStatus("ACTIVE");
    setModalError(null);
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (user: UserItem) => {
    setEditingUser(user);
    setFormName(user.name);
    setFormUsername(user.username);
    setFormPassword(""); // Blank means don't change password
    setFormRole(user.role);
    setFormStatus(user.status);
    setModalError(null);
    setIsModalOpen(true);
  };

  const handleSaveUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setModalError(null);
    setIsSaving(true);

    try {
      if (editingUser) {
        // Update user
        const res = await fetch(`/api/users/${editingUser.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: formName,
            username: formUsername,
            password: formPassword || undefined,
            role: formRole,
            status: formStatus,
          }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Failed to update user");
      } else {
        // Create user
        if (!formPassword || formPassword.length < 6) {
          throw new Error("Password must be at least 6 characters");
        }
        const res = await fetch("/api/users", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: formName,
            username: formUsername,
            password: formPassword,
            role: formRole,
            status: formStatus,
          }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Failed to create user");
      }

      setIsModalOpen(false);
      fetchUsers();
    } catch (err: any) {
      setModalError(err.message || "Failed to save user");
    } finally {
      setIsSaving(false);
    }
  };

  const handleToggleStatus = async (user: UserItem) => {
    if (user.role === "SUPERADMIN") {
      alert("SuperAdmin accounts cannot be deactivated or deleted by anyone.");
      return;
    }

    if (user.id === currentUserId) {
      alert("You cannot deactivate your own account.");
      return;
    }

    const actionText = user.status === "ACTIVE" ? "deactivate" : "activate";
    if (!confirm(`Are you sure you want to ${actionText} user @${user.username}?`)) {
      return;
    }

    try {
      const res = await fetch(`/api/users/${user.id}?mode=toggle`, {
        method: "DELETE",
      });
      if (res.ok) {
        fetchUsers();
      } else {
        const data = await res.json();
        alert(data.error || `Failed to ${actionText} user`);
      }
    } catch (err) {
      alert("Error updating status");
    }
  };

  const handleDeleteUser = async (user: UserItem) => {
    if (user.role === "SUPERADMIN") {
      alert("SuperAdmin accounts cannot be deleted by anyone.");
      return;
    }

    if (user.id === currentUserId) {
      alert("You cannot delete your own account.");
      return;
    }

    if (!confirm(`Are you sure you want to delete user @${user.username}?`)) {
      return;
    }

    try {
      const res = await fetch(`/api/users/${user.id}?mode=delete`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (res.ok) {
        if (data.message) {
          alert(data.message);
        }
        fetchUsers();
      } else {
        alert(data.error || "Failed to delete user");
      }
    } catch (err) {
      alert("Error deleting user");
    }
  };

  return (
    <AppLayout
      title="User Management"
      description="Manage internal company accounts, roles, access privileges, and security credentials"
      requireAdmin={true}
    >
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-xs text-slate-400">
            <Shield className="w-4 h-4 text-amber-400" />
            <span>
              {isSuperAdmin
                ? "SuperAdmin Control Level (Immune to Deletion)"
                : "Administrator Access Level"}
            </span>
          </div>

          <button
            onClick={handleOpenAddModal}
            className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-semibold shadow-lg shadow-indigo-600/20 transition-all"
          >
            <UserPlus className="w-4 h-4" />
            Add New User
          </button>
        </div>

        {/* Users Table */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-xl">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-800 bg-slate-950/60 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                  <th className="py-3.5 px-4">User</th>
                  <th className="py-3.5 px-4">Username</th>
                  <th className="py-3.5 px-4">Role</th>
                  <th className="py-3.5 px-4 text-center">Status</th>
                  <th className="py-3.5 px-4">Created Date</th>
                  <th className="py-3.5 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800 text-sm">
                {isLoading ? (
                  <tr>
                    <td colSpan={6} className="py-12 text-center">
                      <Loader2 className="w-6 h-6 animate-spin text-indigo-400 mx-auto mb-2" />
                      <span className="text-xs text-slate-400">Loading user accounts...</span>
                    </td>
                  </tr>
                ) : users.map((user) => (
                  <tr key={user.id} className="hover:bg-slate-800/40 transition-colors">
                    <td className="py-3 px-4 font-semibold text-slate-200 flex items-center gap-2">
                      {user.role === "SUPERADMIN" && (
                        <Crown className="w-4 h-4 text-purple-400 shrink-0" />
                      )}
                      <span>{user.name}</span>
                    </td>
                    <td className="py-3 px-4 font-mono text-xs text-slate-300">
                      @{user.username}
                    </td>
                    <td className="py-3 px-4">
                      <span
                        className={`text-[10px] font-semibold px-2 py-0.5 rounded-full uppercase tracking-wider ${
                          user.role === "SUPERADMIN"
                            ? "bg-purple-500/10 text-purple-400 border border-purple-500/20"
                            : user.role === "ADMIN"
                            ? "bg-amber-500/10 text-amber-400 border border-amber-500/20"
                            : "bg-indigo-500/10 text-indigo-400 border border-indigo-500/20"
                        }`}
                      >
                        {user.role}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-center">
                      <span
                        className={`text-[10px] font-semibold px-2 py-0.5 rounded-full uppercase ${
                          user.status === "ACTIVE"
                            ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                            : "bg-rose-500/10 text-rose-400 border border-rose-500/20"
                        }`}
                      >
                        {user.status}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-xs text-slate-400">
                      {new Date(user.createdAt).toLocaleDateString()}
                    </td>
                    <td className="py-3 px-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        {/* Edit Button */}
                        <button
                          onClick={() => handleOpenEditModal(user)}
                          disabled={user.role === "SUPERADMIN" && !isSuperAdmin}
                          className="p-1.5 text-slate-400 hover:text-indigo-400 disabled:opacity-30 disabled:cursor-not-allowed rounded-lg hover:bg-slate-800 transition-colors"
                          title={
                            user.role === "SUPERADMIN" && !isSuperAdmin
                              ? "Only SuperAdmin can edit SuperAdmin accounts"
                              : "Edit User or Reset Password"
                          }
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>

                        {/* Deactivate/Activate Status Button & Delete Button */}
                        {user.role === "SUPERADMIN" ? (
                          <div
                            className="p-1.5 text-purple-400/50 cursor-not-allowed rounded-lg bg-slate-950/40"
                            title="SuperAdmin accounts cannot be deleted or deactivated by anyone"
                          >
                            <Lock className="w-4 h-4" />
                          </div>
                        ) : (
                          <>
                            <button
                              onClick={() => handleToggleStatus(user)}
                              disabled={user.id === currentUserId}
                              className={`p-1.5 rounded-lg transition-colors disabled:opacity-30 disabled:cursor-not-allowed ${
                                user.status === "ACTIVE"
                                  ? "text-slate-400 hover:text-amber-400 hover:bg-slate-800"
                                  : "text-slate-400 hover:text-emerald-400 hover:bg-slate-800"
                              }`}
                              title={
                                user.id === currentUserId
                                  ? "You cannot deactivate your own account"
                                  : user.status === "ACTIVE"
                                  ? "Deactivate User"
                                  : "Activate User"
                              }
                            >
                              {user.status === "ACTIVE" ? (
                                <UserX className="w-4 h-4" />
                              ) : (
                                <UserCheck className="w-4 h-4" />
                              )}
                            </button>

                            {/* Delete User Button */}
                            <button
                              onClick={() => handleDeleteUser(user)}
                              disabled={user.id === currentUserId}
                              className="p-1.5 text-slate-400 hover:text-rose-400 hover:bg-slate-800 disabled:opacity-30 disabled:cursor-not-allowed rounded-lg transition-colors"
                              title={
                                user.id === currentUserId
                                  ? "You cannot delete your own account"
                                  : "Delete User Account"
                              }
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Add / Edit User Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-2xl space-y-6">
            <div className="flex items-center justify-between pb-4 border-b border-slate-800">
              <h3 className="text-base font-bold text-white">
                {editingUser ? "Edit User Account" : "Create New User"}
              </h3>
              <button
                onClick={() => setIsModalOpen(false)}
                className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {modalError && (
              <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-xs text-rose-400 flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{modalError}</span>
              </div>
            )}

            <form onSubmit={handleSaveUser} className="space-y-4 text-xs">
              <div>
                <label className="block text-slate-300 font-semibold mb-1.5">
                  Full Name
                </label>
                <input
                  type="text"
                  required
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  placeholder="e.g. John Doe"
                  className="w-full px-3.5 py-2 bg-slate-950 border border-slate-800 rounded-lg text-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1.5">
                  Username
                </label>
                <input
                  type="text"
                  required
                  value={formUsername}
                  onChange={(e) => setFormUsername(e.target.value.toLowerCase())}
                  placeholder="e.g. jdoe"
                  className="w-full px-3.5 py-2 bg-slate-950 border border-slate-800 rounded-lg text-white font-mono focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1.5">
                  {editingUser ? "New Password (leave blank to keep current)" : "Password"}
                </label>
                <input
                  type="password"
                  value={formPassword}
                  onChange={(e) => setFormPassword(e.target.value)}
                  placeholder={editingUser ? "••••••••" : "At least 6 characters"}
                  className="w-full px-3.5 py-2 bg-slate-950 border border-slate-800 rounded-lg text-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-slate-300 font-semibold mb-1.5">
                    Role
                  </label>
                  <select
                    value={formRole}
                    onChange={(e) => setFormRole(e.target.value as any)}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  >
                    <option value="STAFF">STAFF</option>
                    <option value="ADMIN">ADMIN</option>
                    {isSuperAdmin && <option value="SUPERADMIN">SUPERADMIN</option>}
                  </select>
                </div>

                <div>
                  <label className="block text-slate-300 font-semibold mb-1.5">
                    Account Status
                  </label>
                  <select
                    value={formStatus}
                    onChange={(e) => setFormStatus(e.target.value as any)}
                    disabled={editingUser?.role === "SUPERADMIN"}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-white focus:outline-none focus:ring-1 focus:ring-indigo-500 disabled:opacity-50"
                  >
                    <option value="ACTIVE">ACTIVE</option>
                    <option value="INACTIVE">INACTIVE</option>
                  </select>
                </div>
              </div>

              <div className="pt-4 border-t border-slate-800 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 border border-slate-700 hover:bg-slate-800 text-slate-300 rounded-lg font-semibold transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  className="px-5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg font-semibold shadow-lg shadow-indigo-600/20 flex items-center gap-2 transition-all cursor-pointer disabled:opacity-50"
                >
                  {isSaving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                  Save User
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </AppLayout>
  );
}
