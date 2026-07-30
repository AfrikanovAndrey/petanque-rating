import React from "react";
import { getCupPositionText, TournamentResult } from "../types";

const CUP_ORDER = ["A", "B", "C", "D"] as const;

type Props = {
  results: TournamentResult[];
};

const TournamentFinishedCupResults: React.FC<Props> = ({ results }) => {
  const renderCupTable = (cupResults: TournamentResult[], cupTitle: string) => {
    if (cupResults.length === 0) {
      return null;
    }

    return (
      <div key={cupTitle} className="mb-6 last:mb-0">
        <div className="mb-4">
          <h3 className="text-sm sm:text-md font-medium text-gray-900">
            {cupTitle}
          </h3>
        </div>
        <div className="hidden sm:block overflow-x-auto">
          <table className="min-w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Место
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Команда
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {cupResults.map((result) => (
                <tr
                  key={result.id}
                  className={
                    ["WINNER", "RUNNER_UP", "THIRD_PLACE", "1", "2", "3"].includes(
                      result.cup_position
                    )
                      ? "bg-gradient-to-r from-yellow-50 to-transparent"
                      : ""
                  }
                >
                  <td className="px-4 py-3 whitespace-nowrap">
                    <div className="text-sm font-medium">
                      {getCupPositionText(
                        result.cup_position || "",
                        result.cup
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <div className="text-sm font-semibold text-gray-900">
                      {result.team_players}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="sm:hidden space-y-2">
          {cupResults.map((result) => {
            const isTopPosition = [
              "WINNER",
              "RUNNER_UP",
              "THIRD_PLACE",
              "1",
              "2",
              "3",
            ].includes(result.cup_position);
            return (
              <div
                key={result.id}
                className={`p-3 rounded-lg border ${
                  isTopPosition
                    ? "bg-gradient-to-r from-yellow-50 to-transparent border-yellow-200"
                    : "bg-white border-gray-200"
                }`}
              >
                <div className="text-sm font-medium text-gray-900 mb-1">
                  {getCupPositionText(result.cup_position || "", result.cup)}
                </div>
                <div className="text-sm font-semibold text-gray-900 break-words">
                  {result.team_players}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  const tables = CUP_ORDER.map((cup) =>
    renderCupTable(
      results.filter((result) => result.cup === cup),
      `Кубок ${cup}`
    )
  ).filter(Boolean);

  if (tables.length === 0) {
    return (
      <p className="text-sm text-gray-500">Результаты кубков пока не загружены.</p>
    );
  }

  return <div className="space-y-6">{tables}</div>;
};

export default TournamentFinishedCupResults;
