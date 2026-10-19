/**
 * Arab Bank Visa terminal — renderer-side helpers (pure, browser-safe).
 *
 * The Electron main process (public/electron.js, `/arabiVisa/*` routes)
 * proxies the local Windows service that drives the bank's terminal over
 * COM. Everything here is bookkeeping around that call: amount conversion,
 * the 12-digit reference the bank echoes back, response-code semantics and
 * the cashier-facing wording for each outcome. Keep it free of React/redux
 * so it can be unit-tested with plain node (scripts/arabbank-visa-unit-test.js).
 *
 * Protocol facts (WIZARPOS / Arab Bank "Cashier Agent" spec):
 *   - amounts travel in MINOR units: JOD has 3 decimals (1 JOD = 1000 fils),
 *     USD/EUR/ILS have 2.
 *   - RespCode is a 3-char string; "000" approved, "001/003/004/007" approved
 *     with a referral / partial condition, "010" approved for a LESSER amount
 *     (TransAmount carries what was actually taken), "-139" cancelled by the
 *     cardholder/cashier on the terminal keypad. Everything else is a decline.
 */

export const AB_SOURCE_PREFIX = 'AB-AUTOVISA-';

export const CURRENCY_CODES = { JOD: 400, USD: 840, EUR: 978, NIS: 376, ILS: 376 };

export const APPROVED_CODES = ['000', '001', '003', '004', '007', '010'];
export const LESSER_AMOUNT_CODE = '010';
export const CANCELLED_CODE = '-139';

/** Minor-unit exponent for a currency key. */
export const minorFactor = (currency) => ((currency || '').toUpperCase() === 'JOD' ? 1000 : 100);

/** 12.345 JOD -> 12345 ; 10.5 USD -> 1050. Always a positive integer. */
export const toMinorUnits = (amount, currency) => {
    const n = Math.abs(Number(amount));
    if (!isFinite(n)) return 0;
    return Math.round(n * minorFactor(currency));
};

/** 12345 (JOD) -> 12.345 */
export const fromMinorUnits = (minor, currency) => {
    const n = Number(minor);
    if (!isFinite(n)) return 0;
    const f = minorFactor(currency);
    return Math.round(n) / f;
};

/**
 * 12-digit numeric reference (YYMMDDHHmmss) sent as TransIndexCode. The
 * terminal echoes it back and prints it on the slip, so an "outcome unknown"
 * can be reconciled against the paper trail. Per-second uniqueness is fine:
 * one terminal, one cashier, one sale at a time (Electron enforces this).
 */
export const buildTransIndexCode = (date) => {
    const d = date instanceof Date ? date : new Date();
    const p = (n) => String(n).padStart(2, '0');
    return `${String(d.getFullYear()).slice(-2)}${p(d.getMonth() + 1)}${p(d.getDate())}${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`;
};

export const normaliseCode = (code) => {
    if (code === null || code === undefined) return '';
    const s = String(code).trim();
    if (s === CANCELLED_CODE) return s;
    if (/^-?\d+$/.test(s) && !s.startsWith('-')) return s.padStart(3, '0');
    return s;
};

export const isApprovedCode = (code) => APPROVED_CODES.indexOf(normaliseCode(code)) >= 0;

/** English + Arabic wording per bank response code (subset the cashier can act on). */
export const RESP_CODES = {
    '000': { en: 'Approved', ar: 'تمت الموافقة' },
    '001': { en: 'Approved (call issuer)', ar: 'تمت الموافقة' },
    '003': { en: 'Approved (VIP)', ar: 'تمت الموافقة' },
    '004': { en: 'Approved (update track 3)', ar: 'تمت الموافقة' },
    '007': { en: 'Approved (special conditions)', ar: 'تمت الموافقة' },
    '010': { en: 'Approved for a LESSER amount', ar: 'تمت الموافقة على مبلغ أقل' },
    '-139': { en: 'Cancelled on the terminal', ar: 'تم الإلغاء من جهاز الدفع' },
    '051': { en: 'Insufficient funds', ar: 'الرصيد غير كافٍ' },
    '054': { en: 'Expired card', ar: 'البطاقة منتهية الصلاحية' },
    '055': { en: 'Incorrect PIN', ar: 'الرقم السري غير صحيح' },
    '057': { en: 'Transaction not permitted to cardholder', ar: 'العملية غير مسموحة لحامل البطاقة' },
    '061': { en: 'Exceeds withdrawal limit', ar: 'تجاوز حد السحب' },
    '062': { en: 'Restricted card', ar: 'بطاقة مقيّدة' },
    '065': { en: 'Exceeds withdrawal frequency', ar: 'تجاوز عدد العمليات المسموح' },
    '075': { en: 'PIN tries exceeded', ar: 'تم تجاوز محاولات الرقم السري' },
    '091': { en: 'Issuer unavailable', ar: 'البنك المُصدر غير متاح' },
    '096': { en: 'System malfunction', ar: 'عطل في النظام' },
    '100': { en: 'Do not honour', ar: 'رُفضت العملية من البنك' },
    '101': { en: 'Expired card', ar: 'البطاقة منتهية الصلاحية' },
    '116': { en: 'Insufficient funds', ar: 'الرصيد غير كافٍ' },
    '117': { en: 'Incorrect PIN', ar: 'الرقم السري غير صحيح' },
    '119': { en: 'Transaction not permitted to cardholder', ar: 'العملية غير مسموحة لحامل البطاقة' },
    '121': { en: 'Exceeds withdrawal limit', ar: 'تجاوز حد السحب' },
    '200': { en: 'Pick up card', ar: 'يرجى سحب البطاقة' },
    '208': { en: 'Lost card', ar: 'بطاقة مفقودة' },
    '209': { en: 'Stolen card', ar: 'بطاقة مسروقة' },
    '902': { en: 'Invalid transaction', ar: 'عملية غير صالحة' },
    '904': { en: 'Format error', ar: 'خطأ في التنسيق' },
    '907': { en: 'Issuer inoperative', ar: 'البنك المُصدر لا يستجيب' },
    '908': { en: 'Routing error', ar: 'خطأ في توجيه العملية' },
    '909': { en: 'System malfunction', ar: 'عطل في النظام' },
    '911': { en: 'Issuer timed out', ar: 'انتهت مهلة البنك المُصدر' },
    '913': { en: 'Duplicate transmission', ar: 'عملية مكررة' },
};

export const describeCode = (code, fallbackDesc) => {
    const c = normaliseCode(code);
    const known = RESP_CODES[c];
    if (known) return known;
    return { en: fallbackDesc || (c ? `Declined (code ${c})` : 'Declined'), ar: fallbackDesc || 'رُفضت العملية' };
};

/**
 * Service / Electron error payloads → what the cashier should do. `code` is
 * the machine code produced by the service (`lib/parse.js`) or by
 * public/arabBankVisa.js. Every branch yields { title, en, ar, sev, retry }
 * where `retry=false` means "do NOT press the button again before checking".
 */
export const describeFailure = (payload, httpStatus) => {
    const p = payload || {};
    const code = p.code || '';
    const detail = p.error ? ` (${p.error})` : '';
    switch (code) {
        case 'outcomeUnknown':
            return {
                title: 'CHECK THE TERMINAL',
                en: 'No readable answer from the card terminal. The card MAY have been charged. Check the terminal slip: if it printed APPROVED, record the payment manually with the slip reference; otherwise retry.' + detail,
                ar: 'لم تصل إجابة واضحة من جهاز الدفع. قد تكون البطاقة قد خُصم منها. تحقّق من إيصال الجهاز قبل إعادة المحاولة.',
                sev: 'error', retry: false
            };
        case 'SERVICE_DOWN':
            return {
                title: 'Card service not running',
                en: 'The Arab Bank Visa service is not running on this PC. Open Admin > Arab Bank Visa and press "Setup automatically", or restart the PC.',
                ar: 'خدمة فيزا البنك العربي غير مشغّلة على هذا الجهاز. افتح الإعدادات > Arab Bank Visa واضغط "إعداد تلقائي".',
                sev: 'error', retry: true
            };
        case 'terminalNotConnected':
            return {
                title: 'Terminal not connected',
                en: 'The card terminal did not answer on ' + (p.comPort || 'the configured COM port') + '. Check its power and USB cable, then retry.',
                ar: 'جهاز الدفع لا يستجيب. تحقّق من الطاقة وكابل USB ثم أعد المحاولة.',
                sev: 'error', retry: true
            };
        case 'serialError':
        case 'portNotFound':
            return {
                title: 'COM port problem',
                en: 'Cannot open the terminal COM port' + detail + '. The cable may be unplugged or another program (e.g. the bank TestTool) is holding the port. Re-detect the port from Admin > Arab Bank Visa.',
                ar: 'تعذّر فتح منفذ جهاز الدفع. تحقّق من الكابل أو أغلق أي برنامج آخر يستخدم المنفذ.',
                sev: 'error', retry: true
            };
        case 'noComPort':
            return {
                title: 'Terminal not configured',
                en: 'No COM port is configured for the Arab Bank terminal. Open Admin > Arab Bank Visa > Setup automatically.',
                ar: 'لم يتم ضبط منفذ جهاز الدفع. افتح الإعدادات > Arab Bank Visa.',
                sev: 'warning', retry: true
            };
        case 'portConflict':
            return {
                title: 'COM port conflict',
                en: 'The Arab Bank terminal shares a COM port with another device' + detail + '. Fix posconfig.json before taking card payments.',
                ar: 'منفذ جهاز الدفع متعارض مع جهاز آخر. يرجى تصحيح الإعدادات.',
                sev: 'error', retry: false
            };
        case 'busy':
            return {
                title: 'Terminal busy',
                en: 'A card sale is already in progress on this station' + detail + '. Finish or cancel it on the terminal first.',
                ar: 'هناك عملية دفع جارية على جهاز الدفع. أكملها أو ألغها أولاً.',
                sev: 'warning', retry: true
            };
        case 'configError':
        case 'clrError':
        case 'badRequest':
            return {
                title: 'Card service error',
                en: 'The card service rejected the request' + detail + '. Contact support.',
                ar: 'خطأ في خدمة الدفع. يرجى التواصل مع الدعم الفني.',
                sev: 'error', retry: false
            };
        default:
            return {
                title: 'Card payment failed',
                en: (p.error || (httpStatus ? `HTTP ${httpStatus}` : 'Unknown error')),
                ar: 'فشلت عملية الدفع بالبطاقة',
                sev: 'error', retry: true
            };
    }
};

/**
 * Turn a successful (2xx) service reply into a decision for the cashier.
 * Returns one of:
 *   { kind: 'approved', amount, lesser, ... }  → record payment
 *   { kind: 'cancelled' }                       → silent info toast
 *   { kind: 'declined', code, desc }            → error toast
 */
export const interpretSale = (data, currency) => {
    const d = data || {};
    const code = normaliseCode(d.respCode);
    if (d.cancelled || code === CANCELLED_CODE) {
        return { kind: 'cancelled', code, desc: describeCode(CANCELLED_CODE) };
    }
    const approved = d.approved === true || (d.approved === undefined && isApprovedCode(code));
    if (!approved) {
        return { kind: 'declined', code, desc: describeCode(code, d.respDesc) };
    }
    const amountMinor = Number(d.amountMinor);
    const requestedMinor = Number(d.requestedAmountMinor);
    const safeMinor = isFinite(amountMinor) && amountMinor > 0 ? amountMinor : requestedMinor;
    return {
        kind: 'approved',
        code,
        desc: describeCode(code, d.respDesc),
        amount: fromMinorUnits(safeMinor, currency),
        amountMinor: safeMinor,
        requestedAmountMinor: requestedMinor,
        lesser: code === LESSER_AMOUNT_CODE || d.lesserAmount === true || (isFinite(requestedMinor) && safeMinor < requestedMinor),
        rrn: d.rrn || '',
        authCode: d.authCode || '',
        cardNum: d.cardNum || '',
        transIndexCode: d.transIndexCode || '',
        currencyCode: d.currencyCode
    };
};

/**
 * sourceKey stored on pos_sell_trx_payment. The bank's RRN is the globally
 * unique reference; when a terminal omits it we fall back to the
 * TransIndexCode we generated (unique per station per second).
 */
export const buildSourceKey = (sale) => {
    const ref = (sale && (sale.rrn || sale.transIndexCode)) || buildTransIndexCode();
    return AB_SOURCE_PREFIX + ref;
};

const arabBankVisa = {
    AB_SOURCE_PREFIX, CURRENCY_CODES, APPROVED_CODES, LESSER_AMOUNT_CODE, CANCELLED_CODE, RESP_CODES,
    minorFactor, toMinorUnits, fromMinorUnits, buildTransIndexCode, normaliseCode, isApprovedCode,
    describeCode, describeFailure, interpretSale, buildSourceKey
};

export default arabBankVisa;
