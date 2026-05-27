import React from "react";
import { Link } from "react-router-dom";
import {
  PERSONAL_DATA_OPERATOR_NAME,
  PERSONAL_DATA_POLICY_PATH,
} from "../constants/personalData";
import { resetCookieConsentChoice } from "../utils/cookieConsent";

const PersonalDataPolicy: React.FC = () => {
  const handleCookieSettings = () => {
    resetCookieConsentChoice();
  };

  return (
    <div className="max-w-3xl mx-auto px-2 sm:px-4 py-4 sm:py-8">
      <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-6">
        Политика обработки персональных данных
      </h1>

      <div className="card p-4 sm:p-6 space-y-6 text-sm text-gray-700 leading-relaxed">
        <section>
          <h2 className="text-lg font-semibold text-gray-900 mb-2">
            1. Общие положения
          </h2>
          <p>
            Настоящая Политика определяет порядок обработки и защиты
            персональных данных пользователей сайта рейтинга игроков в петанк
            (далее — Сайт) в соответствии с Федеральным законом от 27.07.2006
            № 152-ФЗ «О персональных данных» (далее — 152-ФЗ).
          </p>
          <p className="mt-2">
            Используя Сайт и давая согласие на обработку персональных данных
            посредством файлов cookie, вы подтверждаете, что ознакомились с
            настоящей Политикой.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-gray-900 mb-2">
            2. Оператор персональных данных
          </h2>
          <p>
            Оператором персональных данных является{" "}
            <strong>{PERSONAL_DATA_OPERATOR_NAME}</strong> (далее — Оператор).
          </p>
          <p className="mt-2">
            По вопросам обработки персональных данных вы можете направить
            обращение Оператору через официальные каналы связи Российской
            федерации петанка.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-gray-900 mb-2">
            3. Категории обрабатываемых данных
          </h2>
          <p>
            При использовании Сайта Оператор может обрабатывать следующие
            данные:
          </p>
          <ul className="list-disc pl-5 mt-2 space-y-1">
            <li>
              технические данные, автоматически передаваемые браузером (IP-адрес,
              тип браузера, время доступа);
            </li>
            <li>
              данные, сохраняемые в файлах cookie и аналогичных технологиях
              (настройки фильтров на странице турниров, факт вашего выбора по
              согласию на cookie);
            </li>
            <li>
              при входе в административную панель — данные учётной записи,
              необходимые для авторизации (обрабатываются отдельно в рамках
              договорённостей с уполномоченными пользователями).
            </li>
          </ul>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-gray-900 mb-2">
            4. Цели обработки
          </h2>
          <ul className="list-disc pl-5 space-y-1">
            <li>обеспечение работоспособности и безопасности Сайта;</li>
            <li>
              сохранение выбранных пользователем настроек интерфейса (фильтры
              списка турниров);
            </li>
            <li>учёт согласия или отказа от использования cookie;</li>
            <li>исполнение требований законодательства Российской Федерации.</li>
          </ul>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-gray-900 mb-2">
            5. Правовые основания обработки
          </h2>
          <p>
            Обработка персональных данных, связанная с использованием файлов
            cookie для сохранения настроек интерфейса, осуществляется на
            основании согласия субъекта персональных данных (п. 1 ч. 1 ст. 6
            152-ФЗ). Согласие даётся отдельным активным действием (кнопка
            «Принять») и может быть отозвано в любой момент.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-gray-900 mb-2">
            6. Файлы cookie
          </h2>
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-xs sm:text-sm border border-gray-200 mt-2">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-3 py-2 border-b font-medium text-gray-900">
                    Название
                  </th>
                  <th className="px-3 py-2 border-b font-medium text-gray-900">
                    Назначение
                  </th>
                  <th className="px-3 py-2 border-b font-medium text-gray-900">
                    Срок
                  </th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td className="px-3 py-2 border-b align-top">
                    petanque_cookie_consent
                  </td>
                  <td className="px-3 py-2 border-b align-top">
                    Хранение вашего решения о согласии или отказе
                  </td>
                  <td className="px-3 py-2 border-b align-top">1 год</td>
                </tr>
                <tr>
                  <td className="px-3 py-2 border-b align-top">
                    petanque_tournaments_filters
                  </td>
                  <td className="px-3 py-2 border-b align-top">
                    Сохранение фильтров на странице «Турниры» (только при
                    согласии)
                  </td>
                  <td className="px-3 py-2 border-b align-top">1 год</td>
                </tr>
              </tbody>
            </table>
          </div>
          <p className="mt-3">
            Необязательные cookie не устанавливаются до получения вашего
            согласия. При отказе Сайт остаётся доступным; настройки фильтров
            не сохраняются между визитами.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-gray-900 mb-2">
            7. Срок обработки и хранения
          </h2>
          <p>
            Персональные данные обрабатываются в течение срока действия cookie
            либо до отзыва согласия — в зависимости от того, что наступит
            раньше. После отзыва согласия соответствующие cookie удаляются.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-gray-900 mb-2">
            8. Права субъекта персональных данных
          </h2>
          <p>В соответствии с 152-ФЗ вы вправе:</p>
          <ul className="list-disc pl-5 mt-2 space-y-1">
            <li>
              получать сведения об обработке ваших персональных данных (ст.
              14);
            </li>
            <li>
              требовать уточнения, блокирования или уничтожения данных, если они
              являются неполными, устаревшими или обрабатываются незаконно (ст.
              14, 21);
            </li>
            <li>отозвать согласие на обработку (ч. 2 ст. 9);</li>
            <li>
              обжаловать действия Оператора в уполномоченный орган или в суд.
            </li>
          </ul>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-gray-900 mb-2">
            9. Отзыв согласия и настройки cookie
          </h2>
          <p>
            Вы можете отозвать согласие, изменить выбор или удалить сохранённые
            cookie:
          </p>
          <ul className="list-disc pl-5 mt-2 space-y-1">
            <li>
              нажав кнопку ниже — откроется окно выбора заново, ранее
              сохранённые необязательные cookie будут удалены;
            </li>
            <li>
              через настройки браузера (удаление cookie для данного сайта).
            </li>
          </ul>
          <button
            type="button"
            onClick={handleCookieSettings}
            className="btn-secondary mt-4"
          >
            Изменить настройки cookie
          </button>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-gray-900 mb-2">
            10. Меры по защите персональных данных
          </h2>
          <p>
            Оператор принимает необходимые правовые, организационные и
            технические меры для защиты персональных данных от неправомерного
            доступа, уничтожения, изменения, блокирования, копирования и
            распространения.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-gray-900 mb-2">
            11. Изменение Политики
          </h2>
          <p>
            Оператор вправе обновлять настоящую Политику. Актуальная версия
            всегда доступна по адресу{" "}
            <Link
              to={PERSONAL_DATA_POLICY_PATH}
              className="text-primary-600 hover:underline"
            >
              {PERSONAL_DATA_POLICY_PATH}
            </Link>
            . При существенных изменениях пользователю может быть предложено
            повторно подтвердить согласие.
          </p>
          <p className="mt-2 text-gray-500">
            Дата публикации: {new Date().toLocaleDateString("ru-RU")}
          </p>
        </section>
      </div>
    </div>
  );
};

export default PersonalDataPolicy;
