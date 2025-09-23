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
    <nav className="bg-white shadow mb-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16">
          <div className="flex">
            <div className="flex space-x-8">
              {/* Логотип */}
              <div className="flex-shrink-0 flex items-center">
                <h1 className="text-xl font-bold text-primary-600">
                  Петанк Рейтинг
                </h1>
              </div>
            </div>
          </div>

          {/* Навигационное меню */}
          <div className="hidden sm:ml-6 sm:flex sm:space-x-8">
            {navigationItems.map((item) => {
              const Icon = item.icon;
              return (
                <Link
                  key={item.name}
                  to={item.href}
                  className={cn(
                    "inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium transition-colors duration-200",
                    item.current
                      ? "border-primary-500 text-gray-900"
                      : "border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700"
                  )}
                >
                  <Icon className="h-5 w-5 mr-2" />
                  {item.name}
                </Link>
              );
            })}
          </div>

          {/* Мобильное меню */}
          <div className="sm:hidden flex items-center space-x-2">
            {navigationItems.map((item) => {
              const Icon = item.icon;
              return (
                <Link
                  key={item.name}
                  to={item.href}
                  className={cn(
                    "inline-flex items-center px-3 py-2 rounded-md text-sm font-medium transition-colors duration-200",
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

      {/* Мобильное меню (выпадающее) */}
      <div className="sm:hidden">
        <div className="pt-2 pb-3 space-y-1 border-t border-gray-200">
          {navigationItems.map((item) => {
            const Icon = item.icon;
            return (
              <Link
                key={item.name}
                to={item.href}
                className={cn(
                  "flex items-center pl-3 pr-4 py-2 text-base font-medium transition-colors duration-200",
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
