import React, { useState, useEffect, useCallback, useMemo } from "react";
import {
    Users,
    UserPlus,
    Search,
    RefreshCw,
    Shield,
    User,
    KeyRound,
    Loader2,
    Calendar,
} from "lucide-react";
import type { AdminUserItem } from "../../types";
import { adminService } from "../../services/adminService";
import { useToast } from "../../context/ToastContext";
import { formatDateAdded } from "@music-cloud/utils";
import { AdminAddUserModal } from "../../components/admin/AdminAddUserModal";
import { AdminResetPasswordModal } from "../../components/admin/AdminResetPasswordModal";
import { AdminFilterTabs, type FilterTabOption } from "../../components/admin/AdminFilterTabs";

export const AdminUsersPage: React.FC = () => {
    const { showToast } = useToast();
    const [users, setUsers] = useState<AdminUserItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [searchQuery, setSearchQuery] = useState("");
    const [roleFilter, setRoleFilter] = useState<"ALL" | "ADMIN" | "USER">(
        "ALL",
    );

    // Modals
    const [isAddModalOpen, setIsAddModalOpen] = useState(false);
    const [resetUser, setResetUser] = useState<AdminUserItem | null>(null);

    const fetchUsers = useCallback(
        async (isRefresh = false) => {
            try {
                if (isRefresh) {
                    setIsRefreshing(true);
                } else {
                    setLoading(true);
                }
                const data = await adminService.getUsers();
                setUsers(data);
            } catch (err: unknown) {
                const msg =
                    (err as { response?: { data?: { detail?: string } } })
                        ?.response?.data?.detail || "Failed to load users.";
                showToast("Error", "error", msg);
            } finally {
                setLoading(false);
                setIsRefreshing(false);
            }
        },
        [showToast],
    );

    useEffect(() => {
        fetchUsers();
    }, [fetchUsers]);

    const filteredUsers = useMemo(() => {
        return users.filter((u) => {
            const matchesSearch =
                !searchQuery.trim() ||
                u.email
                    .toLowerCase()
                    .includes(searchQuery.toLowerCase().trim());

            if (!matchesSearch) return false;

            if (roleFilter === "ADMIN") return u.is_admin;
            if (roleFilter === "USER") return !u.is_admin;
            return true;
        });
    }, [users, searchQuery, roleFilter]);

    const adminCount = useMemo(
        () => users.filter((u) => u.is_admin).length,
        [users],
    );
    const standardCount = users.length - adminCount;

    const roleOptions: FilterTabOption<"ALL" | "ADMIN" | "USER">[] = useMemo(
        () => [
            { label: "All", value: "ALL", count: users.length },
            {
                label: "Admins",
                value: "ADMIN",
                count: adminCount,
                icon: <Shield size={13} />,
            },
            {
                label: "Standard",
                value: "USER",
                count: standardCount,
                icon: <User size={13} />,
            },
        ],
        [users.length, adminCount, standardCount],
    );

    return (
        <div className="admin-page-container">
            {/* Top Toolbar / Filter Row */}
            <div className="admin-filter-toolbar">
                <div className="admin-filter-group">
                    {/* Search Input */}
                    <div className="admin-search-box">
                        <Search size={15} className="admin-search-icon" />
                        <input
                            type="text"
                            placeholder="Search users by email..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="admin-search-input"
                        />
                        {searchQuery && (
                            <button
                                type="button"
                                onClick={() => setSearchQuery("")}
                                className="admin-search-clear-btn"
                            >
                                ×
                            </button>
                        )}
                    </div>

                    {/* Role Filter Tabs */}
                    <AdminFilterTabs
                        options={roleOptions}
                        value={roleFilter}
                        onChange={(val) =>
                            setRoleFilter(val as "ALL" | "ADMIN" | "USER")
                        }
                    />
                </div>

                <div className="admin-filter-meta">
                    <button
                        type="button"
                        onClick={() => fetchUsers(true)}
                        disabled={isRefreshing || loading}
                        className="admin-toolbar-btn admin-table-refresh-btn"
                        title="Refresh user list"
                    >
                        <RefreshCw
                            size={13}
                            className={
                                isRefreshing || loading ? "animate-spin" : ""
                            }
                        />
                        <span>Refresh</span>
                    </button>

                    <button
                        type="button"
                        onClick={() => setIsAddModalOpen(true)}
                        className="admin-toolbar-btn admin-add-user-btn"
                    >
                        <UserPlus size={14} />
                        <span>Add User</span>
                    </button>
                </div>
            </div>

            {/* Users Content Table */}
            {loading ? (
                <div className="admin-empty-state">
                    <Loader2
                        size={36}
                        className="animate-spin admin-empty-state-icon"
                        color="var(--app-green)"
                    />
                    <span className="admin-pagination-info">
                        Loading registered users...
                    </span>
                </div>
            ) : filteredUsers.length === 0 ? (
                <div className="admin-empty-state">
                    <Users size={40} className="admin-empty-state-icon" />
                    <p className="admin-empty-state-title">
                        {searchQuery || roleFilter !== "ALL"
                            ? "No matching users found"
                            : "No users registered"}
                    </p>
                    <p className="admin-empty-state-desc">
                        {searchQuery || roleFilter !== "ALL"
                            ? "Try adjusting your search query or role filter."
                            : "Add your first user to grant access to Music Cloud."}
                    </p>
                    {searchQuery || roleFilter !== "ALL" ? (
                        <button
                            type="button"
                            onClick={() => {
                                setSearchQuery("");
                                setRoleFilter("ALL");
                            }}
                            className="admin-toolbar-btn"
                        >
                            Reset Filters
                        </button>
                    ) : (
                        <button
                            type="button"
                            onClick={() => setIsAddModalOpen(true)}
                            className="admin-toolbar-btn admin-add-user-btn"
                        >
                            <UserPlus size={14} />
                            <span>Add First User</span>
                        </button>
                    )}
                </div>
            ) : (
                <div className="admin-table-container">
                    <table className="admin-table">
                        <thead>
                            <tr>
                                <th
                                    className="admin-table-th"
                                    style={{ width: "35%", minWidth: "200px" }}
                                >
                                    User
                                </th>
                                <th
                                    className="admin-table-th"
                                    style={{ width: "15%", minWidth: "100px" }}
                                >
                                    Role
                                </th>
                                <th
                                    className="admin-table-th"
                                    style={{ width: "20%", minWidth: "140px" }}
                                >
                                    Last Active
                                </th>
                                <th
                                    className="admin-table-th"
                                    style={{ width: "15%", minWidth: "110px" }}
                                >
                                    Created
                                </th>
                                <th
                                    className="admin-table-th right"
                                    style={{ width: "15%", minWidth: "150px" }}
                                >
                                    Actions
                                </th>
                            </tr>
                        </thead>
                        <tbody>
                            {filteredUsers.map((user) => {
                                const initial = user.email
                                    .charAt(0)
                                    .toUpperCase();
                                return (
                                    <tr
                                        key={user.id}
                                        className="admin-table-row"
                                    >
                                        {/* User Identity */}
                                        <td className="admin-table-td">
                                            <div className="admin-user-cell">
                                                <div
                                                    className={`admin-user-avatar ${
                                                        user.is_admin
                                                            ? "admin-avatar"
                                                            : ""
                                                    }`}
                                                >
                                                    {initial}
                                                </div>
                                                <div className="admin-user-info">
                                                    <span className="admin-user-email">
                                                        {user.email}
                                                    </span>
                                                </div>
                                            </div>
                                        </td>

                                        {/* Role Badge */}
                                        <td className="admin-table-td">
                                            {user.is_admin ? (
                                                <span className="admin-role-badge admin">
                                                    <Shield size={12} />
                                                    Admin
                                                </span>
                                            ) : (
                                                <span className="admin-role-badge standard">
                                                    <User size={12} />
                                                    User
                                                </span>
                                            )}
                                        </td>

                                        {/* Last Active */}
                                        <td className="admin-table-td">
                                            <span
                                                className={`admin-last-active ${
                                                    user.last_active_at
                                                        ? "active"
                                                        : "never"
                                                }`}
                                            >
                                                {user.last_active_at
                                                    ? formatDateAdded(
                                                          user.last_active_at,
                                                      )
                                                    : "Never"}
                                            </span>
                                        </td>

                                        {/* Created At */}
                                        <td className="admin-table-td">
                                            <span className="admin-created-date">
                                                <Calendar size={12} />
                                                {formatDateAdded(
                                                    user.created_at,
                                                )}
                                            </span>
                                        </td>

                                        {/* Actions */}
                                        <td className="admin-table-td right">
                                            <button
                                                type="button"
                                                onClick={() =>
                                                    setResetUser(user)
                                                }
                                                className="admin-row-action-btn"
                                                title={`Reset password for ${user.email}`}
                                            >
                                                <KeyRound size={13} />
                                                <span>Reset Password</span>
                                            </button>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            )}

            {/* Modals */}
            <AdminAddUserModal
                isOpen={isAddModalOpen}
                onClose={() => setIsAddModalOpen(false)}
                onUserCreated={() => fetchUsers(true)}
            />

            <AdminResetPasswordModal
                user={resetUser}
                isOpen={!!resetUser}
                onClose={() => setResetUser(null)}
                onPasswordReset={() => fetchUsers(true)}
            />
        </div>
    );
};
