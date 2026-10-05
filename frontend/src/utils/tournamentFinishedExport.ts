import {
  buildCupBracketPrintHtml,
  CUP_BRACKET_PRINT_STYLES,
} from "../components/admin/TournamentCupStageResults";
import {
  buildRoundPrintHtml,
  buildStandingsPrintHtml,
} from "../components/admin/TournamentSwissStageResults";
import { adminApi, ratingApi } from "../services/api";
import {
  CupBracketCode,
  getCupPositionText,
  TournamentCupStageView,
  TournamentFinishedPageData,
  TournamentGroupStageView,
  TournamentRegisteredTeam,
  TournamentResult,
  TournamentType,
} from "../types";
import {
  formatDate,
  formatDateTime,
  getTornamentCategoryText,
  getTournamentStatusText,
  getTournamentTypeText,
  tournamentRatingAsOfDate,
} from "./index";
import {
  compareTeamsByRating,
  playerPointsFromNames,
  teamRatingFromPlayerPoints,
} from "./swissSeed";
import {
  compareSwissStandings,
  getGroupLetter,
  getTiebreakerShortLabel,
  isSwissFreeTeamId,
} from "./tournamentPlaySettings";

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function teamLabel(players: string[]): string {
  return players.join(", ") || "Команда";
}

function formatDiff(diff: number): string {
  if (diff > 0) {
    return `+${diff}`;
  }
  return String(diff);
}

const EXPORT_STYLES = `
  body { font-family: system-ui, -apple-system, sans-serif; font-size: 13px; color: #111; margin: 0; }
  h1 { font-size: 20px; margin: 0 0 8px; }
  h2 { font-size: 16px; margin: 24px 0 8px; page-break-after: avoid; }
  h3 { font-size: 14px; margin: 16px 0 6px; page-break-after: avoid; }
  .meta { color: #555; margin: 0 0 16px; font-size: 12px; }
  .section { margin-bottom: 20px; }
  .keep-together { page-break-inside: avoid; }
  .swiss-standings-block { page-break-inside: avoid; }
  .swiss-round-page { page-break-before: always; break-before: page; page-break-inside: avoid; }
  ${CUP_BRACKET_PRINT_STYLES}
  .regulations { white-space: pre-wrap; border: 1px solid #e5e7eb; background: #f9fafb; padding: 12px; border-radius: 4px; font-size: 12px; }
  dl.info { display: grid; grid-template-columns: 1fr 1fr; gap: 8px 16px; font-size: 12px; margin: 0 0 12px; }
  dl.info dt { color: #6b7280; margin: 0; }
  dl.info dd { margin: 0; font-weight: 500; }
  table { border-collapse: collapse; width: 100%; margin-bottom: 12px; }
  th, td { border: 1px solid #ccc; padding: 6px 8px; text-align: left; font-size: 12px; }
  th { background: #f3f4f6; font-weight: 600; }
  td.num, th.num { text-align: center; }
  td.team { white-space: nowrap; }
  .matches { width: 100%; max-width: 640px; }
  .match { display: grid; grid-template-columns: 1fr auto auto auto 1fr auto; gap: 8px; align-items: center;
    padding: 8px 0; border-bottom: 1px solid #e5e7eb; }
  .match .a { text-align: right; }
  .match .b { text-align: left; }
  .match .score { font-weight: 600; min-width: 1.5rem; text-align: center; }
  .match .match-court { color: #555; font-size: 12px; white-space: nowrap; }
  .page-break { page-break-before: always; }
`;

function buildInfoSection(data: TournamentFinishedPageData): string {
  const { tournament } = data;
  return `
    <section class="section keep-together">
      <h2>Сведения о турнире</h2>
      <dl class="info">
        <div><dt>Дата проведения</dt><dd>${escapeHtml(formatDate(String(tournament.date ?? "")))}</dd></div>
        <div><dt>Тип</dt><dd>${escapeHtml(getTournamentTypeText(tournament.type as TournamentType) ?? "—")}</dd></div>
        <div><dt>Категория</dt><dd>${escapeHtml(getTornamentCategoryText(tournament.category ?? "NO_RATING") ?? "—")}</dd></div>
        <div><dt>Статус</dt><dd>${escapeHtml(getTournamentStatusText(tournament.status))}</dd></div>
        <div><dt>Режим загрузки</dt><dd>${tournament.manual ? "Ручной" : "Автоматический"}</dd></div>
        <div><dt>Учёт в рейтинге</dt><dd>${
          tournament.results_validated_at ? "Признан" : "Не признан / ожидает"
        }</dd></div>
      </dl>
      <h3>Описание</h3>
      ${
        tournament.regulations?.trim()
          ? `<div class="regulations">${escapeHtml(tournament.regulations.trim())}</div>`
          : `<p class="meta">Не указано</p>`
      }
    </section>
  `;
}

function buildRegistrationSection(
  teams: TournamentRegisteredTeam[],
  tournamentType: TournamentType,
  ratingByPlayerName: Map<string, number>
): string {
  const formatPlayerWithRating = (playerName: string) =>
    `${playerName} (${ratingByPlayerName.get(playerName) ?? 0})`;

  const getTeamPlayerPoints = (players: string[]) =>
    playerPointsFromNames(players, ratingByPlayerName);

  const getTeamTotalRating = (players: string[]) =>
    teamRatingFromPlayerPoints(getTeamPlayerPoints(players), tournamentType);

  const teamsByRating = [...teams].sort((a, b) =>
    compareTeamsByRating(
      getTeamPlayerPoints(a.players),
      getTeamPlayerPoints(b.players),
      tournamentType
    )
  );

  const confirmedCount = teams.filter((t) => t.is_confirmed).length;

  const rows = teamsByRating
    .map((team, index) => {
      const players = team.players.map(formatPlayerWithRating).join(", ");
      return `<tr>
        <td class="num">${index + 1}</td>
        <td class="team">${escapeHtml(players)}</td>
        <td class="num">${getTeamTotalRating(team.players)}</td>
        <td>${escapeHtml(formatDateTime(team.updated_at))}</td>
        <td>${team.is_confirmed ? "Подтверждена" : "Ожидает"}</td>
      </tr>`;
    })
    .join("");

  return `
    <section class="section page-break">
      <h2>Список регистрации</h2>
      <p class="meta">Всего: ${teams.length} · Подтверждено: ${confirmedCount}</p>
      ${
        teams.length === 0
          ? `<p class="meta">Нет зарегистрированных команд.</p>`
          : `<table>
        <thead><tr>
          <th class="num">№</th>
          <th>Состав команды</th>
          <th class="num">Рейтинг</th>
          <th>Обновлено</th>
          <th>Статус</th>
        </tr></thead>
        <tbody>${rows}</tbody>
      </table>`
      }
    </section>
  `;
}

function buildGroupStageSection(groups: TournamentGroupStageView[]): string {
  const parts = groups
    .sort((a, b) => a.group_number - b.group_number)
    .map((group) => {
      const letter = getGroupLetter(group.group_number);
      const title =
        group.format === "FRENCH"
          ? `Группа ${letter} (французская система)`
          : `Группа ${letter}`;

      const standingRows = group.teams
        .sort((a, b) => a.place - b.place)
        .map(
          (row) => `<tr>
          <td class="num">${row.place}</td>
          <td class="team">${escapeHtml(teamLabel(row.players))}</td>
          <td class="num">${row.wins}</td>
          <td class="num">${formatDiff(row.point_diff)}</td>
          <td class="num">${row.played}</td>
        </tr>`
        )
        .join("");

      const teamNameById = new Map(
        group.teams.map((t) => [t.team_id, teamLabel(t.players)])
      );

      const matchRows = group.matches
        .filter(
          (m) =>
            m.team_a_id != null &&
            m.team_b_id != null &&
            m.score_a != null &&
            m.score_b != null
        )
        .sort(
          (a, b) =>
            a.round_number - b.round_number ||
            (a.match_index ?? 0) - (b.match_index ?? 0)
        )
        .map((m) => {
          const aName =
            teamNameById.get(m.team_a_id!) ?? `Команда #${m.team_a_id}`;
          const bName =
            teamNameById.get(m.team_b_id!) ?? `Команда #${m.team_b_id}`;
          const court = m.court != null ? String(m.court) : "—";
          return `<tr>
            <td class="num">${m.round_number}</td>
            <td class="team">${escapeHtml(aName)}</td>
            <td class="num">${m.score_a}:${m.score_b}</td>
            <td class="team">${escapeHtml(bName)}</td>
            <td class="num">${escapeHtml(court)}</td>
          </tr>`;
        })
        .join("");

      return `
        <h3>${escapeHtml(title)}</h3>
        <p class="meta">Турнирная таблица</p>
        <table>
          <thead><tr>
            <th class="num">Место</th>
            <th>Команда</th>
            <th class="num">Победы</th>
            <th class="num">Разница</th>
            <th class="num">Игр</th>
          </tr></thead>
          <tbody>${standingRows}</tbody>
        </table>
        ${
          matchRows
            ? `<p class="meta">Матчи</p>
        <table>
          <thead><tr>
            <th class="num">Раунд</th>
            <th>Команда A</th>
            <th class="num">Счёт</th>
            <th>Команда B</th>
            <th class="num">Дорожка</th>
          </tr></thead>
          <tbody>${matchRows}</tbody>
        </table>`
            : ""
        }
      `;
    })
    .join("");

  return `
    <section class="section page-break">
      <h2>Квалификационный этап (группы)</h2>
      ${parts}
    </section>
  `;
}

function buildSwissSection(
  data: TournamentFinishedPageData["swiss"],
  tournamentName: string
): string {
  if (!data) {
    return "";
  }

  const tiebreakerOrder = data.tiebreaker_order ?? [];
  const rounds = [...new Set(data.matches.map((m) => m.round_number))].sort(
    (a, b) => a - b
  );

  const sortedStandings = data.standings
    .filter((row) => !isSwissFreeTeamId(row.team_id))
    .slice()
    .sort((a, b) => compareSwissStandings(a, b, tiebreakerOrder))
    .map((row, index) => ({ ...row, place: index + 1 }));

  const sortLegend = [
    "Победы",
    ...tiebreakerOrder.map((c) => getTiebreakerShortLabel(c)),
    "сид",
  ].join(" → ");

  const standingsTitle =
    data.completed_rounds > 0
      ? `Итоги швейцарки (после ${data.completed_rounds} туров)`
      : "Итоги швейцарки";

  const nameById = new Map<number, string>();
  for (const row of data.standings) {
    const first = row.players[0]?.trim();
    nameById.set(row.team_id, first || "Команда");
  }

  const standingsHtml = buildStandingsPrintHtml({
    tournamentName,
    title: standingsTitle,
    sortLegend:
      data.completed_rounds > 0 && tiebreakerOrder.length > 0 ? sortLegend : "",
    completedRounds: data.completed_rounds,
    tiebreakerOrder,
    standings: sortedStandings,
  });

  const roundsHtml = rounds
    .map((roundNumber) => {
      const matches = data.matches.filter((m) => m.round_number === roundNumber);
      const roundBody = buildRoundPrintHtml({
        tournamentName,
        roundNumber,
        matches,
        nameById,
      });
      return `<section class="swiss-round-page">${roundBody}</section>`;
    })
    .join("");

  return `
    <section class="section page-break">
      <h2>Квалификационный этап (швейцарская система)</h2>
      <div class="swiss-standings-block">${standingsHtml}</div>
    </section>
    ${roundsHtml}
  `;
}

function buildCupStageSection(
  cups: TournamentCupStageView[],
  tournamentName: string
): string {
  const order: CupBracketCode[] = ["AB", "A", "B", "C", "D"];
  const sorted = [...cups].sort(
    (a, b) => order.indexOf(a.cup) - order.indexOf(b.cup)
  );

  const parts = sorted
    .map((cupView) => {
      const bracketHtml = buildCupBracketPrintHtml({
        tournamentName,
        cupView,
      });
      return `<div class="cup-bracket-page">${bracketHtml}</div>`;
    })
    .join("");

  return parts;
}

function buildFinalResultsSection(results: TournamentResult[]): string {
  const cupOrder = ["A", "B", "C", "D"] as const;
  const byCup = new Map<string, TournamentResult[]>();
  for (const r of results) {
    const cup = r.cup || "?";
    if (!byCup.has(cup)) {
      byCup.set(cup, []);
    }
    byCup.get(cup)!.push(r);
  }

  const parts = cupOrder
    .filter((cup) => byCup.has(cup))
    .map((cup) => {
      const cupResults = byCup.get(cup)!;
      const rows = cupResults
        .map(
          (result) => `<tr>
          <td>${escapeHtml(String(getCupPositionText(result.cup_position || "", result.cup) ?? ""))}</td>
          <td class="team">${escapeHtml(result.team_players || "")}</td>
        </tr>`
        )
        .join("");
      return `
        <h3>Кубок ${cup}</h3>
        <table>
          <thead><tr><th>Место</th><th>Команда</th></tr></thead>
          <tbody>${rows}</tbody>
        </table>
      `;
    })
    .join("");

  if (!parts && results.length === 0) {
    return `
      <section class="section page-break">
        <h2>Итоговые результаты турнира</h2>
        <p class="meta">Нет данных о результатах.</p>
      </section>
    `;
  }

  return `
    <section class="section page-break">
      <h2>Итоговые результаты турнира</h2>
      ${parts}
    </section>
  `;
}

export function buildTournamentFinishedExportBody(
  data: TournamentFinishedPageData,
  ratingByPlayerName: Map<string, number>
): string {
  const { tournament, teams, results, groups, swiss, cups } = data;
  const title = tournament.name;

  const bodyParts = [
    `<h1>${escapeHtml(title)}</h1>`,
    `<p class="meta">Выгрузка от ${escapeHtml(formatDateTime(new Date().toISOString()))}</p>`,
    buildInfoSection(data),
    buildRegistrationSection(
      teams,
      tournament.type as TournamentType,
      ratingByPlayerName
    ),
    groups && groups.length > 0 ? buildGroupStageSection(groups) : "",
    swiss ? buildSwissSection(swiss, title) : "",
    cups && cups.length > 0 ? buildCupStageSection(cups, title) : "",
    buildFinalResultsSection(results),
  ].filter(Boolean);

  return bodyParts.join("\n");
}

function openTournamentExportPrint(
  documentTitle: string,
  bodyHtml: string
): void {
  const iframe = document.createElement("iframe");
  iframe.setAttribute("title", documentTitle);
  iframe.setAttribute("aria-hidden", "true");
  iframe.style.position = "fixed";
  iframe.style.left = "-10000px";
  iframe.style.top = "0";
  iframe.style.width = "800px";
  iframe.style.height = "600px";
  iframe.style.border = "0";
  iframe.style.opacity = "0";
  iframe.style.pointerEvents = "none";
  document.body.appendChild(iframe);

  const frameWindow = iframe.contentWindow;
  const frameDocument = frameWindow?.document;
  if (!frameWindow || !frameDocument) {
    iframe.remove();
    throw new Error("Не удалось открыть диалог печати");
  }

  let cleaned = false;
  const cleanup = () => {
    if (cleaned) {
      return;
    }
    cleaned = true;
    iframe.remove();
  };

  frameDocument.open();
  frameDocument.write(`<!DOCTYPE html>
<html lang="ru">
<head>
  <meta charset="utf-8" />
  <title>${escapeHtml(documentTitle)}</title>
  <style>${EXPORT_STYLES}</style>
</head>
<body>
${bodyHtml}
</body>
</html>`);
  frameDocument.close();

  const triggerPrint = () => {
    try {
      frameWindow.focus();
      frameWindow.print();
    } finally {
      window.setTimeout(cleanup, 1000);
    }
  };

  frameWindow.addEventListener("afterprint", cleanup);
  window.setTimeout(triggerPrint, 100);
}

export async function downloadTournamentFinishedPdf(
  tournamentId: number,
  tournamentName: string
): Promise<void> {
  const response = await adminApi.getTournamentFinishedPage(tournamentId);
  if (!response.data.success || !response.data.data) {
    throw new Error(response.data.message || "Не удалось загрузить данные турнира");
  }
  const data = response.data.data;

  const ratingAsOf = tournamentRatingAsOfDate(data.tournament.rating_fixed_date);
  const ratingResponse = await ratingApi.getFullRating(
    ratingAsOf ? { date: ratingAsOf } : undefined
  );
  const fullRating =
    ratingResponse.data.success && ratingResponse.data.data
      ? ratingResponse.data.data
      : [];

  const ratingByPlayerName = new Map(
    fullRating.map((player) => [player.player_name, player.total_points])
  );

  const bodyHtml = buildTournamentFinishedExportBody(data, ratingByPlayerName);
  openTournamentExportPrint(tournamentName, bodyHtml);
}
