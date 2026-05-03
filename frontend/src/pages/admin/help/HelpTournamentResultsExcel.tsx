import React from "react";

/** Статья: /admin/help/tournament-results-excel */
const HelpTournamentResultsExcel: React.FC = () => {
  return (
    <article className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 sm:p-8 text-gray-700 leading-relaxed">
      <h2 className="text-xl font-semibold text-gray-900 mt-0 mb-4">
        Загрузка результатов турниров (Excel и Google Таблицы)
      </h2>
      <p className="text-gray-700 leading-relaxed mb-4">
        При загрузке файла турнира система сама выбирает режим: если в книге есть
        лист с точным названием{" "}
        <strong className="font-medium text-gray-900">«Ручной ввод»</strong>,
        используется только он (ручной ввод итогов). Если этого листа нет —
        включается автоматический разбор сеток и таблиц квалификации. Те же
        правила к листам и столбцам относятся и к книге в Google Таблицах, если
        вы загружаете турнир по ссылке, а не файлом .xlsx.
      </p>
      <p className="text-sm text-gray-700 border-l-4 border-sky-300 pl-4 py-2 mb-6 bg-sky-50/60 rounded-r-lg">
        <strong className="text-gray-900">Доступ к Google Таблице.</strong> Перед
        загрузкой по URL откройте для таблицы{" "}
        <strong className="text-gray-900">доступ на чтение</strong> хотя бы для
        всех, у кого есть ссылка (в интерфейсе Google: «Поделиться» / «Настройки
        доступа» → уровень «Читатель» или «Просмотр»). Без публичного или
        доступного по ссылке чтения сервис не сможет прочитать листы через API.
      </p>

      <h3 className="text-lg font-semibold text-gray-900 mt-8 mb-3">
        Ручной ввод результатов
      </h3>
      <p className="text-gray-700 mb-4">
        Достаточно одного листа. Составы и итоговые очки по рейтингу вы задаёте
        явно; квалификация и сетки кубков из файла не читаются.
      </p>
      <ul className="list-disc pl-5 space-y-2 text-gray-700 mb-4">
        <li>
          <strong className="font-medium text-gray-900">Лист:</strong>{" "}
          <code className="text-sm bg-gray-100 px-1.5 py-0.5 rounded">
            Ручной ввод
          </code>{" "}
          (название должно совпадать символ в символ).
        </li>
        <li>
          <strong className="font-medium text-gray-900">Столбцы</strong>{" "}
          (заголовки ищутся по всему листу, обычно первая строка таблицы):
          <ul className="list-circle pl-5 mt-2 space-y-1">
            <li>
              <code className="text-sm bg-gray-100 px-1.5 py-0.5 rounded">
                Команда
              </code>{" "}
              — фамилии и имена игроков через запятую, как в базе (например:{" "}
              <em>Иванов Иван, Петров Пётр</em>).
            </li>
            <li>
              <code className="text-sm bg-gray-100 px-1.5 py-0.5 rounded">
                Кубок
              </code>{" "}
              — A / B / C или А / Б / С (латиница или кириллица). Можно оставить
              пустым, если команда не дошла до кубков.
            </li>
            <li>
              <code className="text-sm bg-gray-100 px-1.5 py-0.5 rounded">
                Позиция
              </code>{" "}
              — одно из значений:{" "}
              <code className="text-sm bg-gray-100 px-1.5 py-0.5 rounded">1</code>
              ,{" "}
              <code className="text-sm bg-gray-100 px-1.5 py-0.5 rounded">2</code>
              ,{" "}
              <code className="text-sm bg-gray-100 px-1.5 py-0.5 rounded">3</code>
              ,{" "}
              <code className="text-sm bg-gray-100 px-1.5 py-0.5 rounded">
                1/2
              </code>
              ,{" "}
              <code className="text-sm bg-gray-100 px-1.5 py-0.5 rounded">
                1/4
              </code>
              ,{" "}
              <code className="text-sm bg-gray-100 px-1.5 py-0.5 rounded">
                1/8
              </code>
              . Пусто, если кубок не указан. Кубок и позиция должны быть
              заполнены вместе или оба пустые.
            </li>
            <li>
              <code className="text-sm bg-gray-100 px-1.5 py-0.5 rounded">
                Очки
              </code>{" "}
              — итоговые очки команды по правилам рейтинга (число, обязательно).
            </li>
          </ul>
        </li>
      </ul>
      <p className="text-sm text-gray-600 border-l-4 border-primary-200 pl-4 py-1">
        Листы «Регистрация», «Итоги швейцарки», «Кубок А» и т.д. в этом режиме не
        используются. Не добавляйте лист «Ручной ввод», если нужен автоматический
        расчёт.
      </p>

      <h3 className="text-lg font-semibold text-gray-900 mt-8 mb-3">
        Автоматический расчёт из сеток и квалификации
      </h3>
      <p className="text-gray-700 mb-4">
        Нужны шаблонные листы с сетками плей-офф и таблица квалификации. Итоговые
        очки по рейтингу система выводит из побед, поражений и мест в кубках сама.
      </p>
      <ul className="list-disc pl-5 space-y-3 text-gray-700">
        <li>
          <strong className="font-medium text-gray-900">
            Регистрация команд
          </strong>
          <br />
          Лист:{" "}
          <code className="text-sm bg-gray-100 px-1.5 py-0.5 rounded">
            Регистрация
          </code>
          . Столбец с ячейкой-заголовком{" "}
          <code className="text-sm bg-gray-100 px-1.5 py-0.5 rounded">Команда</code>
          : по строкам — составы, игроки через запятую (как в справочнике
          игроков).
        </li>
        <li>
          <strong className="font-medium text-gray-900">
            Квалификация (один из вариантов)
          </strong>
          <ul className="list-circle pl-5 mt-2 space-y-2">
            <li>
              Швейцарка: лист{" "}
              <code className="text-sm bg-gray-100 px-1.5 py-0.5 rounded">
                Итоги швейцарки
              </code>
              . Столбцы{" "}
              <code className="text-sm bg-gray-100 px-1.5 py-0.5 rounded">
                Команда
              </code>{" "}
              (один игрок из состава — как в базе, по нему находится команда) и{" "}
              <code className="text-sm bg-gray-100 px-1.5 py-0.5 rounded">
                Результат
              </code>{" "}
              (число побед в квалификации). Разбор таблицы останавливается на
              пустой строке или на строке «Свободен» в столбце «Команда».
            </li>
            <li>
              Групповой этап: листы, в названии которых есть слово{" "}
              <code className="text-sm bg-gray-100 px-1.5 py-0.5 rounded">
                Группа
              </code>{" "}
              (например, «Группа А»). Столбцы{" "}
              <code className="text-sm bg-gray-100 px-1.5 py-0.5 rounded">
                Команда
              </code>{" "}
              и{" "}
              <code className="text-sm bg-gray-100 px-1.5 py-0.5 rounded">
                победы
              </code>{" "}
              (заголовок именно в нижнем регистре, как в шаблоне).
            </li>
          </ul>
        </li>
        <li>
          <strong className="font-medium text-gray-900">Кубок А</strong>{" "}
          (обязательно): лист с названием вида{" "}
          <code className="text-sm bg-gray-100 px-1.5 py-0.5 rounded">Кубок A</code>{" "}
          /{" "}
          <code className="text-sm bg-gray-100 px-1.5 py-0.5 rounded">Кубок А</code>
          . Заполняются фиксированные ячейки сетки (шаблон на 4, 8 или 16 команд)
          — фамилии и имена игроков в ячейках победителей матчей.
        </li>
        <li>
          <strong className="font-medium text-gray-900">Кубки B и C</strong> — по
          тем же правилам именования листов (
          <code className="text-sm bg-gray-100 px-1.5 py-0.5 rounded">Кубок B</code>
          ,{" "}
          <code className="text-sm bg-gray-100 px-1.5 py-0.5 rounded">Кубок C</code>{" "}
          и кириллические варианты). Если листа нет, этап считается отсутствующим.
        </li>
        <li>
          <strong className="font-medium text-gray-900">
            Стыковочные игры A/B
          </strong>{" "}
          (при необходимости): лист{" "}
          <code className="text-sm bg-gray-100 px-1.5 py-0.5 rounded">Стык AB</code>{" "}
          или с названием по шаблону «Стык» + буквы A и B. Заполняются ячейки
          участников и победителей согласно шаблону на 16 команд.
        </li>
      </ul>
      <p className="text-sm text-gray-600 mt-6 border-l-4 border-amber-200 pl-4 py-1">
        Во всех листах автоматического режима игроки должны совпадать с данными в
        системе; при расхождении имен загрузка остановится с ошибкой. При ручном
        вводе на листе «Ручной ввод» действует то же правило сопоставления
        игроков.
      </p>
    </article>
  );
};

export default HelpTournamentResultsExcel;
