import React, { useState, useEffect } from "react";
import { Link, useLocation } from "react-router-dom";
import {
  HomeIcon,
  TrophyIcon,
  UsersIcon,
  CogIcon,
  ArrowLeftOnRectangleIcon,
  Bars3Icon,
  XMarkIcon,
  IdentificationIcon,
  UserGroupIcon,
  DocumentTextIcon,
} from "@heroicons/react/24/outline";
import { logout } from "../../utils";
import { adminApi } from "../../services/api";
import { User, UserRole } from "../../types";

interface AdminLayoutProps {
  children: React.ReactNode;
}

const AdminLayout: React.FC<AdminLayoutProps> = ({ children }) => {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const location = useLocation();

  useEffect(() => {
    loadCurrentUser();
  }, []);

  const loadCurrentUser = async () => {
    try {
      // Сначала пробуем загрузить из localStorage
      const cachedUser = localStorage.getItem("current_user");
      if (cachedUser) {
        try {
          const user = JSON.parse(cachedUser);
          setCurrentUser(user);
          console.log("Загружен пользователь из cache:", user);
        } catch (e) {
          console.error("Ошибка парсинга cached user:", e);
        }
      }

      // Затем загружаем свежие данные с сервера
      const response = await adminApi.getCurrentUser();
      if (response.data.success && response.data.data) {
        setCurrentUser(response.data.data);
        localStorage.setItem(
          "current_user",
          JSON.stringify(response.data.data)
        );
        console.log("Загружен пользователь с сервера:", response.data.data);
      }
    } catch (error) {
      console.error("Ошибка загрузки текущего пользователя:", error);
      // Если старый токен, очищаем и перенаправляем на логин
      if ((error as any).response?.status === 401) {
        localStorage.removeItem("admin_token");
        localStorage.removeItem("current_user");
        window.location.href = "/admin/login";
      }
    }
  };

  const isAdmin = currentUser?.role === UserRole.ADMIN;

  // Debug информация
  useEffect(() => {
    if (currentUser) {
      console.log("Текущий пользователь:", currentUser);
      console.log("Роль:", currentUser.role);
      console.log("isAdmin:", isAdmin);
    }
  }, [currentUser, isAdmin]);

  const navigation = [
    {
      name: "Панель управления",
      href: "/admin/dashboard",
      icon: HomeIcon,
      adminOnly: true, // Только для ADMIN
    },
    {
      name: "Турниры",
      href: "/admin/tournaments",
      icon: TrophyIcon,
    },
    {
      name: "Игроки",
      href: "/admin/players",
      icon: UsersIcon,
    },
    {
      name: "Лицензии",
      href: "/admin/licensed-players",
      icon: IdentificationIcon,
    },
    {
      name: "Пользователи",
      href: "/admin/users",
      icon: UserGroupIcon,
      adminOnly: true, // Только для ADMIN
    },
    {
      name: "Логи аудита",
      href: "/admin/audit-logs",
      icon: DocumentTextIcon,
      adminOnly: true, // Только для ADMIN
    },
    {
      name: "Настройки",
      href: "/admin/settings",
      icon: CogIcon,
      adminOnly: true, // Только для ADMIN
    },
  ].filter((item) => !item.adminOnly || isAdmin); // Фильтруем пункты меню

  const isCurrentPage = (href: string) => {
    return (
      location.pathname === href ||
      (href === "/admin/dashboard" && location.pathname === "/admin")
    );
  };

  const handleLogout = () => {
    if (window.confirm("Вы уверены, что хотите выйти?")) {
      logout();
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Mobile sidebar backdrop */}
      {isSidebarOpen && (
        <div
          className="fixed inset-0 z-20 bg-gray-600 bg-opacity-50 lg:hidden"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      <div className="lg:flex">
        {/* Sidebar */}
        <div
          className={`fixed inset-y-0 left-0 z-30 w-64 bg-white shadow-lg transform transition-transform duration-300 ease-in-out lg:translate-x-0 lg:static lg:inset-0 ${
            isSidebarOpen ? "translate-x-0" : "-translate-x-full"
          }`}
        >
          <div className="flex items-center justify-between h-16 px-6 border-b border-gray-200">
            <Link to="/" className="flex items-center space-x-2">
              <div className="w-8 h-8 bg-primary-600 rounded-lg flex items-center justify-center">
                <span className="text-white font-bold">P</span>
              </div>
              <span className="text-lg font-semibold text-gray-900">
                Админ панель
              </span>
            </Link>
            <button
              className="lg:hidden p-1 rounded-md text-gray-400 hover:text-gray-600"
              onClick={() => setIsSidebarOpen(false)}
            >
              <XMarkIcon className="h-6 w-6" />
            </button>
          </div>

          {/* Информация о пользователе */}
          {currentUser && (
            <div className="px-6 py-3 border-b border-gray-200 bg-gray-50">
              <p className="text-xs text-gray-500">Пользователь</p>
              <p className="text-sm font-medium text-gray-900">
                {currentUser.name}
              </p>
              <p className="text-xs text-gray-500">
                {currentUser.role === UserRole.ADMIN
                  ? "Администратор"
                  : "Организатор"}
              </p>
            </div>
          )}

          <nav className="mt-4 px-3">
            <div className="space-y-1">
              {navigation.map((item) => {
                const Icon = item.icon;
                const current = isCurrentPage(item.href);

                return (
                  <Link
                    key={item.name}
                    to={item.href}
                    className={`flex items-center px-3 py-2 text-sm font-medium rounded-lg transition-colors duration-200 ${
                      current
                        ? "bg-primary-100 text-primary-700 border border-primary-200"
                        : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
                    }`}
                    onClick={() => setIsSidebarOpen(false)}
                  >
                    <Icon className="mr-3 h-5 w-5" />
                    {item.name}
                  </Link>
                );
              })}
            </div>

            <div className="mt-8 pt-6 border-t border-gray-200">
              <Link
                to="/"
                className="flex items-center px-3 py-2 text-sm font-medium text-gray-600 rounded-lg hover:bg-gray-50 hover:text-gray-900 transition-colors duration-200"
              >
                <HomeIcon className="mr-3 h-5 w-5" />К рейтингу
              </Link>
              <button
                onClick={handleLogout}
                className="w-full flex items-center px-3 py-2 text-sm font-medium text-gray-600 rounded-lg hover:bg-gray-50 hover:text-gray-900 transition-colors duration-200"
              >
                <ArrowLeftOnRectangleIcon className="mr-3 h-5 w-5" />
                Выйти
              </button>
            </div>
          </nav>
        </div>

        {/* Main content */}
        <div className="flex-1">
          {/* Top bar - показываем только на мобильных */}
          <div className="sticky top-0 z-10 bg-white shadow-sm border-b border-gray-200 lg:hidden">
            <div className="flex items-center justify-between h-16 px-4 sm:px-6">
              <button
                className="p-2 rounded-md text-gray-400 hover:text-gray-600 hover:bg-gray-100"
                onClick={() => setIsSidebarOpen(true)}
              >
                <Bars3Icon className="h-6 w-6" />
              </button>

              <div className="flex items-center">
                <h1 className="text-lg font-semibold text-gray-900">
                  Админ панель
                </h1>
              </div>

              <button
                onClick={handleLogout}
                className="text-gray-500 hover:text-gray-700 p-2 rounded-md hover:bg-gray-100"
                title="Выйти"
              >
                <ArrowLeftOnRectangleIcon className="h-5 w-5" />
              </button>
            </div>
          </div>

          {/* Page content */}
          <main className="p-4 sm:p-4 lg:pt-20 lg:px-6 lg:pb-6">
            {children}
          </main>
        </div>
      </div>
    </div>
  );
};

export default AdminLayout;
