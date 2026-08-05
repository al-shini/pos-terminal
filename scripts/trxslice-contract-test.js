/**
 * Guards the thunk/reducer contract that broke the 79 ILS sale.
 *
 * The original failure was one missing `return` on the network-error path of
 * submitPayment. Without it the thunk resolved `undefined`, which RTK treats as
 * SUCCESS; the .fulfilled reducer then threw reading the payload, Immer threw
 * the whole update away — including `paymentSubmitting = false` — and the
 * re-entrancy guard silently refused every later payment on that terminal. The
 * customer's cash was already in the machine.
 *
 * That is invisible in review and impossible to notice at runtime until a till
 * is stuck, so it is checked mechanically here instead:
 *
 *   1. No error path inside a thunk may fall through without rejecting.
 *   2. No .fulfilled reducer may dereference a payload it has not checked.
 *
 * Run: node scripts/trxslice-contract-test.js
 */
const fs = require('fs');
const path = require('path');

// Takes an optional path so the checker can be pointed at a mutated copy to
// confirm it still detects the bug it was written for.
const SLICE = process.argv[2] || path.join(__dirname, '..', 'src', 'store', 'trxSlice.js');
const source = fs.readFileSync(SLICE, 'utf8');

let failures = 0;
const fail = (msg) => { failures++; console.error(`FAIL  ${msg}`); };
const pass = (msg) => console.log(`ok    ${msg}`);

const lineOf = (index) => source.slice(0, index).split('\n').length;

/** Index just past the `}` matching the `{` at `open`. */
const matchBrace = (open) => {
    let depth = 0;
    for (let i = open; i < source.length; i++) {
        if (source[i] === '{') depth++;
        else if (source[i] === '}') {
            depth--;
            if (depth === 0) return i;
        }
    }
    return -1;
};

/* ------------------------------------------------------------------ *
 * 1. Every error path rejects
 * ------------------------------------------------------------------ */

const catchBodies = [];
const catchRe = /\.catch\(\s*\(?\s*\w+\s*\)?\s*=>\s*\{/g;
let m;
while ((m = catchRe.exec(source)) !== null) {
    const open = source.indexOf('{', m.index + m[0].length - 1);
    const close = matchBrace(open);
    catchBodies.push({ chainStart: m.index, start: open, end: close, line: lineOf(m.index) });
}

if (catchBodies.length === 0) {
    fail('found no .catch handlers to check — has the file been restructured?');
} else {
    pass(`found ${catchBodies.length} error handlers to check`);
}

const strip = (text) => text.replace(/\/\/[^\n]*/g, '').replace(/\/\*[\s\S]*?\*\//g, '');

/** Index of the `(` matching the `)` at `close`, scanning backwards. */
const matchParenBack = (close) => {
    let depth = 0;
    for (let i = close; i >= 0; i--) {
        if (source[i] === ')') depth++;
        else if (source[i] === '(') {
            depth--;
            if (depth === 0) return i;
        }
    }
    return -1;
};

/**
 * Is the `{` at `open` a control-flow body rather than an object literal?
 *
 * Matters because `notify({ msg, sev })` looks exactly like a branch body to a
 * brace scanner, and flagging those would bury the real findings.
 */
const isControlBlock = (open) => {
    let i = open - 1;
    while (i >= 0 && /\s/.test(source[i])) i--;
    if (i < 0) return false;
    if (source[i] === ')') {
        const lp = matchParenBack(i);
        if (lp === -1) return false;
        let j = lp - 1;
        while (j >= 0 && /\s/.test(source[j])) j--;
        return /\b(if|while|for|catch|switch)$/.test(source.slice(Math.max(0, j - 8), j + 1));
    }
    return /\belse$/.test(source.slice(Math.max(0, i - 5), i + 1));
};

/** Control blocks directly inside [start, end], in source order. */
const controlBlocks = (start, end) => {
    const blocks = [];
    for (let i = start + 1; i < end; i++) {
        if (source[i] !== '{') continue;
        const close = matchBrace(i);
        if (close === -1 || close > end) continue;
        if (isControlBlock(i)) blocks.push({ start: i, end: close });
    }
    return blocks;
};

/**
 * Is the promise chain this handler terminates actually returned by the thunk?
 *
 * Only a returned chain decides the thunk's outcome. Fire-and-forget side
 * effects — the receipt print, the WhatsApp send — hang off their own chains
 * and cannot fulfil anything, so holding them to this rule would be noise.
 */
const chainIsReturned = (catchIdx) => {
    // Walk back to the start of the statement this handler sits in, then see
    // whether that statement is a `return`.
    let paren = 0;
    let brace = 0;
    let bracket = 0;
    const startsWithReturn = (from) => /^\s*return\b/.test(strip(source.slice(from, catchIdx)));
    for (let i = catchIdx - 1; i >= 0; i--) {
        const c = source[i];
        if (c === ')') paren++;
        else if (c === '(') { if (paren === 0) return false; paren--; }
        else if (c === ']') bracket++;
        else if (c === '[') { if (bracket === 0) return false; bracket--; }
        else if (c === '}') brace++;
        else if (c === '{') {
            if (brace === 0) return startsWithReturn(i + 1);
            brace--;
        } else if (c === ';' && paren === 0 && brace === 0 && bracket === 0) {
            return startsWithReturn(i + 1);
        }
    }
    return false;
};

const returnedCatches = catchBodies.filter((b) => chainIsReturned(b.chainStart));
pass(`${returnedCatches.length} of them decide a thunk's outcome`);

returnedCatches.forEach((body) => {
    const blocks = controlBlocks(body.start, body.end);
    // Only the handler's LAST statement decides its outcome — anything before
    // it (a logging guard, a poll reschedule) is allowed to fall through to it.
    const trailing = blocks.filter((b) => !blocks.some((o) => o.start < b.start && o.end > b.end)).pop();

    if (!trailing || strip(source.slice(trailing.end + 1, body.end)).trim().replace(/^[;\s]*/, '')) {
        const code = strip(source.slice(body.start + 1, body.end));
        const lastStatement = code.trim().split(/[;}]\s*/).filter(Boolean).pop() || '';
        if (!/\breturn\b|\bthrow\b/.test(lastStatement)) {
            fail(`trxSlice.js:${lineOf(body.start)} — handler ends without rejecting. `
                + `Returning undefined fulfils the thunk and corrupts the reducer.`);
        }
        return;
    }

    // The final construct is a branch chain: every leaf must reject, and it
    // must end in an `else` or an unmatched error falls straight through it.
    const inChain = blocks.filter((b) => b.start >= trailing.start && b.end <= trailing.end);
    const leaves = inChain.filter((b) => !inChain.some((o) => o !== b && o.start > b.start && o.end < b.end));
    leaves.forEach((leaf) => {
        const code = strip(source.slice(leaf.start + 1, leaf.end));
        if (!/\breturn\b|\bthrow\b/.test(code)) {
            fail(`trxSlice.js:${lineOf(leaf.start)} — error path falls through without `
                + `rejecting. Returning undefined here fulfils the thunk and corrupts `
                + `the reducer:\n        ${code.trim().split('\n').join('\n        ')}`);
        }
    });
    if (!/\belse\s*$/.test(strip(source.slice(Math.max(0, trailing.start - 12), trailing.start)))) {
        fail(`trxSlice.js:${lineOf(trailing.start)} — branch chain has no final else, so an `
            + `unmatched error falls out of the handler and fulfils the thunk.`);
    }
});
if (failures === 0) pass('every error path rejects instead of falling through');

/* ------------------------------------------------------------------ *
 * 2. Every .fulfilled reducer guards its payload
 * ------------------------------------------------------------------ */

const before = failures;
const fulfilledRe = /addCase\(\s*([\w.]+)\.fulfilled\s*,\s*\(\s*state\s*,\s*action\s*\)\s*=>\s*\{/g;
let f;
let checked = 0;
while ((f = fulfilledRe.exec(source)) !== null) {
    const open = source.indexOf('{', f.index + f[0].length - 1);
    const close = matchBrace(open);
    const body = source.slice(open + 1, close);
    const name = f[1];
    checked++;

    const dereferences = /action\.payload\s*[.[]/.test(body);
    // Either an early return, or a truthiness test that dominates the reads.
    const guards = /if\s*\([^)]*!\s*action\.payload\s*\)/.test(body)
        || /\baction\.payload\s*&&/.test(body)
        || /&&\s*action\.payload\s*\)/.test(body);

    if (dereferences && !guards) {
        fail(`trxSlice.js:${lineOf(f.index)} — ${name}.fulfilled reads action.payload `
            + `without checking it. A thunk that resolves undefined will throw here and `
            + `Immer will discard the entire update, including any in-flight flag.`);
    }
}
if (checked === 0) {
    fail('found no .fulfilled reducers to check — has the file been restructured?');
} else if (failures === before) {
    pass(`all ${checked} .fulfilled reducers guard their payload`);
}

/* ------------------------------------------------------------------ *
 * 3. The in-flight flag is cleared on every terminal state
 * ------------------------------------------------------------------ */

const flagCases = ['submitPayment.fulfilled', 'submitPayment.rejected', 'submitPayment.pending'];
flagCases.forEach((c) => {
    const [thunk, phase] = c.split('.');
    const re = new RegExp(`addCase\\(\\s*${thunk}\\.${phase}\\s*,[\\s\\S]{0,80}?\\{`);
    const hit = re.exec(source);
    if (!hit) {
        fail(`no ${c} handler — the in-flight flag has no ${phase} transition`);
        return;
    }
    const open = source.indexOf('{', hit.index + hit[0].length - 1);
    const body = source.slice(open + 1, matchBrace(open));
    const expected = phase === 'pending' ? 'true' : 'false';
    const statements = strip(body).split(';').map((s) => s.trim()).filter(Boolean);
    // It has to be the FIRST statement, not merely present. Clearing the flag
    // at the end of the reducer is what the original bug effectively did: the
    // reducer threw on the way there, Immer dropped the draft, and the flag
    // stayed set.
    if (!new RegExp(`^state\\.paymentSubmitting\\s*=\\s*${expected}$`).test(statements[0] || '')) {
        fail(`${c} must set paymentSubmitting = ${expected} as its first statement, `
            + `before anything can throw. A flag left set blocks every future payment `
            + `on this terminal. Found: ${JSON.stringify(statements[0] || '(empty)')}`);
    }
});
if (failures === before) pass('paymentSubmitting is set first on pending and cleared first on both outcomes');

/* ------------------------------------------------------------------ *
 * 4. A new sale starts from a clean payment slate
 *
 * trxPaid/trxChange are a cache of the CURRENT sale's paid amount. If a new
 * transaction is installed without clearing them, the leftover carries into
 * the next customer's basket and anything that charges "the remaining
 * balance" undercharges by exactly that amount — on a real card, silently.
 * ------------------------------------------------------------------ */

const beforeSlate = failures;
const scanOpen = (() => {
    const re = /addCase\(\s*scanNewTransaction\.fulfilled\s*,[\s\S]{0,80}?\{/;
    const hit = re.exec(source);
    return hit ? source.indexOf('{', hit.index + hit[0].length - 1) : -1;
})();
if (scanOpen === -1) {
    fail('no scanNewTransaction.fulfilled handler to check the payment-slate reset in');
} else {
    const body = strip(source.slice(scanOpen + 1, matchBrace(scanOpen)));
    ['trxPaid', 'trxChange'].forEach((field) => {
        if (!new RegExp(`state\\.${field}\\s*=\\s*0`).test(body)) {
            fail(`scanNewTransaction.fulfilled never resets state.${field}. A sale that ended `
                + `outside the normal close path leaves it set, and the next basket is then `
                + `charged its total minus that stale amount.`);
        }
    });
    if (!/state\.trx\s*\?\s*state\.trx\.key|currentKey/.test(body)) {
        fail('scanNewTransaction.fulfilled resets the payment slate unconditionally. It must '
            + 'compare the incoming trx key against the current one, or a refresh of the '
            + 'sale in progress would wipe payments already taken on it.');
    }
}
if (failures === beforeSlate) pass('a new transaction clears the previous sale\'s payment cache');

console.log(failures === 0
    ? '\ntrxSlice contract holds.'
    : `\n${failures} contract violation(s).`);
process.exit(failures === 0 ? 0 : 1);
