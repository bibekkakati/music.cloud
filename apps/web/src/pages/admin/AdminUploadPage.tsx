import React from "react";
import { AdminUploadPanel } from "../../components/admin/AdminUploadPanel";

export const AdminUploadPage: React.FC = () => {
    return (
        <div className="admin-page-container">
            <AdminUploadPanel
                onUploadSuccess={() => {
                    // Stay on upload page or allow user to inspect catalog
                }}
            />
        </div>
    );
};
