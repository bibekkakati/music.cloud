import React from "react";
import { Navigate } from "react-router-dom";

export const AdminPage: React.FC = () => {
    return <Navigate to="/admin/catalog" replace />;
};

export default AdminPage;
