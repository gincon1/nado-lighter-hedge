# Nado-Lighter Hedge Bot

A hedge trading bot between Nado and Lighter perpetual DEX.

## Features

- Nado limit order (Maker) -> Lighter market order (Taker) hedge
- 60s timeout auto-cancel and re-place mechanism
- State machine management
- Real-time Dashboard UI

## Requirements

- Node.js >= 18
- Python 3.8+ (for Lighter SDK)
- Lighter Python SDK: `pip install git+https://github.com/elliottech/lighter-python.git`

## Installation

```bash
# Clone
git clone https://github.com/gincon1/nado-lighter-hedge.git
cd nado-lighter-hedge

# Install dependencies
npm install

# Install server dependencies
cd server && npm install && cd ..

# Install dashboard dependencies
cd dashboard && npm install && cd ..
```

## Configuration

Copy `.env.example` to `.env`:

```bash
cp .env.example .env
```

Edit `.env` file:

```
# Nado
NADO_PRIVATE_KEY=your_private_key
NADO_NETWORK=inkMainnet

# Lighter
API_KEY_PRIVATE_KEY=your_lighter_api_key
LIGHTER_ACCOUNT_INDEX=your_account_index
LIGHTER_API_KEY_INDEX=2

# Hedge settings
HEDGE_COIN=BTC
HEDGE_SIZE=0.0013
NADO_ORDER_TIMEOUT=60000
NADO_MAX_RETRIES=3
LIGHTER_MAX_SLIPPAGE=0.005
HEDGE_LOOP_HOLD_TIME=10
HEDGE_LOOP_INTERVAL=10
```

## Usage

### CLI Mode

```bash
# Single hedge (open + close)
node strategies/run-hedge.js once BTC 0.0013

# Loop hedge 5 rounds
node strategies/run-hedge.js loop BTC 0.0013 5

# Help
node strategies/run-hedge.js help
```

### Dashboard Mode

**Terminal 1 - Start API Server:**

```bash
cd nado-lighter-hedge
node server/index.js
```

Server runs at http://localhost:3001

**Terminal 2 - Start Dashboard:**

```bash
cd nado-lighter-hedge/dashboard
npm run dev
```

Dashboard runs at http://localhost:3000

Open http://localhost:3000 in browser.

## Project Structure

```
nado-lighter-hedge/
├── strategies/          # Core strategy
│   ├── run-hedge.js     # CLI entry
│   ├── hedge-strategy.js
│   ├── nado-order-manager.js
│   └── lighter-hedger.js
├── server/              # API server
├── dashboard/           # React frontend
├── nado-sdk/            # Nado SDK
├── lighter-sdk/         # Lighter SDK
└── docs/                # Documentation
```

## Supported Coins

| Coin | Nado Product ID |
|------|-----------------|
| BTC  | 2 |
| ETH  | 4 |
| SOL  | 8 |

## Fee Structure

- Nado Maker: -0.08% (rebate)
- Lighter Taker: 0.1%

## License

MIT
