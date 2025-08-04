# MorphSave - Gamified Micro-Savings Platform

A gamified micro-savings platform built on Morph L2 that transforms the way consumers approach saving money through behavioral psychology, gamification mechanics, and blockchain technology.

## 🚀 Features

- **Automated Round-Up Savings**: Automatically save spare change from daily transactions
- **Gamification System**: Achievements, streaks, and leaderboards to motivate saving
- **AI-Powered Insights**: Personalized financial recommendations and spending analysis
- **DeFi Yield Farming**: Automated stablecoin investments for passive income
- **Social Challenges**: Group savings challenges with friends and family
- **Blockchain Transparency**: All transactions recorded on Morph L2 for verification

## 🛠 Tech Stack

- **Frontend**: Next.js 15, TypeScript, Tailwind CSS, Framer Motion
- **Backend**: Node.js, Prisma ORM, PostgreSQL, Redis
- **Blockchain**: Morph L2, Hardhat, Solidity, Ethers.js
- **Web3**: Wagmi, Viem, RainbowKit
- **AI**: OpenAI GPT-4 for financial insights
- **Real-time**: Socket.io for live updates

## 🏗 Project Structure

```
morphsave/
├── src/
│   ├── app/                 # Next.js app directory
│   ├── components/          # React components
│   └── lib/                 # Utility libraries
├── contracts/               # Solidity smart contracts
├── test/                    # Smart contract tests
├── scripts/                 # Deployment scripts
├── prisma/                  # Database schema
└── lib/                     # Shared utilities
```

## 🚀 Getting Started

### Prerequisites

- Node.js 18+ (Note: Hardhat may show warnings with Node.js 23+)
- Docker and Docker Compose
- PostgreSQL and Redis (or use Docker)

### Installation

1. **Clone and install dependencies**:
```bash
cd morphsave
npm install --legacy-peer-deps
```

2. **Set up environment variables**:
```bash
cp .env.example .env.local
# Edit .env.local with your actual API keys and configuration
```

3. **Start database services**:
```bash
npm run docker:up
```

4. **Set up database**:
```bash
npm run db:generate
npm run db:push
```

5. **Compile smart contracts**:
```bash
npm run hardhat:compile
```

6. **Start development server**:
```bash
npm run dev
```

## 📝 Environment Variables

Copy `.env.example` to `.env.local` and fill in the following:

- `MORPH_RPC_URL`: Morph L2 RPC endpoint
- `PRIVATE_KEY`: Your wallet private key for contract deployment
- `OPENAI_API_KEY`: OpenAI API key for AI insights
- `DATABASE_URL`: PostgreSQL connection string
- `NEXTAUTH_SECRET`: NextAuth.js secret for authentication

## 🔧 Development Commands

```bash
# Database
npm run db:generate     # Generate Prisma client
npm run db:push         # Push schema to database
npm run db:migrate      # Create and run migrations
npm run db:studio       # Open Prisma Studio

# Smart Contracts
npm run hardhat:compile # Compile contracts
npm run hardhat:test    # Run contract tests
npm run hardhat:deploy  # Deploy to Morph L2

# Docker
npm run docker:up       # Start PostgreSQL and Redis
npm run docker:down     # Stop services
```

## 🏆 Hackathon Submission

This project is built for the **Morph Consumer Buildathon** focusing on:
- Consumer-friendly blockchain applications
- Gamification for user engagement
- Real-world utility and adoption
- Transparent financial operations

## 📄 License

This project is licensed under the MIT License.