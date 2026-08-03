# LOOP/16

A collaborative daily 16-step drum sequencer on Base. Each wallet can add up to five notes per UTC day. There is no token, prize, wager, or app fee; users only pay Base network gas.

## Local development

```bash
npm install
npm run dev
```

## Production build

```bash
npm run build
```

Netlify settings are included in `netlify.toml`.

## Deployment order

1. Deploy `contracts/Loop16.sol` to Base Mainnet in Remix.
2. Set the address in `src/config/contract.ts`.
3. Add the Base App ID meta tag to `index.html`.
4. Set the Builder Code fallback in `src/config/wagmi.ts`.
5. Deploy the frontend to Netlify.
