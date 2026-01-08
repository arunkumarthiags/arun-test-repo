# Finance Tracker

A full-stack personal finance tracker with automatic bank syncing via Plaid API. Track income, expenses, set budgets, and visualize your financial health with beautiful charts and insights.

![Finance Tracker](https://img.shields.io/badge/version-1.0.0-blue.svg)
![License](https://img.shields.io/badge/license-MIT-green.svg)

## Features

### Core Functionality
- 💳 **Automatic Bank Syncing** - Connect bank accounts via Plaid for automatic transaction import
- 📊 **Dashboard Analytics** - Visual insights with charts showing spending by category, income vs expenses, and trends
- 💰 **Transaction Management** - View, filter, add, edit, and categorize transactions
- 🎯 **Budget Tracking** - Set monthly budgets by category with real-time progress tracking
- 📈 **Financial Insights** - Track net worth, spending trends, and financial health
- 📄 **CSV Export** - Export transactions for external analysis

### Technical Features
- 🔒 **Secure** - Encrypted storage of access tokens using AES-256-GCM
- 🌙 **Dark Mode** - Full dark mode support with system preference detection
- 📱 **Responsive** - Mobile-friendly design that works on all devices
- 🚀 **Fast** - Optimized performance with SQLite database
- 🐳 **Docker Ready** - Easy deployment with Docker and docker-compose
- 🔄 **Real-time Sync** - Webhook support for automatic transaction updates

## Tech Stack

### Backend
- Node.js + Express
- TypeScript
- SQLite (better-sqlite3)
- Plaid API
- Helmet (security)
- Rate limiting

### Frontend
- React 18
- TypeScript
- Tailwind CSS
- React Router
- Recharts (data visualization)
- react-plaid-link
- Axios

## Getting Started

### Prerequisites
- Node.js 18+ and npm
- Plaid account (free sandbox for development)
- Git

### 1. Clone the Repository

```bash
git clone <repository-url>
cd finance-tracker
```

### 2. Set Up Plaid Account

1. Go to [Plaid Dashboard](https://dashboard.plaid.com/signup)
2. Sign up for a free account
3. Create a new application
4. Note your:
   - **Client ID**
   - **Sandbox Secret** (for development)
   - **Development Secret** (optional, for development mode with real credentials)

### 3. Configure Environment Variables

Create a `.env` file in the root directory:

```bash
cp .env.example .env
```

Edit `.env` and add your Plaid credentials:

```env
# Plaid Configuration
PLAID_CLIENT_ID=your_client_id_here
PLAID_SECRET=your_sandbox_secret_here
PLAID_ENV=sandbox

# Application Configuration
PORT=3001
NODE_ENV=development
FRONTEND_URL=http://localhost:5173

# Database
DATABASE_PATH=./data/finance.db

# Generate with: openssl rand -base64 32
ENCRYPTION_KEY=your_32_byte_encryption_key_here
```

**Generate a secure encryption key:**
```bash
openssl rand -base64 32
```

### 4. Install Dependencies

**Backend:**
```bash
cd backend
npm install
```

**Frontend:**
```bash
cd frontend
npm install
```

### 5. Set Up Database

```bash
cd backend
npm run db:setup
```

**Optional: Seed with sample data (for testing without Plaid):**
```bash
npm run db:seed
```

### 6. Start Development Servers

**Backend (Terminal 1):**
```bash
cd backend
npm run dev
```
Server will run on http://localhost:3001

**Frontend (Terminal 2):**
```bash
cd frontend
npm run dev
```
Frontend will run on http://localhost:5173

### 7. Using the Application

1. Open http://localhost:5173 in your browser
2. Click "Connect Bank Account" to link a bank via Plaid
3. In Sandbox mode, use Plaid's test credentials:
   - Username: `user_good`
   - Password: `pass_good`
4. Select accounts to connect
5. Transactions will automatically sync

## Plaid Sandbox Testing

When using Plaid Sandbox environment, you can test with various scenarios:

### Test Credentials
- **Username:** `user_good` / **Password:** `pass_good` - Successful authentication
- **Username:** `user_bad` / **Password:** `pass_good` - Invalid credentials
- **Username:** `user_custom` / **Password:** `pass_good` - Custom test data

### Test Institutions
Plaid Sandbox provides test institutions like:
- First Platypus Bank
- Tattersall Federal Credit Union
- Tartan Bank

### Webhook Testing
To test webhooks in development:
1. Use a service like [ngrok](https://ngrok.com/) to expose your local server
2. Set `WEBHOOK_URL` in `.env` to your ngrok URL + `/api/plaid/webhook`
3. Plaid will send transaction updates to this endpoint

## Docker Deployment

### Using Docker Compose

1. **Configure environment variables** in `.env`

2. **Build and start services:**
```bash
docker-compose up -d
```

3. **Access the application:**
   - Frontend: http://localhost
   - Backend API: http://localhost:3001

4. **View logs:**
```bash
docker-compose logs -f
```

5. **Stop services:**
```bash
docker-compose down
```

### Production Considerations

When deploying to production:

1. **Update Plaid environment:**
```env
PLAID_ENV=production
PLAID_SECRET=your_production_secret
```

2. **Secure your encryption key:**
   - Use a strong, randomly generated key
   - Store securely (environment variables, secrets manager)

3. **Set up HTTPS:**
   - Use a reverse proxy (nginx, Caddy)
   - Enable SSL/TLS certificates

4. **Configure webhook URL:**
```env
WEBHOOK_URL=https://yourdomain.com/api/plaid/webhook
```

5. **Database backups:**
   - Regularly backup `data/finance.db`
   - Consider using a volume for persistence

## API Endpoints

### Plaid
- `POST /api/plaid/create-link-token` - Create Plaid Link token
- `POST /api/plaid/exchange-public-token` - Exchange public token for access token
- `GET /api/plaid/accounts` - Get connected accounts
- `GET /api/plaid/items` - Get connected Plaid items
- `POST /api/plaid/sync-transactions` - Sync transactions for an item
- `POST /api/plaid/sync-all-transactions` - Sync all transactions
- `POST /api/plaid/refresh-balances` - Refresh account balances
- `DELETE /api/plaid/items/:item_id` - Remove connected item
- `POST /api/plaid/webhook` - Webhook handler

### Transactions
- `GET /api/transactions` - Get all transactions (with filters)
- `GET /api/transactions/:id` - Get single transaction
- `POST /api/transactions` - Create transaction
- `PUT /api/transactions/:id` - Update transaction
- `DELETE /api/transactions/:id` - Delete transaction
- `POST /api/transactions/:id/receipt` - Upload receipt

### Accounts
- `GET /api/accounts` - Get all accounts
- `GET /api/accounts/:id` - Get single account
- `DELETE /api/accounts/:id` - Deactivate account

### Budgets
- `GET /api/budgets` - Get budgets (query: month, year)
- `POST /api/budgets` - Create budget
- `PUT /api/budgets/:id` - Update budget
- `DELETE /api/budgets/:id` - Delete budget

### Analytics
- `GET /api/analytics/summary` - Get financial summary
- `GET /api/analytics/spending-by-category` - Spending breakdown
- `GET /api/analytics/income-vs-expenses` - Income vs expenses over time
- `GET /api/analytics/net-worth` - Net worth calculation
- `GET /api/analytics/trends` - Spending trends
- `GET /api/analytics/export` - Export transactions to CSV

### Categories
- `GET /api/categories` - Get all categories
- `GET /api/categories/:type` - Get categories by type (income/expense)

## Project Structure

```
finance-tracker/
├── backend/
│   ├── src/
│   │   ├── controllers/      # Request handlers
│   │   ├── models/          # Database models
│   │   ├── routes/          # API routes
│   │   ├── services/        # Business logic (Plaid integration)
│   │   ├── middleware/      # Express middleware
│   │   ├── utils/           # Utilities (database, encryption, etc.)
│   │   └── index.ts         # Entry point
│   ├── package.json
│   └── tsconfig.json
├── frontend/
│   ├── src/
│   │   ├── components/      # React components
│   │   ├── pages/          # Page components
│   │   ├── context/        # React context (theme, app state)
│   │   ├── services/       # API client
│   │   ├── types/          # TypeScript types
│   │   ├── App.tsx         # Main app component
│   │   └── main.tsx        # Entry point
│   ├── package.json
│   └── vite.config.ts
├── docker-compose.yml
├── .env.example
└── README.md
```

## Features in Detail

### Automatic Categorization
Transactions imported from Plaid are automatically categorized based on merchant names and transaction descriptions. You can manually update categories as needed.

### Duplicate Detection
The system prevents duplicate transactions when both manual entries and Plaid imports exist for the same transaction.

### Multi-Account Support
Connect multiple bank accounts and credit cards. View consolidated data or filter by specific accounts.

### Budget Tracking
Set monthly budgets for each expense category. Real-time progress bars show:
- ✅ Green: Under 80% of budget
- ⚠️ Yellow: 80-99% of budget
- 🔴 Red: Over budget

### Receipt Management
Upload receipt photos for manual transactions (JPEG, PNG, PDF supported).

### Data Export
Export transactions to CSV for use in Excel, Google Sheets, or other tools.

## Troubleshooting

### Plaid Connection Issues
- Verify your Plaid credentials in `.env`
- Ensure you're using the correct environment (sandbox/development/production)
- Check that FRONTEND_URL is correctly set for CORS

### Database Issues
- Delete `data/finance.db` and run `npm run db:setup` to recreate
- Check file permissions on the data directory

### Port Conflicts
- Change PORT in `.env` if 3001 is in use
- Update Vite port in `frontend/vite.config.ts` if needed

### Dark Mode Not Working
- Clear browser cache
- Check that localStorage is enabled

## Security Considerations

- Access tokens are encrypted using AES-256-GCM before storage
- Rate limiting prevents brute force attacks
- Helmet middleware provides security headers
- CORS configured for frontend origin only
- Input validation on all endpoints

## Contributing

Contributions are welcome! Please:
1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Submit a pull request

## License

MIT License - see LICENSE file for details

## Support

For issues and questions:
- Open an issue on GitHub
- Check Plaid documentation: https://plaid.com/docs/

## Acknowledgments

- [Plaid](https://plaid.com/) for banking API
- [Recharts](https://recharts.org/) for charts
- [Tailwind CSS](https://tailwindcss.com/) for styling
- [Lucide](https://lucide.dev/) for icons
