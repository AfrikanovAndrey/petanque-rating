import React, { useState } from "react";
import { createPortal } from "react-dom";
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

  const brandBlock = (
    <Link
      to="/"
      className="flex items-center gap-3 sm:gap-4 min-w-0"
      onClick={closeSidebar}
    >
      <img
        src="/rfp_logo.png"
        alt="Логотип Российской федерации петанка"
        className="h-16 w-16 sm:h-20 sm:w-20 lg:h-20 lg:w-20 shrink-0 object-contain"
      />
      <h1 className="text-lg sm:text-xl lg:text-xl xl:text-2xl font-bold text-white leading-tight text-center">
        <span className="block">Российская федерация</span>
        <span className="block">петанка</span>
      </h1>
    </Link>
  );

  const mobileMenu = (
    <div className="lg:hidden">
      {isSidebarOpen && (
        <div
          className="fixed inset-0 z-[100] bg-gray-600/50"
          onClick={closeSidebar}
          aria-hidden="true"
        />
      )}

      <div
        className={cn(
          "fixed inset-y-0 left-0 z-[110] w-80 max-w-[85vw] bg-white shadow-xl transition-transform duration-300 ease-in-out",
          isSidebarOpen ? "translate-x-0" : "-translate-x-full pointer-events-none"
        )}
        aria-hidden={!isSidebarOpen}
      >
        <div className="flex items-center justify-end min-h-[4.5rem] py-3 px-5 border-b border-gray-200">
          <button
            type="button"
            className="p-1 rounded-md text-gray-400 hover:text-gray-600 shrink-0"
            onClick={closeSidebar}
            aria-label="Закрыть меню"
          >
            <XMarkIcon className="h-6 w-6" />
          </button>
        </div>

        <nav className="mt-4 px-3 font-yanone">
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
                      ? "bg-primary-100 text-black border border-primary-200"
                      : "text-black hover:bg-gray-50"
                  )}
                  onClick={closeSidebar}
                  tabIndex={isSidebarOpen ? undefined : -1}
                >
                  <Icon className="mr-3 h-5 w-5 shrink-0" />
                  {item.name}
                </Link>
              );
            })}
          </div>
        </nav>
      </div>
    </div>
  );

  return (
    <>
      {createPortal(mobileMenu, document.body)}

      <header className="sticky top-0 z-40 mb-4 sm:mb-6 w-full font-yanone shadow-md">
          {/* Mobile */}
          <div className="w-full bg-[#6789DC] lg:hidden">
            <div className="flex items-center justify-between gap-2 px-4 sm:px-8 py-3">
              <button
                type="button"
                className="p-2 rounded-md text-white hover:bg-white/10 shrink-0"
                onClick={() => setIsSidebarOpen(true)}
                aria-label="Открыть меню"
              >
                <Bars3Icon className="h-6 w-6" />
              </button>
              <div className="flex-1 flex justify-center min-w-0">{brandBlock}</div>
              <div className="w-10 shrink-0" aria-hidden="true" />
            </div>
          </div>

          {/* Desktop */}
          <div className="hidden lg:flex w-full bg-[#6789DC] items-center justify-between gap-6 px-4 sm:px-8 lg:px-[150px] py-4">
            {brandBlock}

            <nav
              className="flex items-center flex-wrap justify-end gap-x-3 xl:gap-x-5 gap-y-2 shrink-0"
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
                      "inline-flex items-center gap-1.5 px-2 py-1.5 border-b-2 text-sm xl:text-base font-medium text-black whitespace-nowrap transition-colors duration-200",
                      item.current
                        ? "border-white"
                        : "border-transparent hover:border-white/60"
                    )}
                  >
                    <Icon className="h-5 w-5 shrink-0" />
                    {item.name}
                  </Link>
                );
              })}
            </nav>
          </div>
      </header>
    </>
  );
};

export default PublicNavigation;
