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
[`public/electron.js` lines ~873-882](../public/electron.js):

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

Protocol parser (also in `electron.js`):

```javascript
this.parser = this.serialPort.pipe(new ReadlineParser({ delimiter: '\r' }));
```

So the scale is expected to terminate each frame with **CR (`\r`)**.

Parsing the frame:

```javascript
const cleanWeight = data.replace(/[^\d.]/g, '');   // strip everything non-numeric
const weightValue = parseFloat(cleanWeight);
```

Whatever the scale sends (`ST,GS,   1.234 kg\r`, `+1.234\r`, `US,1.234\r`, …)
all non-digit / non-dot characters are stripped; the first numeric value wins.

> ⚠️ **This is the most likely source of a regional bug.** Different scale
> firmwares use different command letters and different frame formats
> (`kg` vs `kgs`, `ST,GS,` vs `STL,`, dot vs comma decimal separator, CR vs LF
> terminator, sometimes a leading `+` sign, sometimes a unit suffix). A
> Palestine scale that outputs comma-decimal frames (`1,234`) would be
> parsed as `1234` after the `.replace(/[^\d.]/g, '')` step, because the comma
> would be stripped. A scale that replies with `LF` instead of `CR` would
> never trigger `ReadlineParser`.

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

## 6. Summary of what is currently region-agnostic vs region-specific

| Concern                              | Source                                         | Region-aware today?                    |
|--------------------------------------|------------------------------------------------|-----------------------------------------|
| COM port / baud rate                 | `pos-config.json`                              | ✅ yes, installer per store              |
| Weight request command (`$`, `P`, …) | `pos-config.json`                              | ✅ yes, installer per store              |
| Frame terminator (`\r`)              | Hardcoded in `electron.js`                     | ❌ no                                    |
| Frame parsing (strip non-digit)      | Hardcoded in `electron.js`                     | ❌ no — comma decimals get collapsed     |
| Scale piece flow (`SQ` prefix)       | Hardcoded in Terminal.js + backend             | ✅ shared                                |
| `formatDouble` — encoding weight     | Hardcoded **2 integer + 3 fraction**           | ❌ **no — assumes Jordan's 3-decimal**   |
| Backend barcode parser decimal index | Hardcoded **index 8 = decimal point**          | ❌ **no — assumes Jordan's 3-decimal**   |
| Tenant config (`config.decimals`)    | `config.js`                                    | ✅ exists (3 for Jordan, 2 for Palestine)|

---

## 7. Hypotheses for the Palestine discrepancy

Before we diff against the Palestine branch, these are the two most likely
culprits, in order of probability:

1. **Weight-barcode encoding mismatch.** Palestine weighs to 2 decimals
   (`1.23 kg`) while the current frontend/backend is hardcoded for 3 decimals.
   `formatDouble("1.23")` would produce `"0123"` (4 digits) instead of the
   expected 5, then the backend splits at a fixed index and reads the wrong
   number. → Fix by wiring the split through `config.decimals`.

2. **Serial-frame decoding mismatch.** The Palestine store's scale model
   likely outputs a different frame (different delimiter, units, or comma
   decimal separator). `ReadlineParser({ delimiter: '\r' })` and
   `/[^\d.]/g` are silently lossy here.

3. **Minor:** `formatDouble` uses `parts[1]` without a default, so an integer
   response (e.g. `"1"` from the scale) yields `"01undefined"`. Unrelated to
   the region but worth fixing while we're in there.

---

## 8. Next step

Switch to the Palestine branch and run the same five queries:

1. `public/electron.js` → `getScaleConfig`, `ReadlineParser`, `handleWeightData`
2. `public/electron.js` → `/weightScale`, `/openScalePort` routes
3. `src/components/Terminal/Terminal.js` → `scanWeightableItem`, `formatDouble`
4. `src/components/Terminal/Terminal.js` → `scanBarcode` dispatch barcode string
5. `src/main/java/org/shini/pos/service/PosSellTrxService.java` → `fetchQuantityFromDecBarcode`

Diff against this document, identify every hardcoded digit-count assumption,
and then parametrize them through `config.tenant` / `config.decimals`.
