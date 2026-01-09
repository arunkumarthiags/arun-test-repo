import { RawTransaction } from '../services/parsers/csvParser';

export interface ColumnMapping {
  date: string | number;
  amount: string | number;
  description: string | number;
  category?: string | number;
  confidence: number;
}

interface ColumnPattern {
  keywords: string[];
  validator: (value: any) => boolean;
  priority: number; // Higher = more important
}

const COLUMN_PATTERNS: Record<string, ColumnPattern> = {
  date: {
    keywords: [
      'date',
      'transaction date',
      'posted date',
      'trans date',
      'posting date',
      'value date',
      'effective date',
    ],
    validator: (value: any) => {
      if (!value) return false;
      const dateStr = String(value);
      // Try to parse various date formats
      const parsed = new Date(dateStr);
      return !isNaN(parsed.getTime());
    },
    priority: 10,
  },
  amount: {
    keywords: [
      'amount',
      'debit',
      'credit',
      'payment',
      'deposit',
      'value',
      'balance',
      'withdrawal',
    ],
    validator: (value: any) => {
      if (!value) return false;
      const amountStr = String(value).replace(/[$,]/g, '').trim();
      return /^-?\d+\.?\d*$/.test(amountStr) && parseFloat(amountStr) !== 0;
    },
    priority: 9,
  },
  description: {
    keywords: [
      'description',
      'memo',
      'details',
      'merchant',
      'payee',
      'name',
      'transaction',
      'reference',
      'narrative',
    ],
    validator: (value: any) => {
      if (!value) return false;
      return String(value).trim().length > 0;
    },
    priority: 8,
  },
  category: {
    keywords: [
      'category',
      'type',
      'classification',
      'group',
    ],
    validator: (value: any) => {
      if (!value) return false;
      return String(value).trim().length > 0;
    },
    priority: 5,
  },
};

/**
 * Auto-detect column mapping from raw transaction data
 */
export function detectColumns(rawData: RawTransaction[]): ColumnMapping {
  if (!rawData || rawData.length === 0) {
    throw new Error('No data provided for column detection');
  }

  const sampleSize = Math.min(5, rawData.length);
  const sampleRows = rawData.slice(0, sampleSize);
  const columns = Object.keys(rawData[0]);

  const detectedMapping: Partial<ColumnMapping> = {};
  const scores: Record<string, Record<string, number>> = {};

  // Initialize scores
  for (const field of Object.keys(COLUMN_PATTERNS)) {
    scores[field] = {};
    for (const column of columns) {
      scores[field][column] = 0;
    }
  }

  // Score each column for each field
  for (const field of Object.keys(COLUMN_PATTERNS)) {
    const pattern = COLUMN_PATTERNS[field];

    for (const column of columns) {
      let score = 0;

      // 1. Check keyword matching in column name
      const columnLower = column.toLowerCase();
      for (const keyword of pattern.keywords) {
        if (columnLower.includes(keyword.toLowerCase())) {
          score += pattern.priority * 10; // Strong bonus for keyword match
          break;
        }
      }

      // 2. Validate data in sample rows
      let validCount = 0;
      for (const row of sampleRows) {
        const value = row[column];
        if (pattern.validator(value)) {
          validCount++;
        }
      }

      // Add score based on validation success rate
      const validationScore = (validCount / sampleSize) * pattern.priority * 5;
      score += validationScore;

      scores[field][column] = score;
    }
  }

  // Select best match for each field
  for (const field of ['date', 'amount', 'description']) {
    const fieldScores = scores[field];
    let bestColumn = '';
    let bestScore = 0;

    for (const [column, score] of Object.entries(fieldScores)) {
      // Don't reuse a column that's already been assigned
      const alreadyUsed = Object.values(detectedMapping).includes(column);

      if (!alreadyUsed && score > bestScore) {
        bestScore = score;
        bestColumn = column;
      }
    }

    if (bestColumn) {
      (detectedMapping as any)[field] = bestColumn;
    }
  }

  // Optional: category field
  const categoryScores = scores.category;
  let bestCategoryColumn = '';
  let bestCategoryScore = 0;

  for (const [column, score] of Object.entries(categoryScores)) {
    const alreadyUsed = Object.values(detectedMapping).includes(column);
    if (!alreadyUsed && score > bestCategoryScore) {
      bestCategoryScore = score;
      bestCategoryColumn = column;
    }
  }

  if (bestCategoryColumn && bestCategoryScore > 10) {
    (detectedMapping as any).category = bestCategoryColumn;
  }

  // Validate that required fields are detected
  if (!detectedMapping.date || !detectedMapping.amount || !detectedMapping.description) {
    throw new Error(
      'Could not auto-detect required columns (Date, Amount, Description). ' +
      'Please ensure your file has headers and contains transaction data.'
    );
  }

  // Calculate overall confidence
  const confidence = calculateConfidence(scores, detectedMapping as ColumnMapping);

  return {
    ...detectedMapping,
    confidence,
  } as ColumnMapping;
}

/**
 * Calculate confidence score (0-1) based on detection scores
 */
function calculateConfidence(
  scores: Record<string, Record<string, number>>,
  mapping: ColumnMapping
): number {
  const requiredFields = ['date', 'amount', 'description'];
  let totalConfidence = 0;

  for (const field of requiredFields) {
    const column = mapping[field as keyof ColumnMapping] as string;
    const score = scores[field][column];
    const maxPossibleScore = COLUMN_PATTERNS[field].priority * 15; // keyword (10) + validation (5)

    const fieldConfidence = Math.min(score / maxPossibleScore, 1);
    totalConfidence += fieldConfidence;
  }

  // Average confidence across required fields
  return totalConfidence / requiredFields.length;
}
