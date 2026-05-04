/**
 * Справка: список статей и подстраниц (/admin/help/:slug).
 * Добавьте сюда запись и соответствующий <Route> в App.tsx.
 */
export type HelpArticleMeta = {
  slug: string;
  title: string;
  description: string;
};

export const HELP_ARTICLES: HelpArticleMeta[] = [
  {
    slug: "user-roles",
    title: "Роли в админ-панели",
    description:
      "ADMIN, MANAGER и LICENSE_MANAGER: турниры, игроки, лицензии и остальное.",
  },
  {
    slug: "tournament-results-excel",
    title: "Загрузка результатов турниров (Excel и Google Таблицы)",
    description:
      "Файл Excel и Google Таблицы: доступ на чтение по ссылке, ручной ввод и автоматический режим.",
  },
];
