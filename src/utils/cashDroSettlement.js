/**
 * What to do with a CashDro collection once the machine says it has finished.
 *
 * From that moment the customer's money is physically inside the machine, so
 * every branch below has to end somewhere accountable — either the sale is
 * settled and closed, or a human is told exactly what the machine is holding.
 * Quietly returning to the cart is not an option: it leaves the store with cash
 * against an open sale and invites the customer to pay for it a second time.
 *
 * Kept free of React and Redux so the whole decision tree can be exercised
 * against a simulated machine and server.
 */

/**
 * A latch that opens for exactly one caller.
 *
 * The CashDro status poll runs on an interval and every tick awaits the
 * machine, so a slow reply lets two ticks be in flight at once and both then
 * see the same "Finished" state. Without this, both settle the same collection:
 * the second one records a payment the server already has, then tries to close
 * a sale the first has just closed. That second close either loses the race to
 * the one still in flight — and the client reads the abort as "could not
 * close", parking a perfectly good sale behind a staff-only hold screen — or it
 * arrives afterwards and the server refuses it because the sale is no longer
 * open, which surfaces as an error on a transaction that completed, printed and
 * is CLOSED in the database.
 *
 * The check and the set are synchronous, so on a single-threaded event loop the
 * first caller into the branch is the only one that proceeds.
 */
export const createOnceGate = () => {
    let taken = false;
    return () => {
        if (taken) {
            return false;
        }
        taken = true;
        return true;
    };
};

/** How many times to push the payment at the server before giving up. */
export const MAX_RECORD_ATTEMPTS = 5;

/** Linear backoff, in ms, for attempt N (1-based): 1s, 2s, 3s, 4s. */
export const recordRetryDelay = (attempt) => attempt * 1000;

/**
 * Push the payment until the server confirms it.
 *
 * `submitPayment` is expected to reject on any failure — a resolved-but-empty
 * response is treated as a failure too, because a payment we cannot see in the
 * response is a payment we cannot prove was recorded.
 */
export const recordPayment = async ({ submitPayment, payload, sleep }) => {
    let lastError;
    for (let attempt = 1; attempt <= MAX_RECORD_ATTEMPTS; attempt++) {
        try {
            const result = await submitPayment(payload);
            if (!result || !result.trx) {
                throw new Error('Server accepted the payment but returned no transaction');
            }
            return result;
        } catch (error) {
            lastError = error;
            if (attempt < MAX_RECORD_ATTEMPTS) {
                await sleep(recordRetryDelay(attempt));
            }
        }
    }
    throw lastError;
};

/**
 * Decide and carry out the outcome of a finished collection.
 *
 * Returns one of:
 *   { outcome: 'settled' }                      sale paid, and closed if asked
 *   { outcome: 'recorded' }                     paid; closing is the cashier's job
 *   { outcome: 'mismatch', ... }                machine kept the wrong amount
 *   { outcome: 'not-recorded', ... }            cash taken, payment never landed
 *   { outcome: 'shortfall', ... }               payment landed but sale still owes
 *   { outcome: 'not-closed', ... }              sale is paid but would not close
 *
 * Everything after the first two means a staff member has to look at it, but
 * they are deliberately distinct: "we are holding cash for an unpaid sale" and
 * "the sale is paid and just needs printing" call for very different actions.
 *
 * `requireFullSettlement` separates the two callers. Self-checkout is
 * single-tender, so a sale still owing money after the machine was asked for
 * the whole balance is an inconsistency to escalate. A cashier can legitimately
 * take part of the balance in cash and the rest another way, and closes the
 * sale themselves, so for them a partial is just a partial.
 */
export const settleCollection = async ({
    reconciliation,
    expectedAmount,
    cashdroId,
    buildPayload,
    submitPayment,
    closeSale,
    requireFullSettlement = true,
    sleep
}) => {
    const { received, net } = reconciliation;

    // Recording anything now would close a sale against money that is not in
    // the machine. Stop before touching the sale.
    if (reconciliation.mismatch) {
        return {
            outcome: 'mismatch',
            amount: net,
            cashdroId,
            detail: `expected ${expectedAmount.toFixed(2)}, machine settled ${net.toFixed(2)}`
        };
    }

    let result;
    try {
        result = await recordPayment({
            submitPayment,
            payload: buildPayload(received),
            sleep
        });
    } catch (error) {
        return {
            outcome: 'not-recorded',
            amount: net,
            cashdroId,
            detail: (error && error.message) || String(error || '')
        };
    }

    const customerChange = result.trx ? result.trx.customerchange : null;
    const fullyPaid = !!result.closeTrx || (customerChange != null && customerChange >= 0);

    if (!fullyPaid && requireFullSettlement) {
        // The machine was asked for the entire balance, so a sale that is still
        // short means the server and the machine disagree about this sale.
        const stillDue = Math.max(0,
            (result.trx.totalafterdiscount || 0) - (result.trx.paidamt || 0));
        return {
            outcome: 'shortfall',
            amount: net,
            cashdroId,
            detail: `remaining ${stillDue.toFixed(2)}`
        };
    }

    if (!closeSale) {
        return { outcome: 'recorded', amount: net, cashdroId };
    }

    try {
        await closeSale();
    } catch (error) {
        // The money is accounted for — the payment is on the sale. Only the
        // close/print failed, which is a much milder problem than lost cash and
        // must not be reported to the customer as if their money vanished.
        return {
            outcome: 'not-closed',
            amount: net,
            cashdroId,
            detail: (error && error.message) || String(error || '')
        };
    }

    return { outcome: 'settled', amount: net, cashdroId };
};

export default settleCollection;
