# Self-service invoice design — fallback v1 (pre-Lidl overhaul)

Snapshot taken 2026-07-21 before reworking the invoice (active cart) page
to a Lidl-style layout (compact list + right action column with ads carousel).

To restore this design, copy the `.txt` files back over the originals
(drop the `.txt` extension):

- `SelfServiceView.js.txt`   -> `../SelfServiceView.js`
- `SelfServiceCart.js.txt`   -> `../SelfServiceCart.js`
- `SelfServiceLastScan.js.txt` -> `../SelfServiceLastScan.js`
- `SelfServiceView.module.css.txt` -> `../SelfServiceView.module.css`

Design highlights of v1:
- Cart + side column as floating white cards on dark grey canvas
- Footer bar: green DSDIGI total, red Cancel, solid green Pay
- Side column: FastLane-style "last scanned item" spotlight card
