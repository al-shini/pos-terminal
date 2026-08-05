/**
 * Simulation of what happens after CashDro says "Finished".
 *
 * The machine is not reachable from here, so instead of driving hardware these
 * tests drive the settlement decision tree against a fake server that can fail
 * in each of the ways the real one has. Every branch must end either with the
 * sale closed or with a named, staff-visible hold — never by quietly returning
 * the customer to the cart with their cash inside the machine.
 *
 * Run: node scripts/cashdro-settlement-test.js
 */
const fs = require('fs');
const path = require('path');

const load = (file, names) => {
    const source = fs.readFileSync(path.join(__dirname, '..', 'src', 'utils', file), 'utf8')
        .replace(/export default[\s\S]*$/, '')
        .replace(/export const/g, 'const');
    // eslint-disable-next-line no-new-func
    return new Function(`${source}; return { ${names.join(', ')} };`)();
};

const { roundToCashDro, reconcileCashDro } = load('cashRounding.js',
    ['roundToCashDro', 'reconcileCashDro']);
const { settleCollection, MAX_RECORD_ATTEMPTS, createOnceGate } = load('cashDroSettlement.js',
    ['settleCollection', 'MAX_RECORD_ATTEMPTS', 'createOnceGate']);

let failures = 0;
const check = (name, actual, expected) => {
    const ok = JSON.stringify(actual) === JSON.stringify(expected);
    if (!ok) {
        failures++;
        console.error(`FAIL  ${name}\n        expected ${JSON.stringify(expected)}\n        actual   ${JSON.stringify(actual)}`);
    } else {
        console.log(`ok    ${name}`);
    }
};

/** No real waiting: the backoff schedule is asserted separately. */
const slept = [];
const sleep = (ms) => { slept.push(ms); return Promise.resolve(); };

/**
 * A stand-in for the sale on the server.
 *
 * Mirrors the real contract: submitting a payment with a source key already on
 * the sale replays the existing state instead of banking the money twice.
 */
const makeServer = ({ total, paid = 0, failSubmits = 0, failClose = false, submitError = 'network error' }) => {
    const state = { total, paid, payments: [], submits: 0, closes: 0, closed: false };
    return {
        state,
        submitPayment: async (payload) => {
            state.submits++;
            if (state.submits <= failSubmits) {
                throw new Error(submitError);
            }
            const already = state.payments.find((p) => p.sourceKey === payload.sourceKey);
            if (!already) {
                state.payments.push(payload);
                state.paid += payload.amount;
            }
            const change = state.paid - state.total;
            return {
                closeTrx: change >= 0,
                trx: {
                    totalafterdiscount: state.total,
                    paidamt: state.paid,
                    customerchange: change >= 0 ? change : null
                }
            };
        },
        closeSale: async () => {
            state.closes++;
            if (failClose) {
                throw new Error('close failed');
            }
            state.closed = true;
        }
    };
};

const run = async (opts) => {
    const {
        total, inserted, dispensed, changeNotAvailable = 0,
        paid = 0, failSubmits = 0, failClose = false, cashier = false,
        // What the machine was actually told to collect. Defaults to the whole
        // outstanding balance; a cashier can target part of it.
        collect
    } = opts;
    const expectedAmount = roundToCashDro(collect != null ? collect : total - paid);
    const reconciliation = reconcileCashDro({
        totalInCents: inserted * 100,
        totalOutCents: dispensed * 100,
        changeNotAvailableCents: changeNotAvailable * 100,
        expected: expectedAmount
    });
    const server = makeServer({ total, paid, failSubmits, failClose });
    const settlement = await settleCollection({
        reconciliation,
        expectedAmount,
        cashdroId: 'OP-1',
        buildPayload: (amount) => ({ amount, sourceKey: 'CASHDRO-OP-1' }),
        submitPayment: server.submitPayment,
        closeSale: cashier ? null : server.closeSale,
        requireFullSettlement: !cashier,
        sleep
    });
    return { settlement, server: server.state, expectedAmount };
};

(async () => {
    /* ---- the happy path ---- */
    {
        const { settlement, server } = await run({ total: 79, inserted: 100, dispensed: 21 });
        check('79 sale, 100 in, 21 out -> settled', settlement.outcome, 'settled');
        check('  sale is closed', server.closed, true);
        check('  banked once', server.payments.length, 1);
        check('  payment is the gross inserted', server.payments[0].amount, 100);
    }

    /* ---- incident 1: the machine gives back the whole sale total ----
       70 due, 100 in, 70 back means it only ever kept 30. Recording that as a
       settled 70 sale is the bug that started all of this. */
    {
        const { settlement } = await run({ total: 70, inserted: 100, dispensed: 70 });
        check('70 sale that returned 70 -> mismatch', settlement.outcome, 'mismatch');
        check('  reports what was actually kept', settlement.amount, 30);
    }
    {
        const { server } = await run({ total: 70, inserted: 100, dispensed: 70 });
        check('  and never touches the sale', server.submits, 0);
    }

    /* ---- incident 2: cash taken, payment cannot be recorded ---- */
    {
        slept.length = 0;
        const { settlement, server } = await run({
            total: 79, inserted: 100, dispensed: 21, failSubmits: 99
        });
        check('server refuses every submit -> not-recorded', settlement.outcome, 'not-recorded');
        check('  tried the full retry budget', server.submits, MAX_RECORD_ATTEMPTS);
        check('  backed off between attempts', slept, [1000, 2000, 3000, 4000]);
        check('  never closed a sale it could not pay for', server.closed, false);
        check('  holds the net cash figure', settlement.amount, 79);
    }

    /* ---- a blip that clears: must recover, and must bank exactly once ---- */
    {
        const { settlement, server } = await run({
            total: 79, inserted: 100, dispensed: 21, failSubmits: 2
        });
        check('submit fails twice then succeeds -> settled', settlement.outcome, 'settled');
        check('  banked exactly once', server.payments.length, 1);
        check('  sale is closed', server.closed, true);
    }

    /* ---- the retry that the server has already seen ----
       Response lost on the wire, client retries the same source key. The sale
       must not be charged twice. */
    {
        const server = makeServer({ total: 79 });
        await server.submitPayment({ amount: 100, sourceKey: 'CASHDRO-OP-1' });
        const replay = await server.submitPayment({ amount: 100, sourceKey: 'CASHDRO-OP-1' });
        check('replayed source key does not double-bank', server.state.paid, 100);
        check('  replay still reports the sale as closeable', replay.closeTrx, true);
    }

    /* ---- paid, but the close/print failed ----
       Materially different from lost cash: the money is on the sale. */
    {
        const { settlement, server } = await run({
            total: 79, inserted: 100, dispensed: 21, failClose: true
        });
        check('close fails after a good payment -> not-closed', settlement.outcome, 'not-closed');
        check('  the payment is still on the sale', server.paid, 100);
    }

    /* ---- server and machine disagree about what is left owing ---- */
    {
        // The sale quietly grew after the machine was told what to collect.
        const expectedAmount = roundToCashDro(50);
        const reconciliation = reconcileCashDro({
            totalInCents: 5000, totalOutCents: 0, changeNotAvailableCents: 0, expected: expectedAmount
        });
        const server = makeServer({ total: 120 });
        const settlement = await settleCollection({
            reconciliation,
            expectedAmount,
            cashdroId: 'OP-2',
            buildPayload: (amount) => ({ amount, sourceKey: 'CASHDRO-OP-2' }),
            submitPayment: server.submitPayment,
            closeSale: server.closeSale,
            sleep
        });
        check('payment lands but sale still owes -> shortfall', settlement.outcome, 'shortfall');
        check('  says how much is still due', settlement.detail, 'remaining 70.00');
        check('  did not close a half-paid sale', server.state.closed, false);
    }

    /* ---- machine could not give all the change ----
       The customer is owed cash by hand, but the sale itself is settled. */
    {
        const { settlement, server } = await run({
            total: 79, inserted: 100, dispensed: 20.5, changeNotAvailable: 0.5
        });
        check('change short by 0.50 -> still settled', settlement.outcome, 'settled');
        check('  sale is closed', server.closed, true);
    }

    /* ---- a sale whose total is not a round half unit ----
       78.60 rounds to 78.50 on the machine; the reconciliation must accept it
       rather than reading the 0.10 as a mismatch. */
    {
        const { settlement, expectedAmount } = await run({
            total: 78.6, inserted: 100, dispensed: 21.5
        });
        check('78.60 sale is collected as 78.50', expectedAmount, 78.5);
        check('  and settles cleanly', settlement.outcome, 'settled');
    }

    /* ---- a resolved-but-empty response is not proof of payment ---- */
    {
        let calls = 0;
        const settlement = await settleCollection({
            reconciliation: reconcileCashDro({
                totalInCents: 7900, totalOutCents: 0, changeNotAvailableCents: 0, expected: 79
            }),
            expectedAmount: 79,
            cashdroId: 'OP-3',
            buildPayload: (amount) => ({ amount }),
            submitPayment: async () => { calls++; return undefined; },
            closeSale: async () => { throw new Error('should never close'); },
            sleep
        });
        check('empty submit response -> not-recorded', settlement.outcome, 'not-recorded');
        check('  retried rather than trusting it', calls, MAX_RECORD_ATTEMPTS);
    }

    /* ---- cashier mode keeps its own workflow ----
       A till operator closes the sale on the numpad and may take only part of
       the balance in cash, so neither auto-closing nor the shortfall check
       applies to them. */
    {
        const { settlement, server } = await run({
            total: 79, inserted: 100, dispensed: 21, cashier: true
        });
        check('cashier: payment recorded, sale left open', settlement.outcome, 'recorded');
        check('  did not close the sale behind the cashier', server.closes, 0);
        check('  payment is on the sale', server.paid, 100);
    }
    {
        // Split tender: the machine is told to take 50 of a 120 sale, and does.
        const { settlement, server } = await run({
            total: 120, collect: 50, inserted: 50, dispensed: 0, cashier: true
        });
        check('cashier: part-payment is not an incident', settlement.outcome, 'recorded');
        check('  sale stays open for the rest', server.closed, false);
    }
    {
        // Self-checkout asking for the full balance and getting a partial back
        // is the incident, and stays one.
        const { settlement } = await run({ total: 120, inserted: 50, dispensed: 0 });
        check('self-checkout: short collection is a mismatch', settlement.outcome, 'mismatch');
    }
    {
        // The safety checks that DO still apply to a cashier.
        const { settlement, server } = await run({
            total: 70, inserted: 100, dispensed: 70, cashier: true
        });
        check('cashier: wrong amount kept is still a mismatch', settlement.outcome, 'mismatch');
        check('  and the sale is untouched', server.submits, 0);
    }
    {
        const { settlement } = await run({
            total: 79, inserted: 100, dispensed: 21, failSubmits: 99, cashier: true
        });
        check('cashier: unrecordable cash is still escalated', settlement.outcome, 'not-recorded');
    }

    /* ---- two poll ticks seeing the same "Finished" state ----
       The status poll awaits the machine on every tick, so a slow reply leaves
       two ticks in flight and both see the collection finish. Settling twice
       closed the sale, then failed to close it again — which showed an error,
       or a staff hold screen, on a sale that had completed and printed. */
    {
        const server = makeServer({ total: 79 });
        const claim = createOnceGate();

        // Both ticks reach the branch; only the one that takes the latch acts.
        const tick = async () => {
            if (!claim()) {
                return { outcome: 'skipped' };
            }
            return settleCollection({
                reconciliation: reconcileCashDro({
                    totalInCents: 10000, totalOutCents: 2100,
                    changeNotAvailableCents: 0, expected: 79
                }),
                expectedAmount: 79,
                cashdroId: 'OP-RACE',
                buildPayload: (amount) => ({ amount, sourceKey: 'CASHDRO-OP-RACE' }),
                submitPayment: server.submitPayment,
                closeSale: server.closeSale,
                sleep
            });
        };

        const [first, second] = await Promise.all([tick(), tick()]);
        const outcomes = [first.outcome, second.outcome].sort().join(',');
        check('overlapping ticks settle exactly once', outcomes, 'settled,skipped');
        check('  the sale is closed once', server.state.closes, 1);
        check('  the payment is banked once', server.state.payments.length, 1);
        check('  no second close to be refused', server.state.paid, 100);
    }

    /* ---- without the latch, the same race produces the reported failure ---- */
    {
        const server = makeServer({ total: 79 });
        const settleTwice = () => settleCollection({
            reconciliation: reconcileCashDro({
                totalInCents: 10000, totalOutCents: 2100,
                changeNotAvailableCents: 0, expected: 79
            }),
            expectedAmount: 79,
            cashdroId: 'OP-RACE2',
            buildPayload: (amount) => ({ amount, sourceKey: 'CASHDRO-OP-RACE2' }),
            submitPayment: server.submitPayment,
            // Second close fails the way the server refuses an already-closed
            // sale, which is what reached the customer as an error.
            closeSale: async () => {
                if (server.state.closed) {
                    throw new Error('Transaction not OPEN, cannot modify');
                }
                return server.closeSale();
            },
            sleep
        });

        const [a, b] = await Promise.all([settleTwice(), settleTwice()]);
        const bad = [a.outcome, b.outcome].filter((o) => o !== 'settled');
        check('unlatched, the second settle does report a failure', bad, ['not-closed']);
        check('  which is why the latch exists', server.state.payments.length, 1);
    }

    /* ---- the latch also stops a give-up racing a settle ---- */
    {
        const claim = createOnceGate();
        check('first caller takes the latch', claim(), true);
        check('every later caller is turned away', [claim(), claim()], [false, false]);
    }

    /* ---- a cancel must beat a tick that is still in flight ----
       Clearing the interval cannot stop a tick already awaiting the machine, so
       a "Finished" arriving after the cash was handed back would otherwise
       record a payment for money the customer is holding. */
    {
        const server = makeServer({ total: 79 });
        const claim = createOnceGate();

        claim(); // the cancel gets there first

        const lateTick = async () => {
            if (!claim()) {
                return { outcome: 'skipped' };
            }
            return settleCollection({
                reconciliation: reconcileCashDro({
                    totalInCents: 10000, totalOutCents: 2100,
                    changeNotAvailableCents: 0, expected: 79
                }),
                expectedAmount: 79,
                cashdroId: 'OP-LATE',
                buildPayload: (amount) => ({ amount, sourceKey: 'CASHDRO-OP-LATE' }),
                submitPayment: server.submitPayment,
                closeSale: server.closeSale,
                sleep
            });
        };

        const result = await lateTick();
        check('a tick arriving after a cancel does nothing', result.outcome, 'skipped');
        check('  no payment recorded for returned cash', server.state.payments.length, 0);
        check('  the sale is left open', server.state.closed, false);
    }

    /* ---- every non-settled outcome must be nameable to staff ---- */
    {
        const outcomes = ['mismatch', 'not-recorded', 'shortfall', 'not-closed'];
        const seen = [];
        seen.push((await run({ total: 70, inserted: 100, dispensed: 70 })).settlement);
        seen.push((await run({ total: 79, inserted: 100, dispensed: 21, failSubmits: 99 })).settlement);
        seen.push((await run({ total: 79, inserted: 100, dispensed: 21, failClose: true })).settlement);
        const wellFormed = seen.every((s) => s.cashdroId
            && typeof s.amount === 'number'
            && typeof s.detail === 'string'
            && outcomes.includes(s.outcome));
        check('holds carry an id, an amount and a reason', wellFormed, true);
    }

    console.log(failures === 0
        ? '\nAll CashDro settlement simulations passed.'
        : `\n${failures} failing check(s).`);
    process.exit(failures === 0 ? 0 : 1);
})();
