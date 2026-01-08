/**
 * Auto-categorization engine for transactions
 * Uses transaction name and merchant to determine category
 */

interface CategoryRule {
  keywords: string[];
  category: string;
}

const categoryRules: CategoryRule[] = [
  // Food & Dining
  { keywords: ['restaurant', 'cafe', 'coffee', 'starbucks', 'mcdonald', 'pizza', 'burger', 'taco', 'subway', 'chipotle', 'panera', 'dining'], category: 'Food & Dining' },

  // Groceries
  { keywords: ['grocery', 'supermarket', 'walmart', 'target', 'costco', 'whole foods', 'trader joe', 'safeway', 'kroger', 'publix', 'market'], category: 'Groceries' },

  // Transportation
  { keywords: ['gas', 'fuel', 'shell', 'chevron', 'exxon', 'uber', 'lyft', 'taxi', 'parking', 'transit', 'metro', 'bus', 'train', 'airline'], category: 'Transportation' },

  // Utilities
  { keywords: ['electric', 'gas company', 'water', 'internet', 'cable', 'phone', 'verizon', 'at&t', 'comcast', 'utility'], category: 'Utilities' },

  // Rent/Mortgage
  { keywords: ['rent', 'mortgage', 'property management', 'apartment'], category: 'Rent/Mortgage' },

  // Healthcare
  { keywords: ['pharmacy', 'cvs', 'walgreens', 'doctor', 'hospital', 'clinic', 'medical', 'health', 'dental', 'vision'], category: 'Healthcare' },

  // Entertainment
  { keywords: ['movie', 'cinema', 'theater', 'netflix', 'spotify', 'hulu', 'disney', 'gaming', 'steam', 'playstation', 'xbox'], category: 'Entertainment' },

  // Shopping
  { keywords: ['amazon', 'ebay', 'shop', 'store', 'retail', 'mall'], category: 'Shopping' },

  // Subscriptions
  { keywords: ['subscription', 'membership', 'adobe', 'microsoft', 'google one', 'icloud', 'dropbox'], category: 'Subscriptions' },

  // Insurance
  { keywords: ['insurance', 'geico', 'state farm', 'progressive', 'allstate'], category: 'Insurance' },

  // Travel
  { keywords: ['hotel', 'airbnb', 'booking', 'expedia', 'travel', 'airline', 'flight'], category: 'Travel' },

  // Income
  { keywords: ['payroll', 'salary', 'deposit', 'direct dep', 'payment received', 'transfer from'], category: 'Salary' },
];

/**
 * Categorize a transaction based on its name and merchant
 */
export function categorizeTransaction(name: string, merchantName?: string | null): string {
  const searchText = `${name} ${merchantName || ''}`.toLowerCase();

  for (const rule of categoryRules) {
    for (const keyword of rule.keywords) {
      if (searchText.includes(keyword.toLowerCase())) {
        return rule.category;
      }
    }
  }

  // Default category
  return 'Other Expense';
}

/**
 * Determine transaction type based on amount and category
 */
export function determineTransactionType(amount: number, category?: string): 'income' | 'expense' | 'transfer' {
  // Positive amounts in Plaid are money out (expenses), negative are money in (income)
  if (amount < 0) {
    return 'income';
  }

  if (category && ['Salary', 'Freelance', 'Investment', 'Other Income'].includes(category)) {
    return 'income';
  }

  return 'expense';
}
