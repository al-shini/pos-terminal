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
let selfService = null;

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

if (query.get("selfService")) {
    selfService = query.get("selfService");
}

// Khairgate Wallet scan simulation (UAT only). Adding ?khairgateTestQr=true
// to the terminal URL puts an "Insert test QR" button inside the Khairgate
// scan modal so the flow can be exercised without a physical scanner.
// 'true'/'1' injects the UAT test customer ("Ahmed Yusuf") from
// Khairgate_Wallet_Integration_Details.xlsx; any other value is used as the
// QR string itself. Leave the param off in production builds.
const KHAIRGATE_UAT_TEST_QR = 'hQVDUFYwMWEwUCBjYzNlODU1NDVhOTU0ODg1ODNlMTVmZmMxOTgyM2I2Nl8gC0FobWVkIFl1c3Vm';
let khairgateTestQr = null;
const khairgateTestQrParam = query.get("khairgateTestQr");
if (khairgateTestQrParam) {
    khairgateTestQr = (khairgateTestQrParam === 'true' || khairgateTestQrParam === '1')
        ? KHAIRGATE_UAT_TEST_QR
        : khairgateTestQrParam;
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
            // Separate "AUTO - ARABI" tender (payment_method.key `VISA_AB`) is
            // Palestine-only. In Jordan the Arab Bank terminal IS the regular
            // `Visa` tender's AUTO VISA button (see autoVisaProvider below).
            arabVisa: false,
            // Which card terminal the AUTO VISA button on the `Visa` tender
            // drives: 'arabBank' = local Windows service + Arab Bank
            // CashierAgent DLL over COM (replaces the retired Network
            // International integration); 'bop' = Bank of Palestine IP reader.
            autoVisaProvider: 'arabBank',
            // Admin > "ARAB BANK VISA" panel: service status, one-click
            // install, COM auto-detect, test connection.
            arabBankVisaAdmin: true,
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
            // [employee-extra 2026-07-23] ENABLED for Jordan too. The direct-DB
            // flow is tenant-agnostic, but the Jordan pos-backend branch does
            // NOT have the backend changes yet — they must be ported first
            // (see pos-backend/docs/SHINI_ME_INTEGRATION_CHANGELOG.md §7) and
            // shinime-datasource.properties pointed at the Jordan Shini Me DB.
            // Until then the button stays harmless: customer.employee is never
            // true (no enrichment) so the tender never shows, and the backend
            // would reject it anyway.
            employeeExtra: true,
            // "Others" section in the scale-items drawer — anything weighable
            // that isn't F&V (cheese, dates, olives, etc.) sourced from the
            // pos_other_scale_items table at the local store backend. Only
            // wired up on the Jordan backend today; Palestine pos-backend
            // doesn't expose /barcode/otherScaleItems yet, so the flag stays
            // off there to avoid a permanent failing fetch on till init.
            otherScaleItems: true,
            // Cumulative-spend campaign (Aug 18 – Sep 9 2026). Jordan only —
            // progress widget + redeem button on the cashier screen.
            spendCampaign: true,
            // Campaign reward vouchers tendered via dedicated payment method
            // (GL-linked separately from legacy Voucher).
            campaignVoucher: true,
            // Quantity × override requires manager QR (same roles as Refund /
            // PriceChange). Stops cashiers arming fractional qty (e.g. 0.1×)
            // to exploit per-unit promotions on piece items.
            qtyMultiplierQrAuth: true,
            // Self-checkout card tender. Kept off until card terminals are
            // wired for unattended use; Cash (CashDro) is the only tender.
            selfServiceCardEnabled: false,
            // Khairgate Wallet (TaqatKhair Gate) consumer-presented QR tender.
            // OFF for Jordan: the Jordan pos-backend branch does not have the
            // /trx/khairgatePay endpoint yet — port it first (see
            // docs/KHAIRGATE_WALLET_INTEGRATION.md at the workspace root) and
            // set the khairgate.* properties, then flip this on.
            khairgate: false,
        }
    },
    palestine: {
        systemCurrency: 'NIS',
        currencySymbol: '₪',
        decimals: 2,
        features: {
            // [cashback-disabled 2026-06-23] (C1) Cashback / Shini.me points is
            // DISABLED at the POS. Step 1 of decoupling the POS from the Shini Me
            // DB: the backend no longer earns/consumes points or reads loyalty
            // balances (Cashback tender is rejected). Hiding the cashier button,
            // balance card and customer-display cashback pill keeps the UI
            // consistent. Re-enable once the flow runs via the Shini Me backend
            // API. See docs/POS_CASHBACK_DISABLED.md.
            cashback: false,
            fawtara: false,
            customCustomerName: false,
            customCustomerMobile: false,
            referenceNumber: false,
            refundReference: false,
            mobiCash: false,
            talabat: false,
            // Palestine-only: Arab Bank Visa (payment_method.key = VISA_AB).
            arabVisa: true,
            // The `Visa` tender's AUTO VISA button drives the BOP IP reader
            // here; the Arab Bank COM terminal is the separate VISA_AB tender.
            autoVisaProvider: 'bop',
            // Palestine stations with an Arab Bank terminal still need the
            // service/COM setup panel for the VISA_AB tender.
            arabBankVisaAdmin: true,
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
            // [employee-extra 2026-07-23] RE-ENABLED via direct Shini Me DB
            // access (one-shot deduction at close, FOR UPDATE row lock — no
            // Shini Me backend release needed). Points/cashback remains
            // disabled pending the API-first flow. The button also requires
            // customer.employee=true, which the backend now enriches straight
            // from the Shini Me DB users table.
            employeeExtra: true,
            // See Jordan profile — Palestine backend doesn't have this
            // endpoint yet.
            otherScaleItems: false,
            // See Jordan — card tender stays disabled for self-checkout.
            selfServiceCardEnabled: false,
            // Cumulative-spend campaign is Jordan-only.
            spendCampaign: false,
            campaignVoucher: false,
            // Palestine keeps × without QR; qty < 1 is still blocked in the
            // terminal reducer + store backend.
            qtyMultiplierQrAuth: false,
            // Khairgate Wallet (TaqatKhair Gate): customer shows the QR from
            // their wallet app, cashier scans it, backend charges the wallet
            // synchronously (/trx/khairgatePay). The button only works on
            // stores whose backend has khairgate.enabled=true; elsewhere the
            // backend answers 503 with a clear message.
            khairgate: true,
        }
    }
};

const profile = tenantProfiles[tenant] || tenantProfiles.jordan;

const _visa = 'Visa';
// const _visa = '3d757906-76ce-43eb-acbc-ef41e88b32261655196183639';


const config = {
    deviceId: deviceId ? deviceId : 'test',
    serverIp: serverIp ? serverIp : '127.0.0.1',
    admin: admin ? admin : false,
    scale: scale ? scale : false,
    scaleAlphabet: scaleAlphabet ? scaleAlphabet : false,
    autoUpdate: autoUpdate ? autoUpdate : false,
    // Self-checkout kiosk mode. When true, Terminal renders the customer-
    // facing SelfServiceView instead of the cashier UI. Driven by
    // ?selfService=true (or posconfig.json selfService via Electron).
    selfService: selfService === true || selfService === 'true',
    visa: _visa,
    mobiCash: 'MobiCash',
    talabat: 'Talabat',
    wfp: 'WFP',
    visaArabi: 'VISA_AB',
    jawwalPay: 'JawwalPay',
    voucher: 'Voucher',
    campaignVoucher: 'CampaignVoucher',
    khairgateWallet: 'KhairgateWallet',
    khairgateTestQr,
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
    selfService: config.selfService,
    features: config.features,
});

export default config;
