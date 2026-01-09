import Papa from 'papaparse';
import fs from 'fs';

export interface RawTransaction {
  [key: string]: string | number;
}

/**
 * Parse CSV file and return array of transaction objects
 */
export async function parseCSV(filePath: string): Promise<RawTransaction[]> {
  try {
    const fileContent = fs.readFileSync(filePath, 'utf8');

    return new Promise((resolve, reject) => {
      Papa.parse(fileContent, {
        header: true, // First row as headers
        skipEmptyLines: true,
        dynamicTyping: true, // Auto-convert numbers
        transformHeader: (header: string) => {
          // Normalize headers: trim and lowercase for matching
          return header.trim();
        },
        complete: (results) => {
          if (results.errors.length > 0) {
            console.error('CSV parsing errors:', results.errors);
          }

          // Filter out empty rows
          const validRows = results.data.filter((row: any) => {
            return Object.values(row).some(val => val !== null && val !== '');
          });

          resolve(validRows as RawTransaction[]);
        },
        error: (error: any) => {
          reject(new Error(`CSV parsing failed: ${error.message}`));
        }
      });
    });
  } catch (error: any) {
    throw new Error(`Failed to read CSV file: ${error.message}`);
  }
}
