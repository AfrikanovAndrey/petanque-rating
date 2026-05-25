import React, { useState } from "react";
import { Link, useLocation } from "react-router-dom";
import {
  TrophyIcon,
  ChartBarIcon,
  DocumentTextIcon,
  IdentificationIcon,
  Cog6ToothIcon,
  Bars3Icon,
  XMarkIcon,
} from "@heroicons/react/24/outline";
import { cn } from "../utils";

const PublicNavigation: React.FC = () => {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const location = useLocation();

  const navigationItems = [
    {
      name: "Рейтинг игроков",
      href: "/",
      icon: ChartBarIcon,
      current: location.pathname === "/" || location.pathname === "/rating",
    },
    {
      name: "Турниры",
      href: "/tournaments",
      icon: TrophyIcon,
      current: location.pathname.startsWith("/tournaments"),
    },
    {
      name: "Правила расчёта рейтинга",
      href: "/rating-rules",
      icon: DocumentTextIcon,
      current: location.pathname === "/rating-rules",
    },
    {
      name: "Лицензии",
      href: "/licenses",
      icon: IdentificationIcon,
      current: location.pathname === "/licenses",
    },
    {
      name: "Админ панель",
      href: "/admin",
      icon: Cog6ToothIcon,
      current: location.pathname.startsWith("/admin"),
    },
  ];

  const closeSidebar = () => setIsSidebarOpen(false);

  return (
    <>
      {/* Mobile sidebar backdrop */}
      {isSidebarOpen && (
        <div
          className="fixed inset-0 z-20 bg-gray-600 bg-opacity-50 lg:hidden"
          onClick={closeSidebar}
        />
      )}

      {/* Mobile sidebar */}
      <div
        className={cn(
          "fixed inset-y-0 left-0 z-30 w-80 max-w-[85vw] bg-white shadow-lg transform transition-transform duration-300 ease-in-out lg:hidden",
          isSidebarOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        <div className="flex items-center justify-end min-h-[4.5rem] py-3 px-5 border-b border-gray-200 gap-2">
          <button
            type="button"
            className="p-1 rounded-md text-gray-400 hover:text-gray-600 shrink-0"
            onClick={closeSidebar}
          >
            <XMarkIcon className="h-6 w-6" />
          </button>
        </div>

        <nav className="mt-4 px-3">
          <div className="space-y-1">
            {navigationItems.map((item) => {
              const Icon = item.icon;
              return (
                <Link
                  key={item.name}
                  to={item.href}
                  className={cn(
                    "flex items-center px-3 py-2 text-sm font-medium rounded-lg transition-colors duration-200",
                    item.current
                      ? "bg-primary-100 text-primary-700 border border-primary-200"
                      : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
                  )}
                  onClick={closeSidebar}
                >
                  <Icon className="mr-3 h-5 w-5 shrink-0" />
                  {item.name}
                </Link>
              );
            })}
          </div>
        </nav>
      </div>

      <nav className="bg-white shadow mb-4 sm:mb-8">
        {/* Mobile top bar */}
        <div className="sticky top-0 z-10 border-b border-gray-200 lg:hidden">
          <div className="flex items-center justify-between min-h-[4.5rem] py-2 px-4 sm:px-6">
            <button
              type="button"
              className="p-2 rounded-md text-gray-400 hover:text-gray-600 hover:bg-gray-100 shrink-0"
              onClick={() => setIsSidebarOpen(true)}
            >
              <Bars3Icon className="h-6 w-6" />
            </button>

            <Link
              to="/"
              className="flex items-center gap-3 min-w-0 mx-2"
              onClick={closeSidebar}
            >
              <img
                src="/logo.png"
                alt="Логотип Российской федерации петанка"
                className="h-20 w-20 shrink-0"
              />
              <h1 className="text-sm sm:text-base font-semibold text-primary-600 leading-tight text-center">
                Российская федерация
                <br />
                петанка
              </h1>
            </Link>

            <div className="w-10 shrink-0" aria-hidden="true" />
          </div>
        </div>

        {/* Desktop header */}
        <div className="hidden lg:block max-w-7xl mx-auto px-4 lg:px-8">
          <div className="flex items-center gap-4 py-4 min-w-0">
            <div className="flex items-center gap-3 min-w-0 max-w-[45%]">
              <img
                src="/logo.png"
                alt="Логотип Российской федерации петанка"
                className="h-24 w-24 xl:h-28 xl:w-28 shrink-0"
              />
              <h1 className="text-sm xl:text-base font-bold text-primary-600 truncate min-w-0">
                Российская федерация петанка
              </h1>
            </div>

            <div
              className="ml-auto flex flex-1 min-w-0 items-center flex-nowrap justify-end gap-1 xl:gap-2 overflow-x-auto [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
              aria-label="Основная навигация"
            >
              {navigationItems.map((item) => {
                const Icon = item.icon;
                return (
                  <Link
                    key={item.name}
                    to={item.href}
                    title={item.name}
                    className={cn(
                      "inline-flex items-center shrink-0 px-2 py-1.5 border-b-2 text-xs xl:text-sm font-medium transition-colors duration-200 whitespace-nowrap",
                      item.current
                        ? "border-primary-500 text-gray-900"
                        : "border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700"
                    )}
                  >
                    <Icon className="h-5 w-5 mr-1 shrink-0" />
                    {item.name}
                  </Link>
                );
              })}
            </div>
          </div>
        </div>
      </nav>
    </>
  );
};

export default PublicNavigation;
