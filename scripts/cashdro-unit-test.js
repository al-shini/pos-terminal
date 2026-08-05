/**
 * CashDro money-math regression tests.
 *
 * Covers the two incidents that motivated this code:
 *
 *   1. A 70.00 sale where the customer inserted 100.00 and the machine handed
 *      back 70.00. That is what a partial-amount collection looks like from the
 *      customer's side, and nothing in the flow noticed the sale had only been
 *      settled for part of its total.
 *   2. A 79.00 sale that collected correctly but never closed, and whose retry
 *      asked for the full 79.00 a second time with the first collection already
 *      banked.
 *
 * Run: node scripts/cashdro-unit-test.js
 */
const fs = require('fs');
const path = require('path');

// cashRounding.js is an ES module inside a CRA app; strip the export keywords
// so it can be evaluated here without pulling in a bundler.
const source = fs.readFileSync(path.join(__dirname, '..', 'src', 'utils', 'cashRounding.js'), 'utf8')
    .replace(/export default[\s\S]*$/, '')
    .replace(/export const/g, 'const');
// eslint-disable-next-line no-new-func
const { roundToCashDro, fromCashDroCents, reconcileCashDro } = new Function(
    `${source}; return { roundToCashDro, fromCashDroCents, reconcileCashDro };`
)();

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

/* ---- rounding to what the machine can actually handle ---- */

check('rounds down below the quarter', roundToCashDro(12.24), 12.0);
check('rounds up at the quarter', roundToCashDro(12.25), 12.5);
check('stays on the half', roundToCashDro(12.5), 12.5);
check('rounds up above three quarters', roundToCashDro(12.75), 13.0);
check('whole amounts are untouched', roundToCashDro(79), 79);
check('handles junk input', roundToCashDro(undefined), 0);

/* ---- cents conversion ---- */

check('converts minor units', fromCashDroCents(7000), 70);
check('converts a fractional double', fromCashDroCents(2100.0), 21);
check('treats null as zero', fromCashDroCents(null), 0);

/* ---- incident 1: a 70.00 sale where 70.00 came back as change ---- */

const healthy70 = reconcileCashDro({ totalInCents: 10000, totalOutCents: 3000, expected: 70 });
check('70 sale, 100 in, 30 back -> settles 70', healthy70.net, 70);
check('70 sale, 100 in, 30 back -> no mismatch', healthy70.mismatch, false);

const reported70 = reconcileCashDro({ totalInCents: 10000, totalOutCents: 7000, expected: 70 });
check('70 sale, 100 in, 70 back -> only settles 30', reported70.net, 30);
check('70 sale, 100 in, 70 back -> flagged as mismatch', reported70.mismatch, true);

/* ---- incident 2: correct collection on a 79.00 sale ---- */

const sale79 = reconcileCashDro({ totalInCents: 10000, totalOutCents: 2100, expected: 79 });
check('79 sale, 100 in, 21 back -> settles 79', sale79.net, 79);
check('79 sale, 100 in, 21 back -> no mismatch', sale79.mismatch, false);

// The staff member's follow-up 0.50 against the same 79.00 target.
const topUp = reconcileCashDro({ totalInCents: 50, totalOutCents: 0, expected: 79 });
check('0.50 against a 79 target -> flagged as mismatch', topUp.mismatch, true);

/* ---- change the machine owed but could not dispense ---- */
// The machine keeps 80 of a 100 note on a 79.00 sale because it is 1.00 short
// of coins. Staff hand that 1.00 over; the sale itself still settled 79.00.
const shortOfCoins = reconcileCashDro({
    totalInCents: 10000, totalOutCents: 2000, changeNotAvailableCents: 100, expected: 79
});
check('change it could not dispense is not the sale money', shortOfCoins.net, 79);
check('change it could not dispense is not a mismatch', shortOfCoins.mismatch, false);
check('the owed change is reported', shortOfCoins.changeOwed, 1);

/* ---- CashDro only deals in 0.50 steps ---- */
// A 78.60 sale is collected as 78.50, so the reconciliation target must be the
// rounded figure the machine was actually given, not the raw total.
check('78.60 is collected as 78.50', roundToCashDro(78.6), 78.5);
const rounded = reconcileCashDro({
    totalInCents: 10000, totalOutCents: 2150, expected: roundToCashDro(78.6)
});
check('78.60 sale, 100 in, 21.50 back -> no mismatch', rounded.mismatch, false);

/* ---- float noise must not be mistaken for a real discrepancy ---- */

const noisy = reconcileCashDro({ totalInCents: 10000, totalOutCents: 6999.9999, expected: 30 });
check('sub-cent noise is tolerated', noisy.mismatch, false);

const short = reconcileCashDro({ totalInCents: 10000, totalOutCents: 7010, expected: 30 });
check('a 0.10 shortfall is not tolerated', short.mismatch, true);

/* ---- exact change, nothing dispensed ---- */

const exact = reconcileCashDro({ totalInCents: 7900, totalOutCents: 0, expected: 79 });
check('exact payment -> settles the full amount', exact.net, 79);
check('exact payment -> no mismatch', exact.mismatch, false);

/* ---- incident 3: CashDro reports outflows as NEGATIVE numbers ---- */
// The machine's own API convention (its `total` field is totalin + totalout
// for this very reason). A live 50.00 sale — 100.00 in, 50.00 change out —
// arrived as totalout=-5000, and the old subtract-a-magnitude math turned it
// into a net of 150.00, holding the lane over a perfect collection.
const liveSigns = reconcileCashDro({ totalInCents: 10000, totalOutCents: -5000, expected: 50 });
check('live firmware: 50 sale, 100 in, -5000 out -> settles 50', liveSigns.net, 50);
check('live firmware: negative totalout is not a mismatch', liveSigns.mismatch, false);
check('live firmware: dispensed reported as a magnitude', liveSigns.dispensed, 50);

// Negative convention must not mask a REAL short collection either.
const liveShort = reconcileCashDro({ totalInCents: 10000, totalOutCents: -7000, expected: 70 });
check('live firmware: machine kept 30 of a 70 sale -> still a mismatch', liveShort.mismatch, true);
check('live firmware: short collection nets 30', liveShort.net, 30);

// And undispensable change can come through negative too.
const liveOwed = reconcileCashDro({
    totalInCents: 10000, totalOutCents: -2000, changeNotAvailableCents: -100, expected: 79
});
check('live firmware: negative owed change is still not the sale money', liveOwed.net, 79);
check('live firmware: owed change reported as a magnitude', liveOwed.changeOwed, 1);

console.log(failures === 0 ? '\nAll CashDro money-math checks passed.' : `\n${failures} check(s) failed.`);
process.exit(failures === 0 ? 0 : 1);
