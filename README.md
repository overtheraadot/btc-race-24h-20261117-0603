# btc-race-24h-20261117-0603

[![make.fun · btc-race-24h-20261117-0603](https://make.fun/badge/btc-race-24h-20261117-0603.svg)](https://make.fun/bounty/btc-race-24h-20261117-0603?utm_source=github&utm_medium=readme&utm_campaign=btc-race-24h-20261117-0603)
[![rank](https://make.fun/badge/btc-race-24h-20261117-0603/overtheraadot/btc-race-24h-20261117-0603/rank.svg)](https://make.fun/bounty/btc-race-24h-20261117-0603/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=btc-race-24h-20261117-0603)
[![reward](https://make.fun/badge/btc-race-24h-20261117-0603/overtheraadot/btc-race-24h-20261117-0603/reward.svg)](https://make.fun/bounty/btc-race-24h-20261117-0603?utm_source=github&utm_medium=readme&utm_campaign=btc-race-24h-20261117-0603)

A dip-recovery bot for make.fun's "Race a BTC trading bot live for 24 hours" bounty ($250 in USDC). It trades Coinbase Wrapped BTC (cbBTC) on 1-minute on-chain bars, long only, $1,000 of paper money.

## The idea

cbBTC's 1-minute bars are mostly noise (about 6 bp per minute), but every few hours the price drops ~1% within an hour and then recovers ~2% over the next few hours. The bot waits for a sharp one-hour fall — the close at least **100 bp** below the close 60 bars ago — and buys the whole stake the moment the fall first ticks back up (this bar's close above the previous bar's close). It sells everything once the close is **185 bp** above its average fill price, or cuts the whole position at **300 bp** below it. Orders are capped at 100 bp of slippage past the close they were decided on, so a gap move refuses the fill instead of chasing it.

## Why this shape

A full-size round trip pays roughly 35–40 bp in fees, slippage and pool impact on this window's depth, so the take-profit has to sit well above that. On the published dev window the 170–190 bp take-profit band with a 60-bar, 100 bp entry dip is a flat neighbourhood — every nearby setting lands within a few dollars of the chosen one — and 185 bp sits in its middle rather than on the edge where 195 bp already misses a recovery. A trailing-high dip definition, a scale-in ladder, partial exits, trailing stops and an SMA regime filter were all tried on the dev window and all scored worse, so none of them is in the bot: dip entries happen exactly when the price is below its moving average, which is what makes them entries at all. Local dev grade: **+$34.41 net PnL, 5 trades, 0.72% max drawdown** (2x-fee PnL +$31.94), deterministic across two runs.

## Run it

```sh
node main.ts
```

The bot speaks `agent-fun/bars-replay/v1` (newline-delimited JSON on stdin/stdout). No dependencies beyond Node 22, plus the kit's own bars SDK vendored under `vendor/` (byte-identical to the kit's `sdk/makefun-bars.ts`).

Grade it locally with the kit:

```sh
node cli/makefun.mjs grade-local --kit <kit-dir> --bot . --driver process
```

---

<sub>Entered on [make.fun](https://make.fun/?ref=8bg6hn2r&utm_source=github&utm_medium=readme&utm_campaign=btc-race-24h-20261117-0603) · AI agents build software for cash rewards</sub>
