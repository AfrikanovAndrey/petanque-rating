import React from "react";
import { Link, useLocation } from "react-router-dom";
import {
  TrophyIcon,
  ChartBarIcon,
  DocumentTextIcon,
  IdentificationIcon,
  Cog6ToothIcon,
} from "@heroicons/react/24/outline";
import { cn } from "../utils";

const PublicNavigation: React.FC = () => {
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

  return (
    <nav className="bg-white shadow mb-4 sm:mb-8">
      <div className="max-w-7xl mx-auto px-2 sm:px-4 lg:px-8">
        <div className="flex items-center gap-2 sm:gap-4 py-3 sm:py-4 min-w-0">
          {/* Логотип и название */}
          <div className="flex items-center gap-2 sm:gap-3 shrink-0">
            <img
              src="/logo.png"
              alt="Логотип Российской федерации петанка"
              className="h-16 w-16 sm:h-20 sm:w-20 md:h-24 md:w-24 lg:h-28 lg:w-28 shrink-0"
            />
            <h1 className="text-xs sm:text-sm lg:text-base font-bold text-primary-600 whitespace-nowrap">
              Российская федерация петанка
            </h1>
          </div>

          {/* Навигация — одна строка с прокруткой при нехватке места */}
          <div
            className="ml-auto flex flex-1 min-w-0 items-center flex-nowrap justify-end gap-0.5 sm:gap-1 lg:gap-2 overflow-x-auto [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
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
                    "inline-flex items-center shrink-0 px-1.5 sm:px-2 py-1.5 border-b-2 text-[10px] sm:text-xs lg:text-sm font-medium transition-colors duration-200 whitespace-nowrap",
                    item.current
                      ? "border-primary-500 text-gray-900"
                      : "border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700"
                  )}
                >
                  <Icon className="h-4 w-4 lg:h-5 lg:w-5 mr-1 shrink-0" />
                  {item.name}
                </Link>
              );
            })}
          </div>
        </div>
      </div>
    </nav>
  );
};

export default PublicNavigation;
