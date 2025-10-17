import React from "react";
import { Link, useLocation } from "react-router-dom";
import { TrophyIcon, ChartBarIcon } from "@heroicons/react/24/outline";
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
      current: location.pathname === "/tournaments",
    },
  ];

  return (
    <nav className="bg-white shadow mb-4 sm:mb-8">
      <div className="max-w-7xl mx-auto px-2 sm:px-4 lg:px-8">
        <div className="flex justify-between items-center h-24 sm:h-36 md:h-48">
          <div className="flex items-center min-w-0 flex-1">
            {/* Логотип */}
            <div className="flex-shrink-0 flex items-center space-x-2 sm:space-x-3">
              <img
                src="/logo.png"
                alt="Логотип Российской федерации петанка"
                className="h-16 w-16 sm:h-24 sm:w-24 md:h-32 md:w-32"
              />
              <h1 className="text-xs sm:text-sm md:text-lg font-bold text-primary-600 leading-tight">
                Российская федерация петанка
                <br />
                <span className="block">Рейтинг игроков</span>
              </h1>
            </div>
          </div>

          {/* Навигационное меню для десктопа */}
          <div className="hidden sm:ml-6 sm:flex sm:space-x-4 md:space-x-8">
            {navigationItems.map((item) => {
              const Icon = item.icon;
              return (
                <Link
                  key={item.name}
                  to={item.href}
                  className={cn(
                    "inline-flex items-center px-1 pt-1 border-b-2 text-xs md:text-sm font-medium transition-colors duration-200",
                    item.current
                      ? "border-primary-500 text-gray-900"
                      : "border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700"
                  )}
                >
                  <Icon className="h-4 w-4 md:h-5 md:w-5 mr-1 md:mr-2" />
                  {item.name}
                </Link>
              );
            })}
          </div>

          {/* Мобильное меню (иконки) */}
          <div className="sm:hidden flex items-center space-x-1 flex-shrink-0">
            {navigationItems.map((item) => {
              const Icon = item.icon;
              return (
                <Link
                  key={item.name}
                  to={item.href}
                  className={cn(
                    "inline-flex items-center px-2 py-2 rounded-md text-sm font-medium transition-colors duration-200",
                    item.current
                      ? "bg-primary-100 text-primary-700"
                      : "text-gray-500 hover:bg-gray-100 hover:text-gray-700"
                  )}
                >
                  <Icon className="h-5 w-5" />
                  <span className="sr-only">{item.name}</span>
                </Link>
              );
            })}
          </div>
        </div>
      </div>

      {/* Мобильное меню (текстовые ссылки) */}
      <div className="sm:hidden border-t border-gray-200">
        <div className="pt-2 pb-3 space-y-1">
          {navigationItems.map((item) => {
            const Icon = item.icon;
            return (
              <Link
                key={item.name}
                to={item.href}
                className={cn(
                  "flex items-center pl-3 pr-4 py-2 text-sm font-medium transition-colors duration-200",
                  item.current
                    ? "bg-primary-50 border-r-4 border-primary-500 text-primary-700"
                    : "text-gray-600 hover:bg-gray-50 hover:text-gray-800"
                )}
              >
                <Icon className="h-5 w-5 mr-3" />
                {item.name}
              </Link>
            );
          })}
        </div>
      </div>
    </nav>
  );
};

export default PublicNavigation;
