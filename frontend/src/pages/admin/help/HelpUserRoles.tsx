import React from "react";
import { UserRole } from "../../../types";
import { getUserRoleLabel } from "../../../utils";

/** Статья: /admin/help/user-roles */
const HelpUserRoles: React.FC = () => {
  return (
    <article className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 sm:p-8 text-gray-700 leading-relaxed">
      <h2 className="text-xl font-semibold text-gray-900 mt-0 mb-4">
        Роли в админ-панели
      </h2>
      <p className="text-gray-700 mb-6">
        Доступ к разделам админки задаётся ролями учётной записи. Пользователю
        можно назначить сразу несколько ролей: итоговые права складываются.
      </p>

      <section className="mb-8">
        <h3 className="text-lg font-semibold text-gray-900 mb-2">
          {getUserRoleLabel(UserRole.ADMIN)} (
          <code className="text-sm bg-gray-100 px-1.5 py-0.5 rounded">
            ADMIN
          </code>
          )
        </h3>
        <p className="text-gray-700 mb-2">
          Полный доступ: панель управления, турниры и игроки рейтинга, лицензии,
          пользователи, логи аудита, настройки рейтинга и справка.
        </p>
        <p className="text-sm text-gray-600">
          Только администратор может удалять турниры и отдельные результаты,
          менять глобальные настройки рейтинга и просматривать аудит.
        </p>
      </section>

      <section className="mb-8">
        <h3 className="text-lg font-semibold text-gray-900 mb-2">
          {getUserRoleLabel(UserRole.MANAGER)} (
          <code className="text-sm bg-gray-100 px-1.5 py-0.5 rounded">
            MANAGER
          </code>
          )
        </h3>
        <p className="text-gray-700 mb-2">
          Работа с рейтингом и турнирами: разделы «Турниры», «Игроки»,
          «Справка». Нет доступа к разделу «Лицензии», панели управления, учётным
          записям других пользователей, логам аудита и настройкам системы.
        </p>
      </section>

      <section className="mb-4">
        <h3 className="text-lg font-semibold text-gray-900 mb-2">
          {getUserRoleLabel(UserRole.LICENSE_MANAGER)} (
          <code className="text-sm bg-gray-100 px-1.5 py-0.5 rounded">
            LICENSE_MANAGER
          </code>
          )
        </h3>
        <p className="text-gray-700 mb-2">
          Управление лицензиями и справочником игроков рейтинга без доступа к
          турнирам: в меню доступны разделы «Игроки», «Лицензии» и «Справка».
        </p>
        <p className="text-sm text-gray-600">
          Нет доступа к панели управления, турнирам, учётным записям
          пользователей, настройкам и логам аудита.
        </p>
      </section>

      <section className="mb-8">
        <h3 className="text-lg font-semibold text-gray-900 mb-2">
          {getUserRoleLabel(UserRole.PRESIDIUM_MEMBER)} (
          <code className="text-sm bg-gray-100 px-1.5 py-0.5 rounded">
            PRESIDIUM_MEMBER
          </code>
          )
        </h3>
        <p className="text-gray-700 mb-2">
          Роль для признания результатов завершённых турниров. В меню доступны
          «Турниры» и «Справка».
        </p>
        <p className="text-sm text-gray-600">
          Член президиума может подтвердить учёт результатов турнира в рейтинге,
          но не может загружать/редактировать/удалять турниры, а также не имеет
          доступа к игрокам, лицензиям, пользователям, настройкам и аудиту.
        </p>
      </section>

      <section className="mb-4">
        <h3 className="text-lg font-semibold text-gray-900 mb-2">
          Несколько ролей у одного пользователя
        </h3>
        <p className="text-gray-700 mb-2">
          При назначении нескольких ролей доступы объединяются. Достаточно
          наличия любой подходящей роли для доступа к конкретному разделу или
          действию.
        </p>
        <ul className="list-disc pl-5 text-sm text-gray-600 space-y-1">
          <li>
            <code className="text-xs bg-gray-100 px-1.5 py-0.5 rounded">
              MANAGER + PRESIDIUM_MEMBER
            </code>{" "}
            — можно вести турниры и признавать их результаты для рейтинга.
          </li>
          <li>
            <code className="text-xs bg-gray-100 px-1.5 py-0.5 rounded">
              LICENSE_MANAGER + PRESIDIUM_MEMBER
            </code>{" "}
            — работа с лицензиями и признание турниров, но без редактирования
            турниров.
          </li>
          <li>
            <code className="text-xs bg-gray-100 px-1.5 py-0.5 rounded">
              ADMIN + любая роль
            </code>{" "}
            — фактически полный доступ администратора.
          </li>
        </ul>
      </section>
    </article>
  );
};

export default HelpUserRoles;
