import React, { useState } from "react";
import { createPortal } from "react-dom";
import { Link, useLocation } from "react-router-dom";
import {
  TrophyIcon,
  ChartBarIcon,
  DocumentTextIcon,
  IdentificationIcon,
  ArrowRightOnRectangleIcon,
  Bars3Icon,
  XMarkIcon,
  BuildingLibraryIcon,
  ChatBubbleLeftRightIcon,
  ChevronDownIcon,
} from "@heroicons/react/24/outline";
import { cn } from "../utils";

type NavIcon = React.ComponentType<React.SVGProps<SVGSVGElement>>;

type NavChild = {
  name: string;
  href: string;
  icon: NavIcon;
  current: boolean;
};

type NavItem = {
  name: string;
  href: string;
  icon: NavIcon;
  current: boolean;
  external?: boolean;
  children?: NavChild[];
};

const PublicNavigation: React.FC = () => {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const location = useLocation();

  const isRatingHome =
    location.pathname === "/" || location.pathname === "/rating";
  const isRatingSection =
    isRatingHome ||
    location.pathname === "/rating-rules" ||
    location.pathname === "/licenses";

  const [ratingExpanded, setRatingExpanded] = useState(isRatingSection);

  const navigationItems: NavItem[] = [
    {
      name: "Рейтинг",
      href: "/",
      icon: ChartBarIcon,
      current: isRatingSection,
      children: [
        {
          name: "Рейтинг игроков",
          href: "/",
          icon: ChartBarIcon,
          current: isRatingHome,
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
      ],
    },
    {
      name: "Турниры",
      href: "/tournaments",
      icon: TrophyIcon,
      current: location.pathname.startsWith("/tournaments"),
    },
    {
      name: "Клубы",
      href: "/clubs",
      icon: BuildingLibraryIcon,
      current: location.pathname.startsWith("/clubs"),
    },
    {
      name: "Форум",
      href: "https://petanque.ru",
      icon: ChatBubbleLeftRightIcon,
      current: false,
      external: true,
    },
    {
      name: "Войти",
      href: "/admin",
      icon: ArrowRightOnRectangleIcon,
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

  const mobileItemClass = (current: boolean) =>
    cn(
      "flex items-center px-3 py-2 text-sm font-medium rounded-lg transition-colors duration-200",
      current
        ? "bg-primary-100 text-black border border-primary-200"
        : "text-black hover:bg-gray-50"
    );

  const desktopItemClass = (current: boolean) =>
    cn(
      "inline-flex items-center gap-1.5 px-2 py-1.5 border-b-2 text-sm xl:text-base font-medium text-black whitespace-nowrap transition-colors duration-200",
      current ? "border-white" : "border-transparent hover:border-white/60"
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
              if (item.children) {
                return (
                  <div key={item.name}>
                    <div className="flex items-center gap-1">
                      <Link
                        to={item.href}
                        className={cn(mobileItemClass(item.current), "flex-1")}
                        onClick={closeSidebar}
                        tabIndex={isSidebarOpen ? undefined : -1}
                      >
                        <Icon className="mr-3 h-5 w-5 shrink-0" />
                        {item.name}
                      </Link>
                      <button
                        type="button"
                        className="p-2 rounded-lg text-black hover:bg-gray-50"
                        aria-label={
                          ratingExpanded
                            ? "Свернуть раздел Рейтинг"
                            : "Развернуть раздел Рейтинг"
                        }
                        aria-expanded={ratingExpanded}
                        onClick={() => setRatingExpanded((open) => !open)}
                        tabIndex={isSidebarOpen ? undefined : -1}
                      >
                        <ChevronDownIcon
                          className={cn(
                            "h-5 w-5 transition-transform",
                            ratingExpanded && "rotate-180"
                          )}
                        />
                      </button>
                    </div>
                    {ratingExpanded && (
                      <div className="mt-1 ml-4 space-y-1">
                        {item.children.map((child) => {
                          const ChildIcon = child.icon;
                          return (
                            <Link
                              key={child.name}
                              to={child.href}
                              className={mobileItemClass(child.current)}
                              onClick={closeSidebar}
                              tabIndex={isSidebarOpen ? undefined : -1}
                            >
                              <ChildIcon className="mr-3 h-5 w-5 shrink-0" />
                              {child.name}
                            </Link>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              }

              const className = mobileItemClass(item.current);
              const content = (
                <>
                  <Icon className="mr-3 h-5 w-5 shrink-0" />
                  {item.name}
                </>
              );
              if (item.external) {
                return (
                  <a
                    key={item.name}
                    href={item.href}
                    className={className}
                    onClick={closeSidebar}
                    tabIndex={isSidebarOpen ? undefined : -1}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    {content}
                  </a>
                );
              }
              return (
                <Link
                  key={item.name}
                  to={item.href}
                  className={className}
                  onClick={closeSidebar}
                  tabIndex={isSidebarOpen ? undefined : -1}
                >
                  {content}
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
                if (item.children) {
                  return (
                    <div key={item.name} className="relative group">
                      <Link
                        to={item.href}
                        title={item.name}
                        className={desktopItemClass(item.current)}
                      >
                        <Icon className="h-5 w-5 shrink-0" />
                        {item.name}
                        <ChevronDownIcon className="h-4 w-4 shrink-0" />
                      </Link>
                      <div className="absolute top-full left-0 pt-1 hidden group-hover:block group-focus-within:block z-50">
                        <div
                          className="min-w-[240px] rounded-lg bg-white py-1 shadow-lg ring-1 ring-black/5"
                          role="menu"
                        >
                          {item.children.map((child) => {
                            const ChildIcon = child.icon;
                            return (
                              <Link
                                key={child.name}
                                to={child.href}
                                role="menuitem"
                                className={cn(
                                  "flex items-center gap-2 px-3 py-2 text-sm font-medium text-black whitespace-nowrap transition-colors",
                                  child.current
                                    ? "bg-primary-100"
                                    : "hover:bg-gray-50"
                                )}
                              >
                                <ChildIcon className="h-5 w-5 shrink-0" />
                                {child.name}
                              </Link>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  );
                }

                const className = desktopItemClass(item.current);
                const content = (
                  <>
                    <Icon className="h-5 w-5 shrink-0" />
                    {item.name}
                  </>
                );
                if (item.external) {
                  return (
                    <a
                      key={item.name}
                      href={item.href}
                      title={item.name}
                      className={className}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      {content}
                    </a>
                  );
                }
                return (
                  <Link
                    key={item.name}
                    to={item.href}
                    title={item.name}
                    className={className}
                  >
                    {content}
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
