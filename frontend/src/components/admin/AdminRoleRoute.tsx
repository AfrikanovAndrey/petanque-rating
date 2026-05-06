import React, { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { adminApi } from "../../services/api";
import { UserRole } from "../../types";
import { getAdminHomePath, getUserRoles } from "../../utils";

interface AdminRoleRouteProps {
  children: React.ReactNode;
  allowedRoles: UserRole[];
}

/**
 * Ограничение разделов админки по роли (после успешной JWT-авторизации).
 */
const AdminRoleRoute: React.FC<AdminRoleRouteProps> = ({
  children,
  allowedRoles,
}) => {
  const [ready, setReady] = useState(false);
  const [allowed, setAllowed] = useState(false);
  const [redirectPath, setRedirectPath] = useState("/admin/login");

  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      try {
        const response = await adminApi.getCurrentUser();
        const user = response.data.success ? response.data.data : null;
        const roles = getUserRoles(user);
        if (!cancelled) {
          if (allowedRoles.some((role) => roles.includes(role))) {
            setAllowed(true);
          } else if (roles.length > 0) {
            setRedirectPath(getAdminHomePath(roles));
            setAllowed(false);
          } else {
            setAllowed(false);
            setRedirectPath("/admin/login");
          }
        }
      } catch {
        if (!cancelled) {
          setAllowed(false);
          setRedirectPath("/admin/login");
        }
      } finally {
        if (!cancelled) {
          setReady(true);
        }
      }
    };

    run();
    return () => {
      cancelled = true;
    };
  }, [allowedRoles]);

  if (!ready) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="loading-spinner mb-4 mx-auto" />
          <p className="text-gray-600">Проверка прав доступа...</p>
        </div>
      </div>
    );
  }

  if (!allowed) {
    return <Navigate to={redirectPath} replace />;
  }

  return <>{children}</>;
};

export default AdminRoleRoute;
