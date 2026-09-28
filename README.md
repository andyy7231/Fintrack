# FinTrack — Personal Finance Manager

A production-ready personal finance management application with WhatsApp integration for natural-language transaction recording.

## Concept

**WhatsApp** is the conversational input interface.  
**Web application** is the financial management and visualization interface.

## Tech Stack

- **Framework**: Next.js (App Router)
- **Language**: TypeScript
- **Styling**: Tailwind CSS v4
- **Database**: PostgreSQL
- **ORM**: Drizzle ORM
- **Auth**: Better Auth
- **Validation**: Zod
- **WhatsApp**: WhatsApp Cloud API (official)

## Getting Started

### Prerequisites

- Node.js 18+
- PostgreSQL database
- npm

### Installation

```bash
# Clone the repository
git clone <repo-url>
cd fintrack

# Install dependencies
npm install

# Configure environment
cp .env.example .env.local
# Edit .env.local with your database credentials

# Generate and run database migrations
npx drizzle-kit generate
npx drizzle-kit migrate

# Start development server
npm run dev
```

### Available Scripts

| Script | Description |
|--------|-------------|
| `npm run dev` | Start development server |
| `npm run build` | Build for production |
| `npm run start` | Start production server |
| `npm run lint` | Run ESLint |
| `npm run db:generate` | Generate Drizzle migrations |
| `npm run db:migrate` | Run Drizzle migrations |
| `npm run db:studio` | Open Drizzle Studio |

### Environment Variables

See [`.env.example`](.env.example) for all required variables.

## Project Structure

```
fintrack/
├── app/              # Next.js App Router pages & API routes
├── components/       # Reusable React components
│   └── ui/           # Base UI components
├── lib/              # Shared libraries & configuration
│   ├── db/           # Database connection
│   ├── auth/         # Authentication config
│   ├── validation/   # Shared validation utilities
│   └── utils/        # General utilities
├── services/         # Business logic service layer
├── db/schema/        # Drizzle ORM table schemas
├── schemas/          # Zod validation schemas
├── types/            # TypeScript type definitions
├── drizzle/          # Database migrations
└── tests/            # Test files
```

## Architecture

Modular monolith — all modules share a single deployment:

```
                 Next.js
                    │
       ┌────────────┼────────────┐
       │            │            │
     Auth       Financial     WhatsApp
                  Core          Module
       │            │            │
       └────────────┼────────────┘
                    │
                PostgreSQL
```

## License

Private — All rights reserved.
