import React from "react";
import { Link } from "react-router-dom";
import PublicNavigation from "./PublicNavigation";

interface LayoutProps {
  children: React.ReactNode;
}

const Layout: React.FC<LayoutProps> = ({ children }) => {
  return (
    <div className="min-h-screen bg-gray-50">
      {/* Navigation */}
      <PublicNavigation />

      {/* Admin Link */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mb-4">
        <div className="flex justify-end">
          <Link
            to="/admin"
            className="text-sm text-gray-600 hover:text-primary-600 font-medium transition-colors duration-200"
          >
            Админ панель →
          </Link>
        </div>
      </div>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-8">
        {children}
      </main>

      {/* Footer */}
      <footer className="bg-white border-t border-gray-200 mt-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="text-center text-gray-500">
            <p className="text-sm">
              © {new Date().getFullYear()} Система рейтинга игроков в петанк.
            </p>
            <p className="text-xs mt-2">
              Разработано для автоматического подсчета рейтинга игроков.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default Layout;
