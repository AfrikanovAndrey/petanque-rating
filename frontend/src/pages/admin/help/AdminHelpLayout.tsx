import React from "react";
import { NavLink, Outlet } from "react-router-dom";
import { BookOpenIcon } from "@heroicons/react/24/outline";
import { HELP_ARTICLES } from "./helpArticles";

const AdminHelpLayout: React.FC = () => {
  return (
    <div className="max-w-5xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <div className="p-2 rounded-lg bg-primary-100 text-primary-700">
          <BookOpenIcon className="h-8 w-8" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Справка</h1>
          <p className="text-sm text-gray-600">
            Документация по работе с админ-панелью
          </p>
        </div>
      </div>

      <div className="flex flex-col lg:flex-row gap-6 lg:gap-8">
        <nav
          className="shrink-0 lg:w-56"
          aria-label="Разделы справки"
        >
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2 px-1">
            Статьи
          </p>
          <ul className="space-y-1 border border-gray-200 rounded-lg bg-white p-2 shadow-sm">
            <li>
              <NavLink
                to="/admin/help"
                end
                className={({ isActive }) =>
                  `block rounded-md px-3 py-2 text-sm font-medium transition-colors ${
                    isActive
                      ? "bg-primary-100 text-primary-800 border border-primary-200"
                      : "text-gray-700 hover:bg-gray-50"
                  }`
                }
              >
                Содержание
              </NavLink>
            </li>
            {HELP_ARTICLES.map((article) => (
              <li key={article.slug}>
                <NavLink
                  to={`/admin/help/${article.slug}`}
                  className={({ isActive }) =>
                    `block rounded-md px-3 py-2 text-sm font-medium transition-colors ${
                      isActive
                        ? "bg-primary-100 text-primary-800 border border-primary-200"
                        : "text-gray-700 hover:bg-gray-50"
                    }`
                  }
                >
                  {article.title}
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>

        <div className="flex-1 min-w-0">
          <Outlet />
        </div>
      </div>
    </div>
  );
};

export default AdminHelpLayout;
