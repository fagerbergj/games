# Games Server

A Next.js-based games server with Kings Corner implementation.

## Getting Started

### Prerequisites

- Node.js 20+
- npm

### Installation

```bash
npm install
```

### Development

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to view the app.

## Game Rules

- **Goal**: Fill the 4x4 grid with cards in valid positions
- **Kings (K)**: Must go in corners (4 spots)
- **Queens (Q)**: Must go on top/bottom edges (6 spots)
- **Jacks (J)**: Must go on left/right edges (6 spots)
- **Number cards (2-10)**: Go in center (4 spots)
- **Win**: Clear all cards by removing pairs adding to 10 or single 10s
- **Lose**: Can't place a drawn card or run out of cards

## Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run start` - Start production server
- `npm run lint` - Run ESLint
- `npm run test` - Run tests

## Project Structure

```
app/
├── games/
│   └── kings-corner/
│       ├── __tests__/        # Test files
│       ├── components/       # React components
│       ├── hooks/           # Custom hooks
│       ├── lib/            # Game logic
│       └── page.tsx
├── icon.tsx
├── layout.tsx
├── page.tsx
└── globals.css
```

## Technologies

- **Next.js 16** - React framework
- **TypeScript** - Type safety
- **Tailwind CSS** - Styling
- **Vitest** - Testing

## Docker

Build and run with Docker:

```bash
docker build -t games-server .
docker run -p 3000:3000 games-server
```

## License

MIT
