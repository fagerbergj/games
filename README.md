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
apps/
└── game-server/            # WebSocket server for multiplayer rooms (no React)
libs/
└── game-rules/src/
    └── blackjack/          # Pure rules engine (no React/DOM), imported as @game-rules/blackjack
```

Game rules that a server must also run live in `libs/game-rules` as framework-free
TypeScript. State is plain JSON, and every transition that shuffles takes an injected
`rng`, so a seeded run replays exactly. Lint blocks React, Next and browser globals there.

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

## Multiplayer server

`apps/game-server` is a WebSocket server that owns multiplayer game state; the page at
`/games/blackjack/multiplayer` talks to it. Rooms live in memory, keyed by a 6-character
code, and a room nobody is connected to is dropped after 10 minutes.

Run it next to `npm run dev`:

```bash
npm run game-server                                        # builds, then listens on :3001
NEXT_PUBLIC_GAME_SERVER_URL=ws://localhost:3001 npm run dev
```

Without `NEXT_PUBLIC_GAME_SERVER_URL` (it is read at build time) the page connects to
`/ws` on its own origin, so production needs the proxy to send `/ws` to the server.
`publish.yml` pushes the image as `ghcr.io/fagerbergj/game-server`. Compose, with Traefik
routing `/ws` on the games host to it (no prefix strip; the server accepts any path, and
Traefik passes WebSocket upgrades through by default):

```yaml
services:
  game-server:
    image: ghcr.io/fagerbergj/game-server:latest
    container_name: game-server
    restart: unless-stopped
    labels:
      - traefik.enable=true
      - traefik.http.routers.game-server.rule=Host(`games.example.com`) && PathPrefix(`/ws`)
      - traefik.http.services.game-server.loadbalancer.server.port=3001
```

Traefik ranks routers by rule length, so this longer rule wins over the site's plain `Host` router.

### Protocol

JSON text frames; types live in `libs/game-rules/src/blackjack/protocol.ts`.

| Client sends | Effect |
| --- | --- |
| `create {name}` | New room; the creator is host |
| `join {code, name, token?}` | Join a room; a `token` from an earlier `joined` re-claims that player's seat and host role |
| `sit {seat}` | Take seat 0-4 (moving is allowed between rounds; sitting mid-round waits for the next one) |
| `bet {amount}` | Wager on your seat; the deal goes out once every seated player has bet |
| `start` | Host deals now; seats without a bet sit the round out |
| `action {action}` | `hit` `stand` `double` `split` `surrender` on your turn, `insurance` `declineInsurance` `evenMoney` in the insurance phase, `buyBackIn` when broke |
| `newRound` | Host clears a finished round |
| `leave` | Give up your seat and leave |

The server replies `joined {code, token}` once, `state {room}` after every change (filtered per
player: no shoe, the dealer's face-down card replaced by a placeholder), and `error {message}`
for anything it refuses. If the host disconnects, any player may `start`/`newRound`; a player
disconnected for 30 seconds, or gone, has their insurance declined and hands stood for them.

## License

MIT
