// Idempotent, version-tolerant patch for `qr` (pulled in by RainbowKit -> cuer).
//
// RainbowKit's QR renderer (`cuer`) passes border:0, but qr's encodeQR rejects
// border<=0 with `throw new Error("invalid border=0")`, crashing the whole desktop
// WalletConnect flow. patch-package is too brittle here (it failed to apply on Vercel
// because of tiny base-file differences), so we rewrite the two offending checks
// directly with string replacement and tolerate "already patched".
import { readFileSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);

let target;
try {
  target = require.resolve("qr");
} catch {
  console.log("[patch-qr] qr not installed; skipping.");
  process.exit(0);
}

let src = readFileSync(target, "utf8");

// Idempotency marker — bail out if we've already patched this file.
const MARKER = "/* wncg-qr-patched */";
if (src.includes(MARKER)) {
  console.log("[patch-qr] already patched; skipping.");
  process.exit(0);
}

let changed = false;

// 1) encodeQR top-level border guard:  if (... || border <= 0) throw `invalid border=`
//    -> allow 0 (border < 0), and only add the border when > 0.
if (src.includes("throw new Error(`invalid border=${border}`)")) {
  src = src.replace(
    /if \(!Number\.isSafeInteger\(border\) \|\| border <= 0\)\s*\n?\s*throw new Error\(`invalid border=\$\{border\}`\);\s*\n\s*res = res\.border\(border, false\);/,
    "if (!Number.isSafeInteger(border) || border < 0)\n        throw new Error(`invalid border=${border}`);\n    if (border > 0)\n        res = res.border(border, false);",
  );
  changed = true;
}

// 2) Bitmap.border(): border <= 0 throws -> allow 0 (return unchanged).
if (
  src.includes("throw new Error(`Bitmap.border: invalid size=${border}`)") &&
  src.includes("border <= 0)")
) {
  src = src.replace(
    /if \(!Number\.isSafeInteger\(border\) \|\| border <= 0\)\s*\n?\s*throw new Error\(`Bitmap\.border: invalid size=\$\{border\}`\);/,
    "if (!Number.isSafeInteger(border) || border < 0)\n            throw new Error(`Bitmap.border: invalid size=${border}`);\n        if (border === 0)\n            return this;",
  );
  changed = true;
}

if (changed) {
  writeFileSync(target, `${MARKER}\n${src}`);
  console.log(`[patch-qr] patched ${target}`);
} else {
  console.log("[patch-qr] pattern not found; no changes (qr may have changed).");
}
