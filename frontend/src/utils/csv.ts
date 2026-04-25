class CsvUtils {
  static escapeCsvField(value: string): string {
    if (/[",\n\r]/.test(value)) {
      return `"${value.replace(/"/g, '""')}"`;
    }

    return value;
  }
}

export default CsvUtils;
