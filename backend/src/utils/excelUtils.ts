import * as XLSX from "xlsx";
import { normalizeName } from "../controllers/TournamentParser";

type SheetCell = {
  column: string;
  rowIndex: number;
};

class ExcelUtils {
  /**
   * Поиск листа по названию
   */
  static findXlsSheet(
    workbook: XLSX.WorkBook,
    expectedListName: RegExp | string
  ): XLSX.WorkSheet | undefined {
    // Проверяем все возможные варианты названий
    for (const sheetName of workbook.SheetNames) {
      const pattern =
        expectedListName instanceof RegExp
          ? expectedListName
          : new RegExp(normalizeName(expectedListName));

      if (pattern.test(normalizeName(sheetName))) {
        return workbook.Sheets[sheetName];
      }
    }
  }

  /**
   * Поиск ячейки по тексту (для поиска заголовков таблиц)
   * @param sheet
   * @param header
   * @returns
   */
  static findCellByText(
    sheet: XLSX.WorkSheet,
    textToFind: string
  ): SheetCell | null {
    for (const cellAddress in sheet) {
      if (cellAddress[0] === "!") continue; // пропускаем служебные поля
      const cell = sheet[cellAddress];
      if (cell && cell.v && cell.v === textToFind) {
        return this.parseCellAddress(cellAddress); // найден адрес ячейки
      }
    }
    return null;
  }

  static parseCellAddress(address: string): SheetCell | null {
    const match = address.match(/^([A-Z]+)(\d+)$/i);
    if (!match) {
      return null; // если формат не совпадает с "буквы+числа"
    }
    const [, column, row] = match;
    return {
      column: column.toUpperCase(),
      rowIndex: parseInt(row, 10),
    };
  }

  static getCellText(cell: { v?: any }) {
    if (this.isCellEmpty(cell)) {
      return "";
    } else {
      //console.log(`Текст ячейки: "${cell.v}"`);
      return normalizeName(String(cell.v));
    }
  }

  static isCellEmpty(cell?: { v?: any }): boolean {
    if (!cell) return true; // ячейка отсутствует
    if (cell.v === undefined || cell.v === null) return true; // нет значения
    if (typeof cell.v === "string" && cell.v.trim() === "") return true; // пустая строка
    return false; // есть содержимое
  }
}

export default ExcelUtils;
