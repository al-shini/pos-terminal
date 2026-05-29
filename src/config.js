/**
 * Tenant-aware runtime configuration for the POS terminal.
 *
 * The same pos-terminal build serves two backends (Jordan & Palestine).
 * `tenant` is read from the query string (or defaults to 'jordan') and drives:
 *   - currency key (internal code used when talking to the backend)
 *   - currency symbol (what the cashier/customer see on screen)
 *   - decimals (rounding precision used everywhere amounts render)
 *   - feature flags (Jordan-only features like cashback, Fawtara QR,
 *     temp customer name/mobile, reference number, MobiCash, Talabat)
 *
 * Query parameters are collected from BOTH `location.search` AND the hash
 * fragment, because the customer-display window is opened with a HashRouter
 * URL like "…/index.html#/customer?serverIp=…&tenant=…". Without reading the
 * hash, the customer window would silently fall back to defaults.
 */

let deviceId = null;
let serverIp = null;
let admin = null;
let scale = null;
let scaleAlphabet = null;
let autoUpdate = null;
let arabiVisaCom = null;

const searchParams = new URLSearchParams(global.location.search);
const hash = global.location.hash || '';
const hashQueryIndex = hash.indexOf('?');
const hashParams = hashQueryIndex >= 0
    ? new URLSearchParams(hash.substring(hashQueryIndex + 1))
    : new URLSearchParams();

const query = {
    get: (key) => searchParams.get(key) || hashParams.get(key)
};

if (query.get("deviceId")) {
    deviceId = query.get("deviceId");
}

if (query.get("serverIp")) {
    serverIp = query.get("serverIp");
}

if (query.get("admin")) {
    admin = query.get("admin");
}

if (query.get("scale")) {
    scale = query.get("scale");
}

if (query.get("scaleAlphabet")) {
    scaleAlphabet = query.get("scaleAlphabet");
}

if (query.get("autoUpdate")) {
    autoUpdate = query.get("autoUpdate");
}

if (query.get("arabiVisaCom")) {
    arabiVisaCom = query.get("arabiVisaCom");
}

// -----------------------------------------------------------------------------
// Tenant resolution
// -----------------------------------------------------------------------------
// `tenant` is the single switch that decides regional behaviour. It can be
// passed via ?tenant=palestine or defaulted based on a legacy systemCurrency
// param so existing installations keep working.
const rawTenantParam = (query.get("tenant") || '').trim().toLowerCase();
const legacySystemCurrency = (query.get("systemCurrency") || '').trim().toUpperCase();

let tenant = 'jordan';
if (rawTenantParam === 'palestine' || rawTenantParam === 'ps') {
    tenant = 'palestine';
} else if (rawTenantParam === 'jordan' || rawTenantParam === 'jo') {
    tenant = 'jordan';
} else if (legacySystemCurrency === 'NIS' || legacySystemCurrency === 'ILS') {
    // legacy path: installers that only set systemCurrency=NIS
    tenant = 'palestine';
}

// -----------------------------------------------------------------------------
// Tenant profiles
// -----------------------------------------------------------------------------
// NOTE: `systemCurrency` is the *internal* code the backend expects for the
// store's base currency. Palestine historically uses "NIS" in the backend
// (new israeli shekel) even though the user-facing name is ILS (₪). We keep
// "NIS" to stay compatible with existing exchange_rate / payment_method rows.
const tenantProfiles = {
    jordan: {
        systemCurrency: 'JOD',
        currencySymbol: 'JD',
        decimals: 3,
        features: {
            cashback: true,
            fawtara: true,
            customCustomerName: true,
            customCustomerMobile: true,
            referenceNumber: true,
            refundReference: true,
            mobiCash: true,
            talabat: true,
            // Arab Bank Visa terminal integration is a Palestine-only payment
            // method (key `VISA_AB`). Jordan stores never see this button.
            arabVisa: false,
            // "Print Last TRX" button in the Operations menu — lists the last
            // 10 transactions and lets the cashier re-print any of them.
            // Disabled for Palestine per business requirement.
            printLastTrx: true,
            // back-office admin endpoints that only exist on the Jordan backend
            adminInvoicesLookup: true,
            adminCustomersLookup: true,
            adminAudit: true,
            adminTopItems: true,
            adminHourlySales: true,
            adminCustomerParams: true,
            adminBroadcast: true,
            adminForceCloseTill: true,
            customerDisplayConfig: true,
            // EmployeeExtra (employee-balance tender) is NOT launched in Jordan
            // yet. The button stays hidden until the ShiniMe-backed balance flow
            // is rolled out. Flip to true when launching.
            employeeExtra: false,
            // "Others" section in the scale-items drawer — anything weighable
            // that isn't F&V (cheese, dates, olives, etc.) sourced from the
            // pos_other_scale_items table at the local store backend. Only
            // wired up on the Jordan backend today; Palestine pos-backend
            // doesn't expose /barcode/otherScaleItems yet, so the flag stays
            // off there to avoid a permanent failing fetch on till init.
            otherScaleItems: true,
        }
    },
    palestine: {
        systemCurrency: 'NIS',
        currencySymbol: '₪',
        decimals: 2,
        features: {
            // Cashback / Shini.me points: the Palestine backend now has the
            // `Cashback` payment method row + customer balance wiring in
            // place, so the cashier-side button and customer-display totals
            // are enabled the same way as Jordan.
            cashback: true,
            fawtara: false,
            customCustomerName: false,
            customCustomerMobile: false,
            referenceNumber: false,
            refundReference: false,
            mobiCash: false,
            talabat: false,
            // Palestine-only: Arab Bank Visa (payment_method.key = VISA_AB).
            arabVisa: true,
            printLastTrx: false,
            adminInvoicesLookup: false,
            adminCustomersLookup: false,
            adminAudit: false,
            adminTopItems: false,
            adminHourlySales: false,
            // Customer Display editor is enabled so each Palestine store can
            // manage its own carousel images + news-bar messages locally. It
            // only reads/writes the LOCAL store _params (POS_CUSTOMER_IMAGES /
            // POS_CUSTOMER_MESSAGES) via /bo/getCustomerParams +
            // /bo/setCustomerParam — no head-office dependency. This surfaces
            // a Reports tab containing ONLY this panel (the other Reports
            // panels stay gated off below).
            adminCustomerParams: true,
            adminBroadcast: false,
            adminForceCloseTill: false,
            // Customer-display carousel/news params are read by the per-store
            // pos-backend from its LOCAL _params table only (no head-office
            // fallback), so the customer screen is fully independent of the
            // head office. Manage the content from the back-office "Customer
            // Display Settings" panel.
            customerDisplayConfig: true,
            // EmployeeExtra (employee-balance tender) is LIVE in Palestine: the
            // PS backend deducts users.employee_balance from the Shini Me
            // datasource in the same one-shot consumeShiniMeBalances()
            // transaction as cashback (FOR UPDATE, no queue). Keep enabled.
            employeeExtra: true,
            // See Jordan profile — Palestine backend doesn't have this
            // endpoint yet.
            otherScaleItems: false,
        }
    }
};

const profile = tenantProfiles[tenant] || tenantProfiles.jordan;

// const _visa = 'Visa';
const _visa = '3d757906-76ce-43eb-acbc-ef41e88b32261655196183639';


const config = {
    deviceId: deviceId ? deviceId : 'test',
    serverIp: serverIp ? serverIp : '127.0.0.1',
    admin: admin ? admin : false,
    scale: scale ? scale : false,
    scaleAlphabet: scaleAlphabet ? scaleAlphabet : false,
    autoUpdate: autoUpdate ? autoUpdate : false,
    visa: _visa,
    mobiCash: 'MobiCash',
    talabat: 'Talabat',
    wfp: 'WFP',
    visaArabi: 'VISA_AB',
    jawwalPay: 'JawwalPay',
    voucher: 'Voucher',
    onAccount: 'OnAccount',
    cashBack: 'Cashback',
    employeeExtra: 'EmployeeExtra',
    cashDroEnabled: true,
    arabiVisaCom: arabiVisaCom ? arabiVisaCom : false,

    // tenant-driven ---------------------------------------------------------
    tenant,
    systemCurrency: profile.systemCurrency,
    currencySymbol: profile.currencySymbol,
    decimals: profile.decimals,
    features: profile.features,
};

console.log('[POS config]', {
    tenant: config.tenant,
    systemCurrency: config.systemCurrency,
    currencySymbol: config.currencySymbol,
    decimals: config.decimals,
    features: config.features,
});

export default config;
