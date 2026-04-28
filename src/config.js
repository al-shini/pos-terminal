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
            eshiniConnectionCheck: true,
        }
    },
    palestine: {
        systemCurrency: 'NIS',
        currencySymbol: '₪',
        decimals: 2,
        features: {
            cashback: false,
            fawtara: false,
            customCustomerName: false,
            customCustomerMobile: false,
            referenceNumber: false,
            refundReference: false,
            mobiCash: false,
            talabat: false,
            adminInvoicesLookup: false,
            adminCustomersLookup: false,
            adminAudit: false,
            adminTopItems: false,
            adminHourlySales: false,
            adminCustomerParams: false,
            adminBroadcast: false,
            adminForceCloseTill: false,
            customerDisplayConfig: false,
            eshiniConnectionCheck: false,
        }
    }
};

const profile = tenantProfiles[tenant] || tenantProfiles.jordan;

const _visa = 'Visa';


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
