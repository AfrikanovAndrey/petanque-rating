import React from "react";
import { Link } from "react-router-dom";
import { PERSONAL_DATA_POLICY_PATH } from "../constants/personalData";
import { resetCookieConsentChoice } from "../utils/cookieConsent";
import PublicNavigation from "./PublicNavigation";

interface LayoutProps {
  children: React.ReactNode;
}

const Layout: React.FC<LayoutProps> = ({ children }) => {
  return (
    <div className="min-h-screen">
      {/* Navigation */}
      <PublicNavigation />

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-8 lg:px-[100px] pb-8">
        {children}
      </main>

      {/* Footer */}
      <footer className="bg-[#6789DC] mt-8 sm:mt-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-8 lg:px-[100px] py-6 sm:py-8">
          <div className="text-center space-y-2">
            <nav
              className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-xs sm:text-sm"
              aria-label="Правовая информация"
            >
              <Link
                to={PERSONAL_DATA_POLICY_PATH}
                className="text-white/90 hover:text-white underline-offset-2 hover:underline"
              >
                Политика обработки персональных данных
              </Link>
              <button
                type="button"
                onClick={resetCookieConsentChoice}
                className="text-white/90 hover:text-white underline-offset-2 hover:underline"
              >
                Настройки cookie
              </button>
            </nav>
            <p className="text-xs sm:text-sm text-white/80">
              © {new Date().getFullYear()} Российская федерация петанка
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default Layout;
