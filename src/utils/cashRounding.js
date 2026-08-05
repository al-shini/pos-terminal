/**
 * CashDro (and any coin/note-based cash machine) only accepts/dispenses in
 * 0.50 steps — it has no 0.05/0.10/0.25 coins loaded:
 *
 *   fractional 0.00–0.24  -> rounds down to .00
 *   fractional 0.25–0.74  -> rounds to .50
 *   fractional 0.75–0.99  -> rounds up to the next whole unit (1.00)
 *
 * On a self-checkout the backend now rounds the sale total by this same rule
 * (CashRounding.toCashStep on pos-backend, mirrored here), so the balance the
 * machine is asked for is already a whole step and this is a no-op. It stays as
 * the lane's safety net: if the total ever arrives unrounded, expecting the
 * rounded figure is what keeps the terminal and the machine talking about the
 * same amount instead of flagging good cash as a mismatch.
 *
 * Implemented with integer-cent math (not floating point) to avoid
 * rounding-boundary drift, e.g. 12.25 must round up to 12.50, not down.
 */
/** The smallest amount a CashDro can accept or hand back. */
export const CASH_STEP = 0.5;

export const roundToCashDro = (amount) => {
    const cents = Math.round((Number(amount) || 0) * 100);
    const halfSteps = Math.round(cents / 50); // 50 cents = a 0.50 step
    return (halfSteps * 50) / 100;
};

/** CashDro reports every amount in minor units. */
export const fromCashDroCents = (cents) => Math.round(Number(cents) || 0) / 100;

/**
 * Work out what a finished CashDro operation actually settled, and whether that
 * agrees with what the sale asked the machine to collect.
 *
 * `net` is what the sale really got paid: cash taken in, less change handed
 * back, less any change the machine owed but could not dispense (a staff member
 * hands that part over by hand, so it is not the sale's money either).
 *
 * `mismatch` is the safety net for the whole flow. A machine that keeps a
 * different amount than the sale needed means the customer was charged the
 * wrong amount, and that has to surface loudly instead of being rounded away.
 * The tolerance is half a minor unit, purely to absorb float noise.
 */
export const reconcileCashDro = ({ totalInCents, totalOutCents, changeNotAvailableCents, expected }) => {
    // CashDro reports movements from the machine's own point of view: money in
    // is positive and money out is NEGATIVE (its API carries a `total` field
    // precisely because total = totalin + totalout). The arithmetic below
    // subtracts the outflows itself, so every figure must be taken as a
    // magnitude — feeding the raw negative totalout through turned "inserted
    // 100, change 50" into a net of 150 (100 - (-50)) on real hardware, which
    // flagged a perfectly good collection as a mismatch and held the lane.
    // abs() also keeps this correct if some firmware reports outflows positive.
    const received = Math.abs(fromCashDroCents(totalInCents));
    const dispensed = Math.abs(fromCashDroCents(totalOutCents));
    const changeOwed = Math.abs(fromCashDroCents(changeNotAvailableCents));
    const net = Math.round((received - dispensed - changeOwed) * 100) / 100;
    return {
        received,
        dispensed,
        changeOwed,
        net,
        mismatch: Math.abs(net - (Number(expected) || 0)) > 0.005
    };
};

export default roundToCashDro;
