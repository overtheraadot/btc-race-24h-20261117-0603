// Dip-ladder mean-reversion bot for make.fun's btc-race-24h-20261117-0603.
//
// Idea: cbBTC on this pool drifts slowly (about 6 bps of noise per minute) but
// every few hours it drops ~1% in an hour and then recovers ~2% over the next
// few hours. The bot waits for a sharp one-hour fall, buys the whole stake the
// moment the fall first ticks back up, and sells the whole position once it has
// recovered a fixed distance above its average fill price. It never shorts, never
// uses leverage, never holds more than one position, and every decision is a pure
// function of the bars seen so far (integer arithmetic only), so two runs agree
// byte for byte.
//
//   Entry: the close has fallen at least DIP_BPS below the close 60 bars ago,
//          and this bar's close is above the previous bar's close (the first
//          uptick after the fall). Buy with all cash.
//   Exit:  the close is at least TP_BPS above the position's average fill price,
//          or at least STOP_BPS below it (hard stop). Sell the whole position.
//   Orders are capped at MAX_SLIPPAGE_BPS past the close they were decided on,
//          so a gap move refuses the fill instead of chasing it.
//
// Why these numbers: a full-size round trip pays roughly 35-40 bps in fees,
// slippage and pool impact on this window's depth, so the take-profit has to be
// well above that. On the published dev window the 170-190 bp take-profit band
// with a 60-bar, 100 bp entry dip is a flat neighbourhood (all nearby settings
// land within a few dollars of each other), and 185 bp sits in its middle rather
// than on the edge where 195 bp already misses a recovery. A trailing-high dip
// definition, a scale-in ladder, partial exits, trailing stops and an SMA regime
// filter were all tried on the dev window and all scored worse, so none of them
// is in the bot: the entries happen exactly when the price is below its moving
// average, which is what makes them entries at all.

import { runBars, type BarsState, type Batch, type BuyInput, type SellInput } from './vendor/makefun-bars.ts';

const SYMBOL = 'CBBTC';
/** The fall, in bps, the close must have made over LOOKBACK_BARS bars to buy. */
const DIP_BPS = 100n;
/** Bars back the fall is measured over. */
const LOOKBACK_BARS = 60;
/** The gain, in bps over the average fill price, that sells the position. */
const TP_BPS = 185n;
/** The loss, in bps under the average fill price, that stops the position out. */
const STOP_BPS = 300n;
/** Orders refuse a fill further than this past the close they were decided on. */
const MAX_SLIPPAGE_BPS = 100;

/** Closes seen so far, oldest first, as raw price integers. */
const closes: bigint[] = [];
/** Average fill price of the open position (raw price integers), 0n when flat. */
let avgFillPrice = 0n;
/** Quantity held, in the symbol's qty units, tracked from the fills we are sent. */
let heldQty = 0n;

await runBars({
  onBatch(state: BarsState, batch: Batch) {
    // Fold this batch's fills into the average fill price before deciding.
    for (const fill of batch.fills) {
      if (fill.symbol !== SYMBOL || fill.status !== 'filled') continue;
      const price = BigInt(fill.price);
      const qty = BigInt(fill.qty);
      if (fill.side === 'buy' && qty > 0n) {
        avgFillPrice = heldQty === 0n ? price : (avgFillPrice * heldQty + price * qty) / (heldQty + qty);
        heldQty += qty;
      } else if (fill.side === 'sell') {
        heldQty -= qty;
        if (heldQty <= 0n) {
          heldQty = 0n;
          avgFillPrice = 0n;
        }
      }
    }

    for (const bar of batch.bars) {
      if (bar.symbol === SYMBOL) closes.push(BigInt(bar.c));
    }
    if (state.warmingUp) return [];

    const held = state.positions.get(SYMBOL);
    const close = state.close(SYMBOL);
    if (close === null) return [];
    const n = closes.length;

    if (held !== undefined && held.qty > 0n) {
      // Holding: sell the whole position at the take-profit or the hard stop.
      const avg = avgFillPrice > 0n ? avgFillPrice : close;
      const gainBps = ((close - avg) * 10000n) / avg;
      if (gainBps >= TP_BPS || gainBps <= -STOP_BPS) {
        const sell: SellInput = { side: 'sell', symbol: SYMBOL, qty: held.qty, max_slippage_bps: MAX_SLIPPAGE_BPS };
        return [sell];
      }
      return [];
    }

    // Flat: buy the dip, but only on the first uptick after a sharp one-hour fall.
    if (n <= LOOKBACK_BARS) return [];
    const hourAgo = closes[n - 1 - LOOKBACK_BARS]!;
    const prevClose = closes[n - 2]!;
    const fallBps = ((hourAgo - close) * 10000n) / hourAgo;
    if (fallBps < DIP_BPS) return [];
    if (close <= prevClose) return [];

    const cash = state.cash;
    if (cash < BigInt(state.hello.fees.min_notional_quote_units)) return [];
    const buy: BuyInput = { side: 'buy', symbol: SYMBOL, notional_quote_units: cash, max_slippage_bps: MAX_SLIPPAGE_BPS };
    return [buy];
  },
});
