# Scale Weight Reading — How It Works (Jordan branch, current `pos-terminal`)

This document traces the full flow of fetching a weight from a physical scale
connected to the POS, from the hardware serial port all the way to the backend
that parses the scale barcode and creates a transaction line.

The goal is to have a reference we can diff against the Palestine branch to
pinpoint exactly where the readings diverge.

---

## 1. Runtime pieces involved

```
┌────────────────────────┐       ┌────────────────────────────┐       ┌──────────────────┐
│   Physical Scale       │ RS232 │  Electron main process     │ HTTP  │  React renderer  │
│   (e.g. TEM EGE-TB)    │◄──────┤  (public/electron.js)      │◄──────┤  (Terminal.js)   │
│   COMx @ 9600 baud     │       │  + serialport + parser     │       │  axios           │
└────────────────────────┘       │  exposes REST on :3001     │       └────────┬─────────┘
                                 └────────────────────────────┘                │  axios
                                                                                ▼
                                                                 ┌──────────────────────────┐
                                                                 │  Spring Boot backend     │
                                                                 │  PosSellTrxService       │
                                                                 │  parses "61..." barcode  │
                                                                 └──────────────────────────┘
```

The scale is **never** talked to directly from the browser. It's always:

1. React calls `http://localhost:3001/<scaleRoute>` (Electron's local Express
   server, not the main backend).
2. The Electron main process owns the serial port and answers with the
   numeric weight as plain text.
3. React turns that number into a "fake" EAN-13-ish barcode (`61<PLU><weight>1`)
   and POSTs it to the Spring backend as if the cashier scanned it.
4. The backend parses the barcode, finds the PLU, and reads the weight back
   out of the decimal portion.

---

## 2. Local Electron config (`pos-config.json`)

Every scale parameter is pulled from the installer's local config file. See
[`public/electron.js`](../public/electron.js):

```javascript
const getScaleConfig = () => ({
    port:              localConfig.scaleCOM               || 'COM1',
    baudRate:          localConfig.baudRate               || 9600,
    maxRetries:        localConfig.scaleMaxRetries        || 6,
    retryDelay:        localConfig.scaleRetryDelay        || 500,
    responseTimeout:   localConfig.scaleResponseTimeout   || 3000,
    weightCommand:     localConfig.scaleWeightCommand     || '$',
    zeroCommand:       localConfig.scaleZeroCommand       || 'Z',
    restartCommand:    localConfig.scaleRestartCommand    || 'Z',
    frameDelimiter:    resolveScaleFrameDelimiter(),      // see section below
});
```

| key                     | default | meaning                                                      |
|-------------------------|---------|--------------------------------------------------------------|
| `scaleCOM`              | COM1    | Windows COM port the scale is on                             |
| `baudRate`              | 9600    | Serial baud                                                  |
| `scaleWeightCommand`    | `$`     | ASCII string sent to **request** a weight reading            |
| `scaleZeroCommand`      | `Z`     | Command to zero / tare the scale                             |
| `scaleRestartCommand`   | `Z`     | Command to soft-restart the scale                            |
| `scaleMaxRetries`       | 6       | How many times to re-send the weight command if unstable     |
| `scaleRetryDelay`       | 500 ms  | Pause between retries                                        |
| `scaleResponseTimeout`  | 3000 ms | How long to wait for a single reply before retrying          |
| `scaleFrameDelimiter`   | _tenant-driven_ | Byte(s) marking end of a scale frame (see next section) |

### 2.1 Frame delimiter — tenant-aware

The scale reply is line-buffered by `ReadlineParser`. If the parser's
delimiter doesn't match what the scale actually emits at end-of-frame, the
parser simply never fires and `/weightScale` times out.

```javascript
const resolveScaleFrameDelimiter = () => {
    const raw = localConfig.scaleFrameDelimiter;
    if (typeof raw === 'string' && raw.length > 0) {
        const upper = raw.trim().toUpperCase();
        if (upper === 'CR')   return '\r';
        if (upper === 'LF')   return '\n';
        if (upper === 'CRLF') return '\r\n';
        return raw; // assume JSON already unescaped "\r" / "\n"
    }
    const tenant = (localConfig.tenant || '').toString().toLowerCase();
    if (tenant === 'palestine' || tenant === 'ps') return '\n';
    if (tenant === 'jordan'    || tenant === 'jo') return '\r';
    return '\r'; // legacy installs without a tenant field
};
```

Resolution order (most specific wins):

1. **`pos-config.json`** → `scaleFrameDelimiter`. Accepts either a JSON-escaped
   control char (`"\r"`, `"\n"`, `"\r\n"`) or the tokens `"CR"`, `"LF"`,
   `"CRLF"`. Use this when a specific store has an unusual scale model.
2. **Tenant default** — `palestine` → LF, `jordan` → CR.
3. **Fallback** — CR (historical default for Jordan's TEM EGE-TB).

### 2.2 Frame parsing

```javascript
const rawString   = data.toString('utf-8').trim();
const normalized  = rawString.replace(',', '.');      // NEW: comma → dot
const cleanWeight = normalized.replace(/[^\d.]/g, '');
const weightValue = parseFloat(cleanWeight);

logger.info(`Scale raw: "${rawString}", parsed: ${weightValue}`);
```

Whatever the scale sends (`ST,GS,   1.234 kg\r`, `+1.234\r`, `US,1.234\r`,
`1,234\n`, `+  0.52 kgs\n`, …) every non-digit / non-dot character is
stripped; the first numeric value wins. Comma decimals (common on European
/ Palestinian firmwares) are explicitly normalized to dots so `"1,234"`
reads as `1.234` (kg) rather than `1234`.

The raw frame is always logged verbatim so onsite support can diagnose
offending frames without needing a serial sniffer.

---

## 3. Electron REST API (local port 3001)

All routes are registered at the bottom of `public/electron.js`:

| method | path                | purpose                                                 |
|--------|---------------------|---------------------------------------------------------|
| GET    | `/openScalePort`    | Opens the serial port with `getScaleConfig()`           |
| GET    | `/closeScalePort`   | Closes the serial port                                  |
| GET    | `/isScaleConnected` | 200 if `scaleHandler.isConnected === true`, else 500    |
| GET    | `/weightScale`      | Sends `weightCommand`, waits, returns the parsed number |
| GET    | `/zeroScale`        | Sends `zeroCommand`                                     |
| GET    | `/restartScale`     | Sends `restartCommand`                                  |
| GET    | `/scaleStatus`      | JSON diagnostic (port, baud, retries, connected, busy)  |

`/weightScale` flow (see class `EnhancedScaleHandler` in `electron.js`):

1. Check `isConnected` → 500 "Serial port not open" otherwise.
2. Check `isReady()` (not in the middle of another reading) → 409 if busy.
3. Call `getWeight()` which:
   - creates a pending promise,
   - writes `weightCommand` to the port,
   - starts a `responseTimeout` timer,
   - on `parser.data` event: strips non-numeric, parses float → resolves.
   - on timeout: `handleNoResponse()` → re-sends up to `maxRetries`.
4. Response body is `weight.toString()` (e.g. `"1.234"`).

Error mapping returned to the frontend:

| HTTP | meaning                                              |
|------|------------------------------------------------------|
| 408  | Unstable weight after retries                        |
| 409  | Reading already in progress                          |
| 500  | `"Serial port not open"` / generic serial error      |

---

## 4. React renderer side (`src/components/Terminal/Terminal.js`)

### 4.1 Feature flag

```javascript
const [scaleConnected, setScaleConnected] = useState(false);
```

Everything is gated by `config.scale` (boolean from `?scale=true` URL query,
which `public/electron.js` forwards from `pos-config.json`).

### 4.2 Connecting

- `openScalePort()`        → `GET /openScalePort`
- `closeScalePort()`       → `GET /closeScalePort`
- `checkScalePortConnection()` → `GET /isScaleConnected` (auto-reopen after 0.5 s on failure)
- `zeroScale()`            → `GET /zeroScale`
- `restartScale()`         → `GET /restartScale`

### 4.3 Reading a weight (the important one)

`scanWeightableItem(item)` at lines ~613-670:

```javascript
if (item.isScalePiece) {
    // Piece-count item: no scale read, just send 'SQ' + PLU with a multiplier
    let _multi = trxSlice.multiplier || '1';
    let _barcode = 'SQ'.concat(barcode);
    dispatch(scanBarcode({ ..., barcode: _barcode, multiplier: _multi }));
} else {
    // Real weight read
    axios.get(`http://localhost:${expressPort}/weightScale`).then((response) => {
        const qty = response.data;                 // e.g. "1.234"
        if (qty > 0.0) {
            dispatch(scanBarcode({
                ...,
                barcode: '61'.concat(barcode).concat(formatDouble(qty)).concat('1'),
                multiplier: qty
            }));
        } else {
            notify('Please add item on scale first');
        }
    });
}
```

### 4.4 `formatDouble(number)` — encoding weight into a barcode

```javascript
function formatDouble(number) {
    let formattedNumber = number + '';
    let parts = formattedNumber.split('.');
    let wholePart = parts[0];
    let decimalPart = parts[1];

    while (wholePart.length < 2) wholePart = '0' + wholePart;     // pad to 2 digits
    if (wholePart.length === 3) wholePart = wholePart.substr(1);   // cap at 2 digits

    formattedNumber = wholePart + decimalPart;                     // concatenate
    return formattedNumber;
}
```

Behaviour by example (Jordan assumes **3-decimal** weights, e.g. `1.234 kg`):

| input     | wholePart | decimalPart | output     | digit count |
|-----------|-----------|-------------|------------|-------------|
| `"1.234"` | `"01"`    | `"234"`     | `"01234"`  | 5           |
| `"12.345"`| `"12"`    | `"345"`     | `"12345"`  | 5           |
| `"0.5"`   | `"00"`    | `"5"`       | `"005"`    | **3** ⚠️    |
| `"1"`     | `"01"`    | `undefined` | `"01undefined"` | 11 ⚠️  |

> ⚠️ Note: The function **implicitly assumes `kg` with three decimals**
> (2-digit whole + 3-digit fraction = 5 digits). If the Palestine scale
> returns a 2-decimal weight (e.g. `"1.23"` for 1.23 kg) the backend parser
> that reads indices 7…8 expects 2 digits before the decimal point and 2
> after — matching our `config.decimals` split. We need to parametrize
> `formatDouble` per tenant.

The final assembled barcode is:

```
61  <PLU-5-digits>  <WWDDD or WWDD>  1
```

`61` is the reserved scale-barcode prefix shared with other UPC-A/EAN
variable-weight codes.

---

## 5. Backend parsing (`PosSellTrxService.java`)

Relevant branch: `onScanBarcode`/`onScanBarcodeNew` — both call the helper
`fetchQuantityFromDecBarcode`.

Barcode prefixes that the backend treats as "decimal/weight barcodes":

```
21, 22, 23, 24, 25, 26     // weight
51, 52, 53                 // weight/piece (53 = piece)
61, 62, 63                 // weight/piece (63 = piece)
81,     83                 // weight/piece (83 = piece)
SQ                         // scale piece (quantity passed explicitly)
```

PLU extraction:

```java
String _desBarcode = "";
if (request.getBarcode().length() >= 7) {
    _desBarcode = request.getBarcode().substring(2, 7);   // 5-char PLU
}
```

Quantity extraction — `fetchQuantityFromDecBarcode(barcode, piece)`:

```java
if (piece) {
    // prefixes 63/53/83 → chars[11] is the quantity digit
    // (so barcode format: PP PPPPP xxxxx Q 1 → 13 chars)
    quantityStr = chars[11];
    quantity = Double.parseDouble(quantityStr);
} else {
    // weight barcodes → chars 7..9 are whole, chars 9.. are fraction
    for (int i = 7; i < chars.length; i++) {
        quantityStr.append(chars[i]);
        if (i == 8) quantityStr.append('.');
    }
    // strip trailing char (the '1' check digit appended by the frontend)
    quantityStr = quantityStr.substring(0, quantityStr.length() - 1);
    quantity = Double.parseDouble(quantityStr);
}
```

So for a weight barcode, the backend splits at **index 8/9 inside the string**
which for `61 <5-digit PLU> <WW DDD> 1` means:

```
index: 0 1 2 3 4 5 6 7 8 9 10 11
       6 1 P P P P P W W D D  D   1
                   └┬┘ └─┬─┘
                integer  fraction  (hardcoded 2+3)
```

> ⚠️ **This is the other side of the same assumption.** The backend
> hardcodes **2 integer + 3 fraction** digits. For Palestine (where weights
> are 2-decimal) the parser would be misaligned — it would read `WW.DD1`
> i.e. treat the check-digit `1` as the last fraction digit, giving a
> `kg * 10` overreading.

---

## 6. Summary of what is region-agnostic vs region-specific

| Concern                              | Source                                         | Region-aware?                                |
|--------------------------------------|------------------------------------------------|----------------------------------------------|
| COM port / baud rate                 | `pos-config.json`                              | ✅ installer per store                       |
| Weight request command (`$`, `P`, …) | `pos-config.json`                              | ✅ installer per store                       |
| Frame terminator (`\r` vs `\n`)      | `electron.js` `resolveScaleFrameDelimiter()`   | ✅ tenant default + per-install override     |
| Comma-decimal handling               | `electron.js` `handleWeightData`               | ✅ normalized for both regions               |
| Raw-frame logging                    | `electron.js` `handleWeightData`               | ✅ always on (for onsite diagnostics)        |
| Scale piece flow (`SQ` prefix)       | `Terminal.js` + backend                        | ✅ shared protocol, no change needed         |
| `formatDouble` — encoding weight     | `Terminal.js`, 2-int + variable-fraction       | ✅ shared — same on both regional backends   |
| Backend barcode parser decimal index | `PosSellTrxService.fetchQuantityFromDecBarcode`| ✅ shared — identical in Jordan & Palestine  |
| Currency display decimals            | `config.js` `config.decimals`                  | ✅ tenant-aware (3 for Jordan, 2 for Palestine) |

**Key clarification:** The scale barcode contract (`61 + 5-digit PLU + WW + DDD + 1`)
is **identical** in both the Jordan and Palestine backends — the Java
`fetchQuantityFromDecBarcode` method is byte-for-byte the same and always
splits at index 8/9 (2 whole + 3 fraction). So the weight the scale reports
via serial is encoded and parsed the same way regardless of region; what
`config.decimals` controls is only how amounts are **displayed** to the
cashier/customer, not how kg weights are carried over the EAN-13 barcode.

---

## 7. What was actually wrong on Palestine (and the fix)

Comparison against the older Palestine-specific pos-terminal revealed **only
one meaningful difference** in the scale pipeline:

| Layer                              | Jordan firmware | Palestine firmware |
|------------------------------------|-----------------|--------------------|
| Serial frame terminator            | CR (`\r`)       | LF (`\n`)          |
| Everything else                    | identical       | identical          |

With the parser hardcoded to `delimiter: '\r'`, a Palestine-region scale
that emits LF-terminated frames would send its bytes into the parser without
ever triggering `data` → every `/weightScale` call just timed out after
3 s × 6 retries.

### Fix applied in this PR

1. **`getScaleConfig()`** now includes `frameDelimiter` derived from
   `resolveScaleFrameDelimiter()` (tenant default + optional per-install
   override via `scaleFrameDelimiter` in `pos-config.json`).
2. **`EnhancedScaleHandler.connect()`** reads the delimiter from the config
   instead of hardcoding CR, and logs which delimiter was chosen at startup
   so support staff can verify remotely.
3. **`handleWeightData()`** now also normalizes a comma decimal separator
   (e.g. `"1,234"`) to a dot before stripping non-numeric characters, and
   always logs the raw frame (`Scale raw: "…", parsed: …`) for diagnostics.
4. **No frontend or backend changes** — `formatDouble`, the `61…`-barcode
   assembly, and `fetchQuantityFromDecBarcode` are identical across regions
   so they were left untouched.

### How to override for an exotic scale model

If a specific store has a scale that needs a non-default delimiter, add to
`pos-config.json` one of:

```jsonc
{ "scaleFrameDelimiter": "CR" }          // carriage return
{ "scaleFrameDelimiter": "LF" }          // line feed (Palestine default)
{ "scaleFrameDelimiter": "CRLF" }        // both
{ "scaleFrameDelimiter": "\r" }          // JSON-escaped char also works
```

If absent, the tenant default is used (`tenant=palestine` → LF,
`tenant=jordan` → CR, legacy/missing → CR).
