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
  Eye,
  EyeOff,
  Building2,
  Plus,
} from "lucide-react";

interface DepartmentItem {
  id: number;
  name: string;
  _count?: { users: number };
}

interface UserItem {
  id: number;
  name: string;
  username: string;
  role: "SUPERADMIN" | "ADMIN" | "STAFF" | "SHOP";
  status: "ACTIVE" | "INACTIVE";
  departmentId?: number | null;
  department?: { id: number; name: string } | null;
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
  const [showPassword, setShowPassword] = useState(false);
  const [formRole, setFormRole] = useState<"SUPERADMIN" | "ADMIN" | "STAFF" | "SHOP">("STAFF");
  const [formStatus, setFormStatus] = useState<"ACTIVE" | "INACTIVE">("ACTIVE");
  const [formDepartmentId, setFormDepartmentId] = useState<string>("");

  // Departments State
  const [departments, setDepartments] = useState<DepartmentItem[]>([]);
  const [isAddingDeptInline, setIsAddingDeptInline] = useState(false);
  const [newDeptName, setNewDeptName] = useState("");
  const [isSavingDept, setIsSavingDept] = useState(false);
  const [deptActionError, setDeptActionError] = useState<string | null>(null);
  const [isDeptManagerModalOpen, setIsDeptManagerModalOpen] = useState(false);
  const [deletingDeptId, setDeletingDeptId] = useState<number | null>(null);

  const [modalError, setModalError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const fetchDepartments = async () => {
    try {
      const res = await fetch("/api/departments");
      if (res.ok) {
        const data = await res.json();
        setDepartments(data.departments || []);
      }
    } catch (err) {
      console.error("Failed to load departments:", err);
    }
  };

  const fetchUsers = async () => {
    setIsLoading(true);
    try {
      const res = await fetch("/api/users");
      if (res.ok) {
        const data = await res.json();
        const normalized = (data || []).map((u: UserItem) => {
          const rawRole = String(u.role || "").trim().toUpperCase();
          const role =
            rawRole === "SUPERADMIN" || rawRole === "ADMIN" || rawRole === "SHOP" || rawRole === "STAFF"
              ? (rawRole as "SUPERADMIN" | "ADMIN" | "STAFF" | "SHOP")
              : u.username?.toLowerCase().includes("shop") || u.name?.toLowerCase().includes("shop")
              ? "SHOP"
              : "STAFF";
          return { ...u, role };
        });
        setUsers(normalized);
      }
    } catch (err) {
      console.error("Failed to load users:", err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
    fetchDepartments();
  }, []);

  const handleCreateDepartment = async () => {
    if (!newDeptName.trim()) return;
    setIsSavingDept(true);
    setDeptActionError(null);
    try {
      const res = await fetch("/api/departments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newDeptName.trim() }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to create department");
      }
      if (data.department) {
        setDepartments((prev) =>
          [...prev, data.department].sort((a, b) => a.name.localeCompare(b.name))
        );
        setFormDepartmentId(String(data.department.id));
        setNewDeptName("");
        setIsAddingDeptInline(false);
      }
    } catch (err: any) {
      setDeptActionError(err.message || "Failed to create department");
    } finally {
      setIsSavingDept(false);
    }
  };

  const handleDeleteDepartment = async (dept: DepartmentItem) => {
    const userCount = dept._count?.users || 0;
    const warning =
      userCount > 0
        ? `\n\nNotice: ${userCount} user(s) currently assigned to this department will become unassigned.`
        : "";

    if (!confirm(`Are you sure you want to delete department "${dept.name}"?${warning}`)) {
      return;
    }

    setDeletingDeptId(dept.id);
    setDeptActionError(null);
    try {
      const res = await fetch(`/api/departments/${dept.id}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to delete department");
      }

      setDepartments((prev) => prev.filter((d) => d.id !== dept.id));
      if (formDepartmentId === String(dept.id)) {
        setFormDepartmentId("");
      }
      fetchUsers();
    } catch (err: any) {
      setDeptActionError(err.message || "Failed to delete department");
    } finally {
      setDeletingDeptId(null);
    }
  };

  const handleOpenAddModal = () => {
    setEditingUser(null);
    setFormName("");
    setFormUsername("");
    setFormPassword("");
    setShowPassword(false);
    setFormRole("STAFF");
    setFormStatus("ACTIVE");
    setFormDepartmentId("");
    setIsAddingDeptInline(false);
    setNewDeptName("");
    setDeptActionError(null);
    setModalError(null);
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (user: UserItem) => {
    setEditingUser(user);
    setFormName(user.name);
    setFormUsername(user.username);
    setFormPassword(""); // Blank means keep existing password
    setShowPassword(false);
    const rawRole = String(user.role || "").trim().toUpperCase();
    const resolvedRole =
      rawRole === "SUPERADMIN" || rawRole === "ADMIN" || rawRole === "SHOP" || rawRole === "STAFF"
        ? (rawRole as "SUPERADMIN" | "ADMIN" | "STAFF" | "SHOP")
        : user.username?.toLowerCase().includes("shop") || user.name?.toLowerCase().includes("shop")
        ? "SHOP"
        : "STAFF";
    setFormRole(resolvedRole);
    setFormStatus(user.status);
    setFormDepartmentId(
      user.departmentId
        ? String(user.departmentId)
        : user.department?.id
        ? String(user.department.id)
        : ""
    );
    setIsAddingDeptInline(false);
    setNewDeptName("");
    setDeptActionError(null);
    setModalError(null);
    setIsModalOpen(true);
  };

  const handleSaveUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setModalError(null);
    setIsSaving(true);

    try {
      if (editingUser) {
        const isEditingSuperAdmin = editingUser.role === "SUPERADMIN";
        const payload: any = {};

        if (isEditingSuperAdmin) {
          // SuperAdmin: only username and password can be changed
          payload.username = formUsername;
          if (formPassword && formPassword.trim().length > 0) {
            if (formPassword.length < 6) {
              throw new Error("New password must be at least 6 characters");
            }
            payload.password = formPassword;
          }
        } else {
          // All other users: ALL details can be changed!
          payload.name = formName;
          payload.username = formUsername;
          if (formPassword && formPassword.trim().length > 0) {
            if (formPassword.length < 6) {
              throw new Error("New password must be at least 6 characters");
            }
            payload.password = formPassword;
          }
          payload.role = formRole;
          payload.status = formStatus;
          payload.departmentId = formDepartmentId ? parseInt(formDepartmentId, 10) : null;
        }

        const res = await fetch(`/api/users/${editingUser.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
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
            departmentId: formDepartmentId ? parseInt(formDepartmentId, 10) : null,
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
      alert("The SuperAdmin account cannot be deactivated.");
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
      alert("The SuperAdmin account cannot be deleted.");
      return;
    }

    if (user.id === currentUserId) {
      alert("You cannot delete your own account.");
      return;
    }

    if (
      !confirm(
        `Are you sure you want to completely and permanently delete user @${user.username}?\n\nThis account will be permanently removed from the database (NOT set to inactive).`
      )
    ) {
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
        alert(data.error || "Failed to permanently delete user");
      }
    } catch (err) {
      alert("Error deleting user");
    }
  };

  const isEditingSuperAdmin = editingUser?.role === "SUPERADMIN";

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

          <div className="flex items-center gap-3">
            <button
              onClick={() => setIsDeptManagerModalOpen(true)}
              className="flex items-center gap-2 px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 rounded-lg text-xs font-semibold transition-all cursor-pointer"
            >
              <Building2 className="w-4 h-4 text-teal-400" />
              <span>Departments ({departments.length})</span>
            </button>

            <button
              onClick={handleOpenAddModal}
              className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-semibold shadow-lg shadow-indigo-600/20 transition-all cursor-pointer"
            >
              <UserPlus className="w-4 h-4" />
              Add New User
            </button>
          </div>
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
                  <th className="py-3.5 px-4">Department</th>
                  <th className="py-3.5 px-4 text-center">Status</th>
                  <th className="py-3.5 px-4">Created Date</th>
                  <th className="py-3.5 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800 text-sm">
                {isLoading ? (
                  <tr>
                    <td colSpan={7} className="py-12 text-center">
                      <Loader2 className="w-6 h-6 animate-spin text-indigo-400 mx-auto mb-2" />
                      <span className="text-xs text-slate-400">Loading user accounts...</span>
                    </td>
                  </tr>
                ) : users.map((user) => (
                  <tr key={user.id} className="hover:bg-slate-800/40 transition-colors">
                    <td className="py-3 px-4 font-semibold text-slate-200 flex items-center gap-2">
                      {user.role === "SUPERADMIN" ? (
                        <>
                          <Crown className="w-4 h-4 text-amber-400 shrink-0" />
                          <span>{user.name}</span>
                          <span className="text-[9px] font-bold tracking-wider text-amber-300 bg-amber-500/20 border border-amber-500/30 px-1.5 py-0.5 rounded uppercase">
                            SuperAdmin
                          </span>
                        </>
                      ) : (
                        <span>{user.name}</span>
                      )}
                    </td>
                    <td className="py-3 px-4 font-mono text-xs text-slate-300">
                      @{user.username}
                    </td>
                    <td className="py-3 px-4">
                      {(() => {
                        const rawRole = String(user.role || "").trim().toUpperCase();
                        const displayRole =
                          rawRole === "SUPERADMIN" || rawRole === "ADMIN" || rawRole === "SHOP" || rawRole === "STAFF"
                            ? rawRole
                            : user.username?.toLowerCase().includes("shop") || user.name?.toLowerCase().includes("shop")
                            ? "SHOP"
                            : "STAFF";

                        return (
                          <span
                            className={`text-[10px] font-semibold px-2 py-0.5 rounded-full uppercase tracking-wider ${
                              displayRole === "SUPERADMIN"
                                ? "bg-purple-500/10 text-purple-400 border border-purple-500/20"
                                : displayRole === "ADMIN"
                                ? "bg-amber-500/10 text-amber-400 border border-amber-500/20"
                                : displayRole === "SHOP"
                                ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                                : "bg-indigo-500/10 text-indigo-400 border border-indigo-500/20"
                            }`}
                          >
                            {displayRole}
                          </span>
                        );
                      })()}
                    </td>
                    <td className="py-3 px-4">
                      {user.department ? (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md text-xs font-medium bg-slate-800 text-teal-300 border border-teal-500/20">
                          <Building2 className="w-3 h-3 text-teal-400" />
                          {user.department.name}
                        </span>
                      ) : (
                        <span className="text-slate-500 text-xs italic">—</span>
                      )}
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
                          className="p-1.5 text-slate-400 hover:text-indigo-400 disabled:opacity-30 disabled:cursor-not-allowed rounded-lg hover:bg-slate-800 transition-colors cursor-pointer"
                          title={
                            user.role === "SUPERADMIN"
                              ? "Edit SuperAdmin Username or Password"
                              : "Edit User Details"
                          }
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>

                        {/* SuperAdmin: Protected completely from deletion & status toggle */}
                        {user.role === "SUPERADMIN" ? (
                          <div
                            className="p-1.5 text-amber-400/60 cursor-not-allowed rounded-lg bg-slate-950/40"
                            title="SuperAdmin account cannot be deleted or deactivated"
                          >
                            <Lock className="w-4 h-4" />
                          </div>
                        ) : (
                          <>
                            {/* Deactivate/Activate Status Button */}
                            <button
                              onClick={() => handleToggleStatus(user)}
                              disabled={user.id === currentUserId}
                              className={`p-1.5 rounded-lg transition-colors cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed ${
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

                            {/* Permanently Delete User Button */}
                            <button
                              onClick={() => handleDeleteUser(user)}
                              disabled={user.id === currentUserId}
                              className="p-1.5 text-slate-400 hover:text-rose-400 hover:bg-slate-800 disabled:opacity-30 disabled:cursor-not-allowed rounded-lg transition-colors cursor-pointer"
                              title={
                                user.id === currentUserId
                                  ? "You cannot delete your own account"
                                  : "Completely and permanently delete user account"
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
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                {editingUser ? (
                  <>
                    <Edit2 className="w-4 h-4 text-indigo-400" />
                    <span>
                      {isEditingSuperAdmin
                        ? `Edit SuperAdmin (@${editingUser.username})`
                        : `Edit User (@${editingUser.username})`}
                    </span>
                  </>
                ) : (
                  <>
                    <UserPlus className="w-4 h-4 text-indigo-400" />
                    <span>Create New User</span>
                  </>
                )}
              </h3>
              <button
                onClick={() => setIsModalOpen(false)}
                className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Informational Guidance Banner - ONLY for SuperAdmin */}
            {isEditingSuperAdmin && (
              <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-xs text-amber-300 flex items-start gap-2.5">
                <Crown className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                <div>
                  <span className="font-semibold block text-amber-200">SuperAdmin Account</span>
                  <span>Username and password can be updated. Full name, role, and account status are locked.</span>
                </div>
              </div>
            )}

            {modalError && (
              <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-xs text-rose-400 flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{modalError}</span>
              </div>
            )}

            <form
              key={editingUser ? `edit-${editingUser.id}-${editingUser.username}` : "create-user"}
              onSubmit={handleSaveUser}
              autoComplete="off"
              className="space-y-4 text-xs"
            >
              {/* Deceive browser password managers so they never overwrite the user's username with the admin's */}
              <input
                type="text"
                name="pms_prevent_autofill_user"
                aria-hidden="true"
                tabIndex={-1}
                autoComplete="off"
                style={{ display: "none", position: "absolute", opacity: 0, pointerEvents: "none" }}
              />
              <input
                type="password"
                name="pms_prevent_autofill_pass"
                aria-hidden="true"
                tabIndex={-1}
                autoComplete="new-password"
                style={{ display: "none", position: "absolute", opacity: 0, pointerEvents: "none" }}
              />

              {/* Full Name Field - Locked ONLY for SuperAdmin, Editable for all other users */}
              <div>
                <label className="block text-slate-300 font-semibold mb-1.5 flex items-center justify-between">
                  <span>Full Name</span>
                  {isEditingSuperAdmin && (
                    <span className="text-[10px] text-slate-400 font-normal flex items-center gap-1">
                      <Lock className="w-3 h-3 text-slate-500" /> Locked
                    </span>
                  )}
                </label>
                <input
                  type="text"
                  name="edit_account_name"
                  required
                  disabled={isEditingSuperAdmin}
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  placeholder="e.g. John Doe"
                  autoComplete="off"
                  className="w-full px-3.5 py-2 bg-slate-950 border border-slate-800 rounded-lg text-white focus:outline-none focus:ring-1 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed disabled:bg-slate-900/60"
                />
              </div>

              {/* Username Field - Editable for SuperAdmin and ALL other users */}
              <div>
                <label className="block text-slate-300 font-semibold mb-1.5">
                  Username
                </label>
                <input
                  type="text"
                  name="edit_account_username"
                  required
                  value={formUsername}
                  onChange={(e) => setFormUsername(e.target.value.toLowerCase())}
                  placeholder="e.g. jdoe"
                  autoComplete="off"
                  autoCorrect="off"
                  autoCapitalize="none"
                  spellCheck="false"
                  className="w-full px-3.5 py-2 bg-slate-950 border border-slate-800 rounded-lg text-white font-mono focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />
              </div>

              {/* Password Field with View/Hide Toggle */}
              <div>
                <label className="block text-slate-300 font-semibold mb-1.5">
                  {editingUser ? "New Password (leave blank to keep current)" : "Password"}
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? "text" : "password"}
                    name="edit_account_password"
                    required={!editingUser}
                    value={formPassword}
                    onChange={(e) => setFormPassword(e.target.value)}
                    placeholder={
                      editingUser
                        ? "•••••••• (Leave blank to keep unchanged)"
                        : "At least 6 characters"
                    }
                    autoComplete="new-password"
                    className="w-full pl-3.5 pr-10 py-2 bg-slate-950 border border-slate-800 rounded-lg text-white font-mono focus:outline-none focus:ring-1 focus:ring-indigo-500 text-xs"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-200 transition-colors cursor-pointer"
                    title={showPassword ? "Hide password" : "Show password"}
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* Department Field */}
              <div>
                <label className="block text-slate-300 font-semibold mb-1.5 flex items-center justify-between">
                  <span>Department</span>
                  {isEditingSuperAdmin && (
                    <span className="text-[10px] text-slate-400 font-normal flex items-center gap-1">
                      <Lock className="w-3 h-3 text-slate-500" /> Optional
                    </span>
                  )}
                </label>

                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <select
                      value={formDepartmentId}
                      onChange={(e) => setFormDepartmentId(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-white focus:outline-none focus:ring-1 focus:ring-indigo-500 text-xs"
                    >
                      <option value="">-- No Department Assigned --</option>
                      {departments.map((dept) => (
                        <option key={dept.id} value={dept.id}>
                          {dept.name}
                        </option>
                      ))}
                    </select>

                    <button
                      type="button"
                      onClick={() => {
                        setIsAddingDeptInline(!isAddingDeptInline);
                        setDeptActionError(null);
                      }}
                      title="Add a new department"
                      className="px-2.5 py-2 bg-slate-800 hover:bg-slate-700 text-indigo-300 border border-slate-700 rounded-lg text-xs font-semibold shrink-0 flex items-center gap-1 transition-colors cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>New</span>
                    </button>
                  </div>

                  {/* Inline New Department Adder */}
                  {isAddingDeptInline && (
                    <div className="p-2.5 bg-slate-950 border border-indigo-900/60 rounded-lg space-y-2 animate-in fade-in zoom-in-95">
                      <div className="flex items-center gap-2">
                        <input
                          type="text"
                          value={newDeptName}
                          onChange={(e) => setNewDeptName(e.target.value)}
                          placeholder="Enter department name..."
                          className="flex-1 px-2.5 py-1.5 bg-slate-900 border border-slate-700 rounded text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              e.preventDefault();
                              handleCreateDepartment();
                            }
                          }}
                          autoFocus
                        />
                        <button
                          type="button"
                          onClick={handleCreateDepartment}
                          disabled={isSavingDept || !newDeptName.trim()}
                          className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded text-xs font-semibold disabled:opacity-50 flex items-center gap-1 shrink-0 cursor-pointer"
                        >
                          {isSavingDept ? (
                            <Loader2 className="w-3 h-3 animate-spin" />
                          ) : (
                            <Check className="w-3 h-3" />
                          )}
                          Save
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setIsAddingDeptInline(false);
                            setDeptActionError(null);
                          }}
                          className="px-2 py-1.5 text-slate-400 hover:text-white text-xs cursor-pointer"
                        >
                          Cancel
                        </button>
                      </div>

                      {deptActionError && (
                        <p className="text-[11px] text-rose-400">{deptActionError}</p>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* Role and Account Status Grid */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-slate-300 font-semibold mb-1.5 flex items-center justify-between">
                    <span>Role</span>
                    {isEditingSuperAdmin && (
                      <span className="text-[10px] text-slate-400 font-normal flex items-center gap-1">
                        <Lock className="w-3 h-3 text-slate-500" /> Locked
                      </span>
                    )}
                  </label>
                  <select
                    value={formRole}
                    onChange={(e) => setFormRole(e.target.value as any)}
                    disabled={isEditingSuperAdmin}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-white focus:outline-none focus:ring-1 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed disabled:bg-slate-900/60"
                  >
                    <option value="STAFF">STAFF</option>
                    <option value="SHOP">SHOP</option>
                    <option value="ADMIN">ADMIN</option>
                    {isEditingSuperAdmin && <option value="SUPERADMIN">SUPERADMIN</option>}
                  </select>
                </div>

                <div>
                  <label className="block text-slate-300 font-semibold mb-1.5 flex items-center justify-between">
                    <span>Account Status</span>
                    {isEditingSuperAdmin && (
                      <span className="text-[10px] text-slate-400 font-normal flex items-center gap-1">
                        <Lock className="w-3 h-3 text-slate-500" /> Locked
                      </span>
                    )}
                  </label>
                  <select
                    value={formStatus}
                    onChange={(e) => setFormStatus(e.target.value as any)}
                    disabled={isEditingSuperAdmin}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-white focus:outline-none focus:ring-1 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed disabled:bg-slate-900/60"
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
                  className="px-4 py-2 border border-slate-700 hover:bg-slate-800 text-slate-300 rounded-lg font-semibold transition-colors cursor-pointer"
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

      {/* Department Manager Modal */}
      {isDeptManagerModalOpen && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="w-full max-w-lg bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-2xl space-y-5 animate-in zoom-in-95">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Building2 className="w-5 h-5 text-teal-400" />
                <span>Department Management</span>
              </h3>
              <button
                onClick={() => {
                  setIsDeptManagerModalOpen(false);
                  setDeptActionError(null);
                }}
                className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Quick Add Form in Manager Modal */}
            <div className="p-3 bg-slate-950 border border-slate-800 rounded-xl space-y-2">
              <label className="block text-xs font-semibold text-slate-300">
                Create New Department
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={newDeptName}
                  onChange={(e) => setNewDeptName(e.target.value)}
                  placeholder="e.g. Research & Development"
                  className="flex-1 px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-xs text-white placeholder-slate-500 focus:outline-none focus:border-teal-500"
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      handleCreateDepartment();
                    }
                  }}
                />
                <button
                  type="button"
                  onClick={handleCreateDepartment}
                  disabled={isSavingDept || !newDeptName.trim()}
                  className="px-4 py-2 bg-teal-600 hover:bg-teal-500 text-white rounded-lg text-xs font-semibold disabled:opacity-50 flex items-center gap-1.5 shrink-0 transition-colors cursor-pointer"
                >
                  {isSavingDept ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Plus className="w-3.5 h-3.5" />
                  )}
                  Add Department
                </button>
              </div>
              {deptActionError && (
                <p className="text-[11px] text-rose-400">{deptActionError}</p>
              )}
            </div>

            {/* Department List */}
            <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
              <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider px-1">
                Existing Departments ({departments.length})
              </div>
              {departments.length === 0 ? (
                <div className="p-4 text-center text-xs text-slate-500 border border-dashed border-slate-800 rounded-lg">
                  No departments found. Add one above.
                </div>
              ) : (
                <div className="divide-y divide-slate-800/80 border border-slate-800 rounded-xl overflow-hidden bg-slate-950/40">
                  {departments.map((dept) => (
                    <div
                      key={dept.id}
                      className="p-3 flex items-center justify-between text-xs hover:bg-slate-800/30 transition-colors"
                    >
                      <div className="flex items-center gap-2.5 min-w-0 pr-2">
                        <Building2 className="w-4 h-4 text-teal-400 shrink-0" />
                        <span className="font-medium text-slate-200 truncate">{dept.name}</span>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className="text-[11px] text-slate-400 bg-slate-900 border border-slate-800 px-2 py-0.5 rounded-full">
                          {dept._count?.users ?? 0} {dept._count?.users === 1 ? "user" : "users"}
                        </span>
                        <button
                          type="button"
                          onClick={() => handleDeleteDepartment(dept)}
                          disabled={deletingDeptId === dept.id}
                          title={`Delete department "${dept.name}"`}
                          className="p-1 text-slate-400 hover:text-red-400 hover:bg-red-500/10 rounded transition-colors disabled:opacity-50 cursor-pointer"
                        >
                          {deletingDeptId === dept.id ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin text-red-400" />
                          ) : (
                            <Trash2 className="w-3.5 h-3.5" />
                          )}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="pt-3 border-t border-slate-800 flex justify-end">
              <button
                type="button"
                onClick={() => {
                  setIsDeptManagerModalOpen(false);
                  setDeptActionError(null);
                }}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs font-semibold transition-colors cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </AppLayout>
  );
}
