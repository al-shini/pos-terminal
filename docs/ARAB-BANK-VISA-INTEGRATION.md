# Arab Bank Visa terminal integration (Jordan)

Replaces the retired Network International "AUTO VISA" flow on the Jordan tenant with
the Arab Bank (WIZARPOS) card terminal driven over a serial COM port. The same code
path also serves the Palestine `VISA_AB` tender ("AUTO - ARABI").

Scope: **sale only**. Refund-on-terminal and the DLL's print/report functions are out
of scope (the service wrapper is generic enough to add them later).

Date: 2026-10-19 · pos-terminal branch `jordan` · pos-backend branch `master`

---

## 1. Architecture

```
Terminal.js (AUTO VISA button)
   │  POST /arabiVisa/sale               (renderer never talks to the service directly)
   ▼
Electron express :3001  public/electron.js + public/arabBankVisa.js
   │  busy lock · long timeout · logging · install / auto-detect flows
   │  POST /sale
   ▼
arabi-bank-visa-service  (Windows service, bundled Node 18 + edge-js)  127.0.0.1:9700
   │  C# via edge-js
   ▼
CashierAgentDesktopDLL.dll  ──serial COMx──▶  Arab Bank terminal
```

Both Electron and the service read **`C:/pos/posconfig.json`**. The service reads it on
every request (no restart needed after a COM change); Electron reads it at boot and
refreshes it after `/localConfig` writes.

After an approval the renderer calls the normal `POST /trx/submitPayment` on pos-backend
with a `visaPayment` block, exactly like the BOP flow.

### Money-safety rules (in priority order)

1. Never put a sale on the terminal the POS cannot record: no open trx, Refund mode,
   nothing due, another card sale or payment already in flight → refused up front.
2. The amount recorded is **what the terminal says it took** (RespCode `010` =
   approved for a lesser amount), never what we asked for.
3. An answer we cannot read (`504 outcomeUnknown`) is **not** a failure to retry. The
   cashier gets a blocking dialog: check the terminal slip first.
4. Card approved but the POS could not save the payment → blocking dialog with the slip
   references; the retry re-submits the **record** only, the card is never charged twice.
5. Backend refuses to record the same bank reference twice (`409`).

---

## 2. posconfig.json keys

| key                       | default  | used by           | notes |
|---------------------------|----------|-------------------|-------|
| `arabiVisaCom`            | *(none)* | Electron, service | **required**, e.g. `COM9`. Set by *Setup automatically* / *Re-detect port*, or the config editor dropdown. |
| `arabiVisaBaudRate`       | `115200` | service           | Terminal on this hardware answers at 115200 only (9600 gets no handshake). |
| `arabiVisaServicePort`    | `9700`   | Electron, service | Read once at service boot. Installer refuses a busy port. |
| `arabiVisaTimeoutSec`     | `90`     | service           | DLL wait for the cardholder, clamped 30–180. |
| `arabiVisaEnableReceipt`  | `true`   | service           | Terminal prints the slip. |
| `arabiVisaSkipConfirm`    | `true`   | service           | Skip the terminal's amount-confirm step. |
| `arabiVisaAllowedCurrencies` | `[400]` | service        | ISO numeric codes. Jordan is JOD only. |
| `arabiVisaServiceDir`     | `C:/pos/arabi-visa-pos-windows-service` | Electron | Where the service package lives. |

The scale (`scaleCOM`) and the terminal may **not** share a port; both the config
editor and the sale route refuse that.

---

## 3. pos-terminal changes (branch `jordan`)

### 3.1 `public/arabBankVisa.js` (new, Node-only helpers for the main process)

- `resolveSettings(localConfig)` → `{comPort, baudRate, timeoutSec, servicePort, serviceUrl, serviceDir, scaleCom, enableReceipt, skipConfirm}`.
- `reservedPorts / pickCandidatePorts / comPortConflicts` — port scoring for auto-detect:
  configured port +100, Prolific/FTDI/CP210x/CH340 VID +50, PL2303 +10, USB +20,
  Bluetooth −60; `scaleCOM` and a serial `bopVisaIp` are excluded.
- `classifySaleError(err, settings)`:
  - `ECONNREFUSED/ENOTFOUND` → **503 `SERVICE_DOWN`** (request never left the PC, safe to retry)
  - `ECONNRESET/ECONNABORTED/EPIPE`/timeout, or a non-JSON 5xx body → **504 `outcomeUnknown`**
  - service JSON errors pass through unchanged (`terminalNotConnected`, `serialError`, `portNotFound`, `busy`, …)
- `queryServiceState(serviceId)` (parses `sc.exe query`), `packageStatus(dir)`,
  `readInstallResult`, `tailInstallLog`, `runInstaller(dir, {port, configPath})`
  (spawns `install.ps1 -NonInteractive`, single-flight, 5 min cap), `describeInstallExit(code)`.

### 3.2 `public/electron.js` — new express routes (next to the BOP routes)

| route | purpose |
|-------|---------|
| `GET /arabiVisa/status` | settings, package, Windows service state, service `/health`, serial ports, `comPortPresent`, `comPortConflicts`, `activeSale`, last install, `ready` |
| `GET /serialPorts` | `bopVisa.listSerialPorts()` — shared by the config editor dropdowns |
| `POST /arabiVisa/handshake {comPort?, baudRate?, timeoutMs?}` | proxy to the service handshake; 409 while a sale is running |
| `POST /arabiVisa/autoDetect {terminal?}` | handshake over scored candidate ports → `{comPort, baudRate}` or `noPorts` / `multiple` / `notFound` with the attempt list |
| `POST /arabiVisa/sale {amountMinor, currencyCode, transIndexCode, trxKey, terminal?}` | validation (400), `noComPort`/`portConflict` (412), **Electron single-flight lock (409 busy)**, proxy with `timeout = timeoutSec*1000 + 25 s`, error mapping via `classifySaleError`, every start/end/failure logged with `[arabBank]` |
| `POST /arabiVisa/install` + `GET /arabiVisa/install/status` | run the installer (UAC prompt on the station), poll `{running, exitCode, exitMessage, result, logTail}` |
| `POST /localConfig/merge` | shallow-merge keys into `posconfig.json` (`null` deletes) and refresh `localConfig`; the existing `POST /localConfig` still rewrites the whole file |

### 3.3 `src/utils/arabBankVisa.js` (new, pure, unit-tested)

- `toMinorUnits / fromMinorUnits` — JOD ×1000 (fils), everything else ×100.
- `buildTransIndexCode()` — 12 digits `YYMMDDHHmmss`; echoed by the terminal and printed
  on the slip, so unknown outcomes can be reconciled.
- `APPROVED_CODES = 000,001,003,004,007,010`, `LESSER_AMOUNT_CODE = 010`, `CANCELLED_CODE = -139`.
- `RESP_CODES` EN + AR wording, `describeCode`, `describeFailure(payload)` → `{title, en, ar, sev, retry}`.
- `interpretSale(data, currency)` → `approved | cancelled | declined` with `amount`, `lesser`, `rrn`, `authCode`, `cardNum`, `transIndexCode`.
- `buildSourceKey(sale)` → `AB-AUTOVISA-<RRN>` (falls back to the TransIndexCode).

### 3.4 `src/config.js`

Per-tenant feature flags:

```js
jordan:    { autoVisaProvider: 'arabBank', arabBankVisaAdmin: true, arabVisa: false }
palestine: { autoVisaProvider: 'bop',      arabBankVisaAdmin: true, arabVisa: true  }
```

Jordan keeps the payment-method key **`Visa`** (SAP mapping unchanged); the Arab Bank
terminal is simply what the `Visa` tender's AUTO VISA button drives.

### 3.5 `src/components/Terminal/Terminal.js`

- `autoVisaFlowNetwork` **deleted**; `autoVisaFlowArabi` now delegates to the new
  `autoVisaFlowArabBank(paymentMethodKeyOverride)`.
- Guards: open trx, not Refund, `abSaleInFlight` ref (synchronous double-tap guard),
  `paymentSubmitting`, `trxChange < 0` (something due), supported currency, exchange
  rate present for foreign currency.
- Charges the exact amount due, shows the loading overlay, then:
  - approved → `recordArabBankPayment` → `submitPayment({ amount: terminal amount,
    sourceKey: 'AB-AUTOVISA-<RRN>', visaPayment: {amt, curr, pan, respCode, authCode,
    rcpt: transIndexCode, provider: 'arabBank', fullResponseJson} })`
  - `010` → records the lesser amount and warns about the balance still due
  - `-139` → info toast "cancelled on the terminal"
  - declines → error toast with bank wording (EN + AR)
  - `SERVICE_DOWN`, `terminalNotConnected`, `serialError`, `noComPort`, `portConflict`,
    `busy` → actionable toasts
  - `outcomeUnknown` → blocking **CHECK THE TERMINAL** dialog with reference + amount
  - backend refused to save an approved sale → blocking **CARD CHARGED — NOT RECORDED**
    dialog, *RETRY SAVING* re-submits the record only
- Cashier toasts are bilingual (`arabic — english`) because `arabicize()` collapses
  unknown English into a generic fallback.
- `buildVisaButtons`: the AUTO VISA button routes by `config.features.autoVisaProvider`,
  is labelled **AUTO VISA (ARAB BANK)** for Jordan, and is disabled unless the selected
  currency is the system currency. The Palestine `AUTO - ARABI` button no longer
  depends on `bopVisaIp`.
- New admin panel **ARAB BANK VISA (card terminal)** in *Operations → Settings*
  (rendered when `features.arabBankVisaAdmin`): status rows (overall, Windows service +
  version, service API, package, configured COM vs present ports, conflicts, sale in
  progress, last install) and buttons **Setup automatically** (install → auto-detect →
  `/localConfig/merge` → restart prompt), **Re-detect port**, **Test connection**,
  **Edit posconfig** (opens `PosConfigEditor`), **Refresh**, plus the install log tail.

### 3.6 `src/components/Login/PosConfigEditor.js`

- `KNOWN_FIELDS` += `arabiVisaCom`, `arabiVisaBaudRate`, `arabiVisaServicePort`,
  `arabiVisaTimeoutSec`, `arabiVisaEnableReceipt`.
- Any key matching `/com$/i` renders as a dropdown of the ports present on the PC (with
  friendly names from `/serialPorts`), with an *Other / not plugged in…* free-text
  fallback and a "not present now" chip.
- Red alert + Save disabled when two COM keys point at the same port; yellow alert when
  a configured port is not detected.

### 3.7 `scripts/arabbank-visa-unit-test.js`

Dependency-free checks (`node scripts/arabbank-visa-unit-test.js`) covering amounts,
reference format, response codes, `interpretSale`, source keys, failure wording,
settings resolution, port scoring/reservations, error classification and `sc.exe`
parsing. 65 checks; also run `scripts/bopvisa-unit-test.js` (unchanged, still passing).

---

## 4. pos-backend changes (branch `master`)

- `model/pojo/bopVisa/AutoVisaPayment.java`: new fields `rcpt` (terminal reference /
  TransIndexCode) and `provider` (`arabBank` | `bop`).
- `TrxController.submitPayment`:
  - persists `rcpt` into `pos_auto_visa_payment.rcpt` (column already existed, was never filled);
  - **duplicate guard** `findDuplicateArabBankPayment(request)` before the payment is saved:
    - `sourceKey` starting with `AB-AUTOVISA-` already on a non-voided `pos_sell_trx_payment.source_key` (any trx) → `409 "This card transaction is already recorded (ref …)"`
    - `visaPayment.rcpt` already in `pos_auto_visa_payment` whose payment is not voided → `409 … (terminal ref …)`
    - references are sanitised to `[A-Za-z0-9_-]` before being embedded in SQL; a DB error fails open with an error log line.
- Refund rules untouched (sale only).
- No schema change. **Not yet compiled/deployed** — no JDK on the POS; run `mvnw -q compile` on a build box and deploy to the store backends.

---

## 5. Windows service `arabi-visa-pos-windows-service` (sibling folder, deployed to `C:\pos\arabi-visa-pos-windows-service`)

Rewritten from the bank sample. Full API/troubleshooting reference is in its `README.md`.

- `GET /health`, `GET /ports`, `POST /handshake`, `POST /sale` on `127.0.0.1:<port>`.
- Reads `posconfig.json` per request; single-flight lock; watchdog `timeoutSec + 20 s`
  → `504 outcomeUnknown`; response normalised and guarded (`TransIndexCode` echo,
  currency, amount vs request, `010` lesser amount, PAN masking); `RespDesc` cleaned of
  the DLL's mangled Arabic line.
- `install.bat` / `install.ps1` (self-elevating, idempotent): checks .NET 4.x, bundled
  `node\node.exe`, DLL, winsw, edge native binary, free TCP port, posconfig COM sanity;
  removes a legacy install; registers service id `arabibankvisaservice.exe`
  (`arabi-bank-visa-service`) with the **bundled** node as executable, auto start and
  SCM restart actions 5 s/10 s/30 s; waits for `/health`; writes
  `logs/install-<stamp>.log`, `install-latest.log`, `install-result.json`. Exit codes:
  0 ok · 1 failed · 2 port busy · 3 prerequisite missing · 4 service not healthy · 5 already installed.
- `uninstall.bat` / `uninstall.ps1` mirror it.

---

## 6. Deployment / verification log (POS 4-01, Marj Hamam, 2026-10-19)

- Legacy Network package moved to `C:\pos\arabi-visa-pos-windows-service.network-backup`; new package copied in.
- Install run through `POST /arabiVisa/install` (same path as the admin button): UAC accepted, service **Running / Automatic**, `/health` ok.
- Auto-detect found **COM9 @ 115200** (Prolific PL2303GT) on the first probe; `/localConfig/merge` replaced the stale `COM20`.
- Sales through Electron → service → DLL → terminal: three attempts, all **−139 cancelled by user** with correct echo of reference and amount (no card was presented, so a real approval is still to be exercised with a test card).
- Negative cases: double-click → 409 busy; handshake during a sale → 409; service stopped → 503 `SERVICE_DOWN`; absent COM → 502 `portNotFound`; bad body / EUR → 400.
- `react-scripts build` passes; no new lint warnings in touched files.

### How to roll out to another POS

1. Copy `arabi-visa-pos-windows-service` to `C:\pos\` (keep `node\`, `node_modules\`, the DLL).
2. Deploy the `jordan` build of pos-terminal.
3. On the POS: *Operations → Settings → ARAB BANK VISA → Setup automatically*, accept the
   UAC prompt, confirm the detected COM port, restart when asked. Or run `install.bat` as
   administrator and set `arabiVisaCom` in the login-screen config editor.
4. Deploy the pos-backend build with the duplicate guard to the store server.

---

## 7. Troubleshooting quick map

| cashier sees | meaning | action |
|--------------|---------|--------|
| *Card service not running* (503) | Windows service down / not installed | Admin → Setup automatically, or `install.bat` |
| *Terminal not connected* (502 `terminalNotConnected`) | port opened, terminal silent | power / cable, Test connection |
| *COM port problem* (502 `serialError` / `portNotFound`) | port missing or held by another program (bank TestTool) | Re-detect port, close other programs |
| *Terminal not configured* (412 `noComPort`) | `arabiVisaCom` empty | Setup automatically |
| *COM port conflict* (412) | same port as scale / BOP reader | fix posconfig |
| *Terminal busy* (409) | a sale is still running | finish/cancel on the terminal |
| **CHECK THE TERMINAL** dialog (504) | no readable answer; card may be charged | read the slip; if approved record manually with the reference, never blind-retry |
| **CARD CHARGED — NOT RECORDED** dialog | bank approved, POS save failed | RETRY SAVING; keep the slip |

Logs: Electron `public/logs/app.log` (`[arabBank]` lines), service
`C:\pos\arabi-visa-pos-windows-service\logs\service-YYYY-MM-DD.log`, installer
`logs\install-latest.log`.
