import React from "react";

const RatingRules: React.FC = () => {
  return (
    <div className="max-w-7xl mx-auto px-2 sm:px-4 lg:px-8 py-4 sm:py-6">
      <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-4 sm:mb-6 text-center">
        Правила расчёта рейтинга 2026
      </h1>
      <div className="bg-white rounded-lg shadow-sm overflow-hidden">
        <img
          src="/Rating_points_table_2026.png"
          alt="Таблица очков рейтинга 2026"
          className="w-full h-auto"
        />
      </div>
    </div>
  );
};

export default RatingRules;
