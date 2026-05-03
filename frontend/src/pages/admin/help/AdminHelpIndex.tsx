import React from "react";
import { Link } from "react-router-dom";
import { ChevronRightIcon } from "@heroicons/react/24/outline";
import { HELP_ARTICLES } from "./helpArticles";

const AdminHelpIndex: React.FC = () => {
  return (
    <div>
      <h2 className="text-lg font-semibold text-gray-900 mb-2">Содержание</h2>
      <p className="text-sm text-gray-600 mb-6">
        Выберите статью в меню слева или в списке ниже.
      </p>
      <ul className="space-y-2">
        {HELP_ARTICLES.map((article) => (
          <li key={article.slug}>
            <Link
              to={`/admin/help/${article.slug}`}
              className="group flex items-start gap-3 rounded-xl border border-gray-200 bg-white p-4 shadow-sm transition-colors hover:border-primary-200 hover:bg-primary-50/40"
            >
              <ChevronRightIcon className="h-5 w-5 shrink-0 text-gray-400 mt-0.5 group-hover:text-primary-600" />
              <div>
                <span className="font-medium text-gray-900 group-hover:text-primary-800">
                  {article.title}
                </span>
                <p className="text-sm text-gray-600 mt-1">{article.description}</p>
              </div>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
};

export default AdminHelpIndex;
