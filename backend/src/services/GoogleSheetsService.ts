import { google, sheets_v4 } from "googleapis";
import * as XLSX from "xlsx";
import * as dotenv from "dotenv";

dotenv.config();

export class GoogleSheetsService {
  private static sheets: sheets_v4.Sheets | null = null;
  private static apiKey = process.env.GOOGLE_SHEETS_API_KEY;

  /**
   * Диагностическая информация для отладки API ключа
   */
  static debugApiKey(): void {
    console.log("🔍 Диагностика Google Sheets API:");
    console.log(`  - API ключ загружен: ${this.apiKey ? "ДА" : "НЕТ"}`);
    console.log(
      `  - Длина ключа: ${this.apiKey ? this.apiKey.length : 0} символов`
    );
    console.log(
      `  - Начинается с AIza: ${this.apiKey?.startsWith("AIza") ? "ДА" : "НЕТ"}`
    );
    console.log(`  - NODE_ENV: ${process.env.NODE_ENV}`);
  }

  /**
   * Инициализация Google Sheets API
   */
  private static getSheets(): sheets_v4.Sheets {
    if (!this.sheets) {
      if (!this.apiKey) {
        throw new Error(
          "Google Sheets API ключ не настроен. Добавьте GOOGLE_SHEETS_API_KEY в файл .env"
        );
      }

      this.sheets = google.sheets({
        version: "v4",
        auth: this.apiKey,
      });
    }
    return this.sheets;
  }

  /**
   * Извлечение ID таблицы из URL Google Sheets
   */
  static extractSheetId(url: string): string {
    // Поддерживаемые форматы URLs:
    // https://docs.google.com/spreadsheets/d/SHEET_ID/edit#gid=0
    // https://docs.google.com/spreadsheets/d/SHEET_ID/edit
    // https://docs.google.com/spreadsheets/d/SHEET_ID
    const patterns = [
      /\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/,
      /spreadsheets\/d\/([a-zA-Z0-9-_]+)/,
    ];

    for (const pattern of patterns) {
      const match = url.match(pattern);
      if (match && match[1]) {
        return match[1];
      }
    }

    throw new Error(
      "Неверный формат URL Google Sheets. Ожидаемый формат: https://docs.google.com/spreadsheets/d/SHEET_ID/..."
    );
  }

  /**
   * Валидация URL Google Sheets
   */
  static validateGoogleSheetsUrl(url: string): boolean {
    try {
      this.extractSheetId(url);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Ошибка API: файл на Drive в формате Excel (.xlsx), а не нативная Google Таблица.
   */
  private static isOfficeFileError(error: unknown): boolean {
    const msg = String((error as Error)?.message ?? error);
    return (
      msg.includes("Office file") ||
      msg.includes("not supported for this document")
    );
  }

  private static officeFileUserMessage(): string {
    return (
      "Файл на Google Диске сохранён в формате Excel (.xlsx), а не как Google Таблица. " +
      "Google Sheets API не умеет читать такие файлы, даже если они открываются в браузере и доступны по ссылке. " +
      'Откройте файл в Google Таблицах → «Файл» → «Сохранить как таблицу Google» (или создайте копию в формате Google Таблиц) и используйте ссылку на новый документ. ' +
      "Либо скачайте .xlsx и загрузите файлом в систему."
    );
  }

  /**
   * Скачивание книги через публичный export (работает для нативных таблиц и части Excel на Drive).
   */
  private static async downloadWorkbookViaExport(
    spreadsheetId: string
  ): Promise<XLSX.WorkBook> {
    const exportUrl = `https://docs.google.com/spreadsheets/d/${spreadsheetId}/export?format=xlsx`;
    console.log(`Пробуем загрузить через export URL: ${exportUrl}`);

    const response = await fetch(exportUrl, { redirect: "follow" });
    if (!response.ok) {
      throw new Error(`export HTTP ${response.status}`);
    }

    const contentType = response.headers.get("content-type") ?? "";
    if (contentType.includes("text/html")) {
      throw new Error(
        "export вернул HTML вместо файла — проверьте доступ на чтение по ссылке"
      );
    }

    const buffer = Buffer.from(await response.arrayBuffer());
    if (buffer.length < 100) {
      throw new Error("export вернул пустой или слишком короткий ответ");
    }

    return XLSX.read(buffer, { type: "buffer" });
  }

  /**
   * Получение списка листов в таблице
   */
  static async getSheetNames(spreadsheetId: string): Promise<string[]> {
    try {
      const sheets = this.getSheets();
      const response = await sheets.spreadsheets.get({
        spreadsheetId,
        fields: "sheets.properties.title",
      });

      const sheetNames =
        response.data.sheets?.map(
          (sheet) => sheet.properties?.title || "Untitled"
        ) || [];

      console.log(`Найдены листы в Google таблице: ${sheetNames.join(", ")}`);
      return sheetNames;
    } catch (error) {
      console.error("Ошибка при получении списка листов:", error);

      if (this.isOfficeFileError(error)) {
        try {
          const workbook = await this.downloadWorkbookViaExport(spreadsheetId);
          const sheetNames = workbook.SheetNames;
          console.log(
            `✓ Листы получены через export (Excel на Drive): ${sheetNames.join(", ")}`
          );
          return sheetNames;
        } catch (exportError) {
          console.warn("Export fallback не сработал:", exportError);
          throw new Error(this.officeFileUserMessage());
        }
      }

      throw new Error(
        `Не удалось получить доступ к Google таблице. Убедитесь, что таблица доступна для чтения по ссылке: ${
          (error as Error).message
        }`
      );
    }
  }

  /**
   * Получение данных из конкретного листа
   */
  static async getSheetData(
    spreadsheetId: string,
    sheetName: string,
    range?: string
  ): Promise<any[][]> {
    try {
      const sheets = this.getSheets();
      const fullRange = range ? `${sheetName}!${range}` : sheetName;

      console.log(`Загружаем данные из листа: ${fullRange}`);

      const response = await sheets.spreadsheets.values.get({
        spreadsheetId,
        range: fullRange,
        valueRenderOption: "UNFORMATTED_VALUE",
        dateTimeRenderOption: "FORMATTED_STRING",
      });

      const values = response.data.values || [];
      console.log(
        `Получено ${values.length} строк данных из листа "${sheetName}"`
      );

      return values;
    } catch (error) {
      console.error(
        `Ошибка при получении данных из листа "${sheetName}":`,
        error
      );
      throw new Error(
        `Не удалось получить данные из листа "${sheetName}": ${
          (error as Error).message
        }`
      );
    }
  }

  /**
   * Конвертация данных Google Sheets в формат, совместимый с XLSX.WorkBook
   */
  static async convertToWorkbook(
    spreadsheetId: string
  ): Promise<XLSX.WorkBook> {
    try {
      console.log(
        `Начинаем конвертацию Google таблицы ${spreadsheetId} в XLSX Workbook`
      );

      // Excel на Drive: getSheetNames уже мог загрузить книгу через export
      try {
        const sheets = this.getSheets();
        await sheets.spreadsheets.get({
          spreadsheetId,
          fields: "spreadsheetId",
        });
      } catch (probeError) {
        if (this.isOfficeFileError(probeError)) {
          console.log("Обнаружен Excel на Drive — загружаем через export");
          return await this.downloadWorkbookViaExport(spreadsheetId);
        }
        throw probeError;
      }

      // Получаем список всех листов
      const sheetNames = await this.getSheetNames(spreadsheetId);

      if (sheetNames.length === 0) {
        throw new Error("В Google таблице не найдено ни одного листа");
      }

      // Создаем новый workbook
      const workbook: XLSX.WorkBook = {
        SheetNames: sheetNames,
        Sheets: {},
      };

      // Загружаем данные из каждого листа
      for (const sheetName of sheetNames) {
        try {
          console.log(`Обрабатываем лист: "${sheetName}"`);
          const sheetData = await this.getSheetData(spreadsheetId, sheetName);

          // Конвертируем данные в worksheet
          const worksheet = XLSX.utils.aoa_to_sheet(sheetData);
          workbook.Sheets[sheetName] = worksheet;

          console.log(
            `✓ Лист "${sheetName}" успешно конвертирован (${sheetData.length} строк)`
          );
        } catch (error) {
          console.warn(`⚠️ Не удалось загрузить лист "${sheetName}":`, error);
          // Создаем пустой worksheet для проблемного листа
          workbook.Sheets[sheetName] = XLSX.utils.aoa_to_sheet([]);
        }
      }

      console.log(
        `✅ Google таблица успешно конвертирована в XLSX Workbook. Листов: ${
          Object.keys(workbook.Sheets).length
        }`
      );
      return workbook;
    } catch (error) {
      console.error(
        "Критическая ошибка при конвертации Google таблицы:",
        error
      );
      throw new Error(
        `Не удалось конвертировать Google таблицу: ${(error as Error).message}`
      );
    }
  }

  /**
   * Проверка доступности Google таблицы
   */
  static async checkTableAccess(url: string): Promise<{
    accessible: boolean;
    spreadsheetId: string;
    sheetNames: string[];
    error?: string;
  }> {
    try {
      const spreadsheetId = this.extractSheetId(url);
      const sheetNames = await this.getSheetNames(spreadsheetId);

      return {
        accessible: true,
        spreadsheetId,
        sheetNames,
      };
    } catch (error) {
      return {
        accessible: false,
        spreadsheetId: "",
        sheetNames: [],
        error: (error as Error).message,
      };
    }
  }

  /**
   * Получение данных турнира из Google Sheets в виде buffer (как если бы это был XLSX файл)
   */
  static async getTournamentDataAsBuffer(url: string): Promise<{
    workbook: XLSX.WorkBook;
    fileName: string;
  }> {
    try {
      console.log(`Загрузка данных турнира из Google Sheets: ${url}`);

      const spreadsheetId = this.extractSheetId(url);
      const workbook = await this.convertToWorkbook(spreadsheetId);

      // Генерируем имя файла на основе ID таблицы
      const fileName = `GoogleSheets_${spreadsheetId}.xlsx`;

      console.log(`✅ Данные турнира успешно загружены из Google Sheets`);

      return {
        workbook,
        fileName,
      };
    } catch (error) {
      console.error("Ошибка загрузки данных турнира из Google Sheets:", error);
      throw new Error(
        `Не удалось загрузить данные турнира из Google таблицы: ${
          (error as Error).message
        }`
      );
    }
  }
}
