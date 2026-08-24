/**
 * Central Arabic translator for warning/error/info toast text.
 *
 * The app fires ~150+ `notify({ msg, sev })` dispatches from all over the
 * codebase (cashier Terminal.js, self-service, backoffice screens, trx/
 * terminal slices...) plus two full-screen "hard" error backdrops
 * (itemScanError / hardNotification). Self-service already dispatches
 * pre-translated Arabic strings (see SelfService/i18n.js) — everything
 * else is still raw English, often the exact text a Spring controller
 * returned in `ResponseEntity.body("...")`.
 *
 * Rather than touching every one of those ~150 call sites (high risk of
 * typos/regressions for very little benefit), translation happens ONCE,
 * at render time, wherever `ui.toastMsg` / `ui.itemScanErrorMessage` /
 * `ui.hardNotificationMessage` are actually displayed (App.js, Admin.js).
 * Rendering-time (not reducer-time) translation is deliberate: some
 * components — e.g. SelfServiceScanError — read the RAW
 * itemScanErrorMessage from redux to run their own heuristics (detecting
 * a loyalty-card lookup failure vs a plain barcode-not-found). Mutating
 * that state in the reducer would break those checks; translating only
 * in the generic English backdrop's JSX leaves the raw value untouched
 * for everyone else.
 *
 * Already-Arabic input (self-service's own dispatches) is detected and
 * passed through unchanged.
 */

// Case-insensitive exact-match dictionary. Covers both frontend-authored
// notify() literals and the raw text returned by pos-backend controllers
// (TrxController, AuthController, UtilitiesController, BackOfficeController).
const EXACT_MAP = {
    // --- generic / auth ---
    'wrong credentials': 'بيانات الدخول غير صحيحة',
    'un-authorized': 'غير مخوّل بالوصول',
    'un-auth orized': 'غير مخوّل بالوصول',
    'invalid token': 'الرمز غير صالح',
    'refresh token consumed': 'تم استخدام رمز التحديث مسبقًا',
    'wrong user or backoffice no-access': 'مستخدم غير صحيح أو لا يملك صلاحية الدخول للوحة التحكم',
    'device does not belong to cashier/head cashier user': 'هذا الجهاز غير مخصص لمستخدم كاشير/كاشير رئيسي',
    'device does not belong to cashier/head cashier user, please contact your supervisor.': 'هذا الجهاز غير مخصص لمستخدم كاشير/كاشير رئيسي — يرجى التواصل مع المسؤول',
    'hardware id is required': 'معرّف الجهاز مطلوب',
    'hardware id is not assigned to any terminal': 'معرّف الجهاز غير مرتبط بأي نقطة بيع',
    'mobile hardware id is required.': 'معرّف جهاز الموبايل مطلوب',
    'auth key is required.': 'رمز التفويض مطلوب',
    'auth key is required': 'رمز التفويض مطلوب',
    'qr code not found or expired — please scan again.': 'رمز QR غير موجود أو منتهي — يرجى إعادة المسح',
    'terminal key required': 'مطلوب رمز نقطة البيع',
    'terminal key is not assigned to any terminal': 'رمز نقطة البيع غير مرتبط بأي جهاز',
    'customer not found': 'العميل غير موجود',
    'user not added': 'تعذّر إضافة المستخدم',
    'incorrect login qr response': 'استجابة غير صحيحة لرمز تسجيل الدخول',
    'incorrect server response': 'استجابة غير صحيحة من الخادم',
    'incorrect generate qr response': 'استجابة غير صحيحة لإنشاء رمز QR',
    'incorrect qr response': 'استجابة غير صحيحة لرمز QR',

    // --- till / work day / trx lifecycle ---
    'no active till': 'لا يوجد صندوق نشط',
    'no active work day': 'لا يوجد يوم عمل نشط',
    'no active wrok day': 'لا يوجد يوم عمل نشط',
    'till is not open, no scan allowed': 'الصندوق غير مفتوح، لا يمكن المسح',
    'not valid trx mode': 'وضع الفاتورة غير صالح',
    'no barcode requested.': 'لم يتم إرسال باركود',
    '[/scannew] there is open transaction on till, please click on `restart`':
        'توجد فاتورة مفتوحة على هذا الصندوق — يرجى الضغط على «إعادة التشغيل»',
    'incorrect trx suspend id': 'رمز الفاتورة المعلّقة غير صحيح',
    'no suspended trx with that id': 'لا توجد فاتورة معلّقة بهذا الرمز',
    'not valid transaction': 'الفاتورة غير صالحة',
    'invalid transaction': 'الفاتورة غير صالحة',
    'not a valid transaction': 'الفاتورة غير صالحة',
    'transaction not open, cannot modify. click on restart': 'الفاتورة غير مفتوحة، لا يمكن تعديلها — يرجى الضغط على «إعادة التشغيل»',
    'payment complete, please close transaction': 'اكتمل الدفع، يرجى إغلاق الفاتورة',
    'exchange rates not defined from finance': 'أسعار الصرف غير محددة من قبل المالية',
    'not a valid payment': 'الدفعة غير صالحة',
    'cannot close zero/empty transaction': 'لا يمكن إغلاق فاتورة فارغة',
    'transaction payment not complete yet': 'لم يتم إكمال دفع الفاتورة بعد',
    'not a valid till': 'الصندوق غير صالح',
    'not a valid transaction line': 'سطر الفاتورة غير صالح',
    'not a valid transaction line ': 'سطر الفاتورة غير صالح',
    'till not open, thus cannot be locked': 'الصندوق غير مفتوح، لا يمكن قفله',
    'till already unlocked': 'الصندوق مفتوح مسبقًا',
    'till is closed': 'الصندوق مغلق',
    "cannot suspend transaction because it has 'active payments'": 'لا يمكن تعليق الفاتورة لوجود دفعات فعّالة عليها',
    'trx not linked with cashdro operation': 'الفاتورة غير مرتبطة بعملية ماكينة النقد',
    'no valid transaction': 'لا توجد فاتورة صالحة',
    '[/scannew] there is open transaction on till, please click on `restart`':
        'هناك فاتورة مفتوحة على هذه الصندوق — اضغط إعادة تشغيل (Restart)',
    'there is open transaction on till, please click on `restart`':
        'هناك فاتورة مفتوحة على هذه الصندوق — اضغط إعادة تشغيل (Restart)',
    'could not open transaction for loyalty card':
        'تعذّر فتح فاتورة لبطاقة الولاء — جرّب Restart ثم أعد المسح',
    'no open transactions': 'لا توجد فواتير مفتوحة',
    'no transaction line selected': 'لم يتم اختيار سطر من الفاتورة',
    'no payment line selected': 'لم يتم اختيار دفعة',
    'no valid selected till': 'لم يتم اختيار صندوق صالح',
    'till not submitted': 'لم يتم إرسال أرصدة الصندوق',
    'till force-closed': 'تم إغلاق الصندوق قسريًا',
    'saved. customer screens will refresh.': 'تم الحفظ. ستُحدَّث شاشات العميل.',
    'no open work day for store': 'لا يوجد يوم عمل مفتوح لهذا المتجر',
    'not a valid store': 'المتجر غير صالح',
    'no open work day': 'لا يوجد يوم عمل مفتوح',
    'not a valid work day': 'يوم العمل غير صالح',
    'cannot close till, balances are not submitted yet': 'لا يمكن إغلاق الصندوق، لم يتم إرسال الأرصدة بعد',
    'only open tills can be locked': 'يمكن قفل الصناديق المفتوحة فقط',
    'only locked tills can be deleted': 'يمكن حذف الصناديق المقفلة فقط',
    'till has transactions and cannot be deleted': 'الصندوق يحتوي على فواتير ولا يمكن حذفه',
    'cannot close work day with empty tills': 'لا يمكن إغلاق يوم العمل مع وجود صناديق فارغة',
    'not all tills are closed!': 'لم يتم إغلاق جميع الصناديق!',
    'trx not found': 'الفاتورة غير موجودة',

    // --- vouchers / cashback ---
    'invalid voucher code': 'رمز القسيمة غير صالح',
    'voucher already used!': 'القسيمة مستخدمة مسبقًا',
    'could not reach head office to validate the voucher. please try again.': 'تعذّر الاتصال بالمكتب الرئيسي للتحقق من القسيمة — حاول مرة أخرى',
    'could not reach head office to redeem the voucher. please try again.': 'تعذّر الاتصال بالمكتب الرئيسي لصرف القسيمة — حاول مرة أخرى',

    // --- frontend-authored notify() literals ---
    'only loyalty coupon barcodes can be scanned during payment':
        'أثناء الدفع يُسمح فقط بمسح باركود قسائم الولاء (VCH-)',
    'cannot scan item when in payment mode': 'لا يمكن مسح المنتج أثناء وضع الدفع — اضغط Abort/رجوع أولاً',
    'transaction paid, print invoice ☺': 'تم الدفع، جارٍ طباعة الفاتورة ☺',
    'trx tax exempted': 'تم إعفاء الفاتورة من الضريبة',
    'line price changed': 'تم تغيير سعر السطر',
    "incorrect /item/fastitems response": 'تعذّر تحميل المنتجات السريعة',
    'incorrect /payment-method/getcashnotes response': 'تعذّر تحميل فئات النقد',
    'incorrect /payment-method/getforeignnotes response': 'تعذّر تحميل العملات الأجنبية',
    'incorrect /currency/list response': 'تعذّر تحميل قائمة العملات',
    'incorrect /payment-methods/list response': 'تعذّر تحميل طرق الدفع',
    'incorrect /exchange-rates/list response': 'تعذّر تحميل أسعار الصرف',
    'incorrect trx/abortpayment/ response': 'تعذّر إلغاء عملية الدفع',
    'scale port opened': 'تم فتح منفذ الميزان',
    'scale port closed': 'تم إغلاق منفذ الميزان',
    'scale port is open': 'منفذ الميزان مفتوح',
    'scale port is not open': 'منفذ الميزان غير مفتوح',
    'scale zero command sent': 'تم إرسال أمر التصفير للميزان',
    'scale zero command failed': 'فشل أمر تصفير الميزان',
    'scale restart command sent': 'تم إرسال أمر إعادة تشغيل الميزان',
    'scale restart command failed': 'فشل أمر إعادة تشغيل الميزان',
    'please add item on scale first': 'ضع المنتج على الميزان أولاً',
    'auto visa does not support euro': 'الفيزا التلقائية لا تدعم اليورو',
    'selected currency has no exchange rate defined': 'لا يوجد سعر صرف محدد للعملة المختارة',
    'could not parse response data object!': 'تعذّر قراءة استجابة الخادم',
    'payment failed, please try again': 'فشلت عملية الدفع، حاول مرة أخرى',
    'cashdro does not support refunds': 'ماكينة النقد لا تدعم الإرجاع',
    'visa payment does not support refunds': 'الدفع بالفيزا لا يدعم الإرجاع',
    'employee balance does not support refunds': 'رصيد الموظف لا يدعم الإرجاع',
    '🔓 manager mode activated': '🔓 تم تفعيل وضع المدير',
    'no bop visa ip specified': 'لم يتم تحديد عنوان IP لفيزا بنك فلسطين',
    'bop visa linked': 'تم ربط فيزا بنك فلسطين',
    'please enter a reference number': 'أدخل رقم مرجعي',
    'please enter a mobile number': 'أدخل رقم الجوال',
    'club customer is scanned — mobile number is managed by the club profile.': 'تم مسح عضو النادي — رقم الجوال يُدار من خلال ملف النادي',
    'till is closed, restarting session...': 'الصندوق مغلق، جارٍ إعادة تشغيل الجلسة...',
    'network error': 'تعذّر الاتصال بالخادم — تحقّق من الشبكة',
    'no valid transaction to void': 'لا توجد فاتورة صالحة للإلغاء',
    'no valid transaction to suspend': 'لا توجد فاتورة صالحة للتعليق',
    'till cannot be locked, till not open': 'لا يمكن قفل الصندوق، الصندوق غير مفتوح',
};

// Dynamic messages with an interpolated value — matched in order, first
// hit wins. Each entry: [regex, (match) => arabicString].
const DYNAMIC_TEMPLATES = [
    [/^TRX\s+(\S+)\s+voided$/i, (m) => `الفاتورة ${m[1]} أُلغيت`],
    [/^TRX\s+(\S+)\s+suspended$/i, (m) => `الفاتورة ${m[1]} عُلّقت`],
    [/^Day Ended, New work day started for (.+)$/i, (m) => `تم إنهاء اليوم، بدأ يوم عمل جديد بتاريخ ${m[1]}`],
    [/^timeout of \d+ms exceeded$/i, () => 'انتهت مهلة الاتصال بالخادم'],
];

// Known "<label prefix><dynamic payload>" prefixes. The prefix is
// translated (or dropped — toast color already conveys severity) and the
// remainder is looked up again via EXACT_MAP / DYNAMIC_TEMPLATES / PHRASE_MAP.
const PREFIX_PATTERNS = [
    [/^error:\s*/i, ''],
    [/^could not print receipt\s*-\s*/i, 'تعذّرت طباعة الفاتورة — '],
    [/^could not link visa\s*/i, 'تعذّر ربط الفيزا — '],
    [/^otherscaleitems fetch failed:\s*/i, 'فشل تحميل عناصر الميزان — '],
    [/^update failed:\s*/i, 'فشل التحديث — '],
];

// Best-effort word/phrase substitutions for messages that don't have a
// dedicated translation yet (new/rare backend text). Applied globally;
// leaves brand/technical terms (CashDro, Visa, QR...) untouched, which is
// normal in Arabic retail UI copy.
const PHRASE_MAP = [
    [/not a valid/gi, 'غير صالح'],
    [/not valid/gi, 'غير صالح'],
    [/is required/gi, 'مطلوب'],
    [/not found/gi, 'غير موجود'],
    [/already used/gi, 'مستخدم مسبقًا'],
    [/please try again/gi, 'حاول مرة أخرى'],
    [/cannot be undone/gi, 'لا يمكن التراجع عنه'],
];

const containsArabic = (s) => /[\u0600-\u06FF]/.test(s);

const lookupExact = (text) => EXACT_MAP[text.toLowerCase().trim()];

const lookupDynamic = (text) => {
    for (const [regex, fn] of DYNAMIC_TEMPLATES) {
        const m = text.match(regex);
        if (m) return fn(m);
    }
    return null;
};

const fallbackFor = (sev) => {
    if (sev === 'error') return 'حدث خطأ، حاول مرة أخرى';
    if (sev === 'warning') return 'تنبيه — تحقّق من العملية';
    if (sev === 'success') return 'تم تنفيذ العملية بنجاح';
    return 'تم تنفيذ العملية';
};

/**
 * Translate a raw (usually English, sometimes backend-supplied) toast /
 * warning / error string to Arabic. Safe to call with already-Arabic
 * text (passed through unchanged) or with non-string / empty input.
 */
export const arabicize = (rawMsg, sev = 'info') => {
    if (rawMsg == null) return rawMsg;

    let msg = typeof rawMsg === 'string' ? rawMsg : (rawMsg.message || JSON.stringify(rawMsg));
    msg = ('' + msg).trim();
    if (!msg) return msg;

    // Self-service (and any future) call sites that already dispatch
    // Arabic text — leave completely untouched.
    if (containsArabic(msg)) return msg;

    // 1. Whole-string dynamic template.
    const dyn = lookupDynamic(msg);
    if (dyn) return dyn;

    // 2. Whole-string exact match.
    const exact = lookupExact(msg);
    if (exact) return exact;

    // 3. Strip a known prefix, then retry exact/dynamic/phrase on the rest.
    let prefixAr = '';
    let rest = msg;
    for (const [regex, ar] of PREFIX_PATTERNS) {
        const m = rest.match(regex);
        if (m) {
            prefixAr = ar;
            rest = rest.slice(m[0].length).trim();
            break;
        }
    }

    if (rest !== msg) {
        const restDyn = lookupDynamic(rest);
        if (restDyn) return prefixAr + restDyn;

        const restExact = lookupExact(rest);
        if (restExact) return prefixAr + restExact;
    }

    // 4. Best-effort phrase substitution (partial translation).
    // [bugfix] Using `.test()` on a reused global-flag RegExp mutates its
    // `lastIndex` across calls, which would silently break detection on
    // later invocations. Compare `.replace()` output instead — safe with
    // global regexes since replace() manages lastIndex internally.
    let translated = rest;
    let changed = false;
    for (const [phraseRegex, ar] of PHRASE_MAP) {
        const next = translated.replace(phraseRegex, ar);
        if (next !== translated) {
            translated = next;
            changed = true;
        }
    }
    if (changed) return (prefixAr + translated).trim();

    // 5. Nothing matched at all — never show raw, un-translated English.
    return prefixAr ? (prefixAr + fallbackFor(sev)) : fallbackFor(sev);
};

export default arabicize;
