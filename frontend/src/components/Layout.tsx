import React from "react";
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
          <div className="text-center">
            <p className="text-xs sm:text-sm text-white/80 mt-3">
              © {new Date().getFullYear()} Российская федерация петанка
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default Layout;
