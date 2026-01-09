import fs from 'fs';
import Anthropic from '@anthropic-ai/sdk';
import { RawTransaction } from './csvParser';

// Initialize Anthropic client
const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

/**
 * Parse PDF bank statement using Claude AI and return array of transaction objects
 * Extracts text from PDF and uses Claude to intelligently parse transactions
 */
export async function parsePDF(filePath: string): Promise<RawTransaction[]> {
  try {
    // Import pdf-parse v2 using require for CommonJS compatibility
    const { PDFParse } = require('pdf-parse');

    // Create parser with buffer
    const pdfBuffer = fs.readFileSync(filePath);
    const parser = new PDFParse({ data: pdfBuffer });

    // Extract text
    const pdfData = await parser.getText();
    const pdfText = pdfData.text;

    if (!pdfText || pdfText.trim().length === 0) {
      throw new Error('Unable to extract text from PDF. The PDF may be a scanned image or empty.');
    }

    console.log(`Extracted ${pdfText.length} characters from PDF, sending to Claude for parsing...`);

    // Call Claude API to parse transactions from text
    const message = await anthropic.messages.create({
      model: 'claude-3-haiku-20240307',
      max_tokens: 4096,
      messages: [
        {
          role: 'user',
          content: `Please analyze this bank statement text and extract ALL financial transactions.

Here is the bank statement text:

${pdfText}

For each transaction, extract:
- Date (convert to MM/DD/YYYY format)
- Description (merchant/payee name)
- Amount (as a positive number for expenses/debits, negative for income/credits/deposits)

Return ONLY a valid JSON array with no additional text or explanation. Format:
[
  {"Date": "01/15/2024", "Description": "Amazon", "Amount": 45.99},
  {"Date": "01/16/2024", "Description": "Salary Deposit", "Amount": -2500.00}
]

Important:
- Include ALL transactions from the statement
- Expenses/debits should be positive numbers
- Income/credits/deposits should be negative numbers
- Use MM/DD/YYYY date format
- Return only the JSON array, no other text`,
        },
      ],
    });

    // Extract JSON from Claude's response
    const responseText = message.content[0].type === 'text' ? message.content[0].text : '';

    // Parse the JSON response
    let transactions: RawTransaction[];
    try {
      // Try to extract JSON array from the response
      const jsonMatch = responseText.match(/\[[\s\S]*\]/);
      if (!jsonMatch) {
        throw new Error('No JSON array found in response');
      }

      transactions = JSON.parse(jsonMatch[0]);

      if (!Array.isArray(transactions) || transactions.length === 0) {
        throw new Error('No transactions found in the PDF');
      }

      // Validate transaction format
      for (const txn of transactions) {
        if (!txn.Date || !txn.Description || txn.Amount === undefined) {
          throw new Error('Invalid transaction format from Claude response');
        }
      }

      console.log(`✅ Successfully extracted ${transactions.length} transactions from PDF using Claude AI`);
      return transactions;

    } catch (parseError: any) {
      console.error('Failed to parse Claude response:', responseText);
      throw new Error(
        'Unable to parse transactions from PDF. The PDF may not contain a recognizable bank statement format. ' +
        'Please try exporting your transactions as CSV from your bank\'s website.'
      );
    }

  } catch (error: any) {
    console.error('PDF parsing error:', error);

    // Handle specific errors
    if (error.message.includes('No transactions found')) {
      throw new Error(
        'No transactions were found in the PDF. Please ensure this is a bank statement with transaction data.'
      );
    }

    if (error.status === 401) {
      throw new Error('Invalid Anthropic API key. Please check your ANTHROPIC_API_KEY in .env file.');
    }

    if (error.message.includes('Unable to parse transactions')) {
      throw error;
    }

    throw new Error(`Failed to process PDF file: ${error.message}`);
  }
}
