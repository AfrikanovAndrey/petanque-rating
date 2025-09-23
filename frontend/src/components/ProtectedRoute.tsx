import React, { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { authApi } from "../services/api";
import { isAuthenticated } from "../utils";

interface ProtectedRouteProps {
  children: React.ReactNode;
}

const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children }) => {
  const [isLoading, setIsLoading] = useState(true);
  const [isValid, setIsValid] = useState(false);

  useEffect(() => {
    const verifyAuth = async () => {
      // Проверяем наличие токена
      if (!isAuthenticated()) {
        setIsLoading(false);
        return;
      }

      try {
        // Проверяем валидность токена
        await authApi.verifyToken();
        setIsValid(true);
      } catch (error) {
        // Токен недействителен, удаляем его
        localStorage.removeItem("admin_token");
        setIsValid(false);
      } finally {
        setIsLoading(false);
      }
    };

    verifyAuth();
  }, []);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="loading-spinner mb-4"></div>
          <p className="text-gray-600">Проверка авторизации...</p>
        </div>
      </div>
    );
  }

  if (!isValid) {
    return <Navigate to="/admin/login" replace />;
  }

  return <>{children}</>;
};

export default ProtectedRoute;
