import XLSX from 'xlsx';
import { RawTransaction } from './csvParser';

/**
 * Parse XLSX/XLS file and return array of transaction objects
 */
export async function parseXLSX(filePath: string): Promise<RawTransaction[]> {
  try {
    // Read the Excel file
    const workbook = XLSX.readFile(filePath);

    // Try to find a sheet named "Transactions" or use the first sheet
    let sheetName = workbook.SheetNames.find(name =>
      name.toLowerCase().includes('transaction') ||
      name.toLowerCase().includes('account') ||
      name.toLowerCase().includes('statement')
    );

    if (!sheetName) {
      sheetName = workbook.SheetNames[0];
    }

    const sheet = workbook.Sheets[sheetName];

    if (!sheet) {
      throw new Error('No valid sheet found in Excel file');
    }

    // Convert sheet to JSON with header row
    const rawData = XLSX.utils.sheet_to_json(sheet, {
      raw: false, // Keep values as strings for consistent parsing
      defval: '', // Default value for empty cells
    });

    if (rawData.length === 0) {
      throw new Error('Excel sheet is empty or contains no data');
    }

    // Filter out completely empty rows
    const validRows = rawData.filter((row: any) => {
      return Object.values(row).some(val => val !== null && val !== '');
    });

    // Normalize headers (trim whitespace)
    const normalizedRows = validRows.map((row: any) => {
      const normalizedRow: RawTransaction = {};
      for (const [key, value] of Object.entries(row)) {
        normalizedRow[key.trim()] = value as string | number;
      }
      return normalizedRow;
    });

    return normalizedRows;
  } catch (error: any) {
    throw new Error(`Failed to parse Excel file: ${error.message}`);
  }
}
