/**
 * Arabic strings for the self-checkout UI. Self-service is Arabic-only
 * (RTL) by product decision — no runtime language toggle.
 */
const AR = {
    // Header
    selfCheckout: 'الخدمة الذاتية',
    ready: 'جاهز',
    tillSetupRequired: 'يلزم تجهيز الصندوق',
    staffAccess: 'دخول الموظفين',

    // Idle
    waitingForScan: 'بانتظار مسح المنتج…',
    scanToBegin: 'امسح منتجًا للبدء',
    pointScanner: 'قرّب باركود المنتج من الماسح الضوئي',
    fruitsVeg: 'خضار وفواكه',
    weighProduce: 'المنتجات الموزونة',
    chooseFromList: 'اختر من القائمة',
    noBarcode: 'لا يوجد باركود أو غير مقروء؟',
    typeBarcode: 'أدخل باركود',
    lastScan: 'آخر منتج ممسوح',
    youSaved: 'وفّرت',
    enterNumbers: 'اكتب الأرقام يدويًا',

    // Guide steps
    step1: 'امسح منتجاتك',
    step2: 'اضغط "ادفع"',
    step3: 'نقدًا أو بطاقة',
    step2and3: 'ادفع نقدًا أو بطاقة',
    step4: 'خذ الفاتورة',
    howItWorks: 'خطوات الشراء',

    // Cart
    yourItems: 'مشترياتك',
    itemCount: 'العدد',
    scanToStart: 'امسح منتجًا للبدء',
    holdBarcode: 'قرّب الباركود من الماسح الضوئي',
    removeItem: 'حذف المنتج',
    finishOrCancelPayment: 'أكمل الدفع أو ألغِه قبل إضافة منتجات جديدة',

    // Quantity multiplier
    qty: 'الكمية',
    qtyTitle: 'كم قطعة من نفس المنتج؟',
    qtyHint: 'حدّد العدد ثم امسح المنتج مرة واحدة',
    qtyConfirm: 'تأكيد العدد',
    qtyArmed: (n) => `المنتج التالي سيُضاف ×${n} — امسحه الآن`,
    qtyCancelArmed: 'إلغاء العدد',
    multipleItems: 'أكثر من قطعة من نفس المنتج؟',
    setQty: 'حدّد الكمية',

    // Scan error (barcode not recognized)
    barcodeNotFoundTitle: 'عذرًا، لم نتعرّف على هذا الباركود',
    barcodeNotFoundHint: 'حاول مسح المنتج مرة أخرى، أو اطلب المساعدة من الموظف',
    tryAgain: 'حسنًا، سأحاول مجددًا',

    // Footer / actions
    total: 'المجموع',
    cancel: 'إلغاء',
    cancelOrder: 'إلغاء الطلب',
    scale: 'الميزان',
    pay: 'ادفع',

    // Pay modal
    howToPay: 'كيف تودّ الدفع؟',
    amountDue: 'المبلغ المطلوب',
    cash: 'نقدًا',
    cashNote: 'أدخل النقود في الماكينة',
    cashPreparing: 'جارٍ تجهيز ماكينة النقد...',
    card: 'بطاقة',
    cardDisabled: 'الدفع بالبطاقة غير متاح حاليًا',
    visa: 'فيزا',
    visaNote: 'يتطلب موافقة المشرف',
    visaNoteTerminal: 'ادفع على جهاز البطاقة',

    // Visa manual-approval screen
    visaScanTitle: 'الدفع بالفيزا',
    visaPreparing: 'جارٍ تحضير رمز التفويض…',
    visaScanHint: 'اطلب من المشرف أو الكاشير الرئيسي مسح الرمز بجهازه لإتمام الدفع',
    visaCancelled: 'تم إلغاء طلب الدفع بالفيزا',

    // Card-terminal (BOP) payment screen
    cardTerminalTitle: 'الدفع بالبطاقة',
    cardTerminalPrompt: 'أدخل أو مرّر بطاقتك على جهاز الدفع',
    cardTerminalHint: 'اتبع التعليمات الظاهرة على جهاز الدفع ثم أدخل الرقم السري',
    cardTerminalWorking: 'جارٍ إتمام العملية… الرجاء عدم سحب البطاقة',
    cardTerminalDeclined: 'لم تتم الموافقة على الدفع',
    cardTerminalTryAgain: 'يمكنك المحاولة مرة أخرى أو اختيار طريقة دفع أخرى',
    cardTerminalUnknownTitle: 'يرجى انتظار الموظف',
    cardTerminalUnknownHint: 'تعذّر التأكد من نتيجة العملية. لا تعِد المحاولة — يرجى مراجعة الموظف للتحقق من جهاز الدفع.',
    cardTerminalNotLinked: 'جهاز الدفع غير مربوط بهذه المحطة',
    cardTerminalBusy: 'جهاز الدفع مشغول بعملية أخرى',
    backToCart: 'العودة للسلة',
    callStaff: 'استدعاء الموظف',
    cardTerminalStaffClear: 'للموظفين: إنهاء هذه العملية',
    cardTerminalStuckHint: 'يبدو أن العملية تأخرت. إذا انتهت على جهاز الدفع، يمكن للموظف إنهاؤها من هنا بعد التحقق من الجهاز.',

    // Staff menu → card terminal setup
    cardTerminalSetup: 'جهاز الدفع بالبطاقة',
    cardTerminalSetupSubtitle: 'ربط أو فصل جهاز الدفع الخاص ببنك فلسطين',
    cardTerminalLinked: 'مربوط',
    cardTerminalUnlinked: 'غير مربوط',
    cardTerminalConnection: 'المنفذ',
    cardTerminalSerialPort: 'منفذ تسلسلي (COM)',
    cardTerminalNetwork: 'شبكة (IP)',
    cardTerminalRefreshPorts: 'تحديث المنافذ',
    cardTerminalNoPorts: 'لا توجد منافذ تسلسلية متاحة',
    cardTerminalIpPlaceholder: 'مثال: 192.168.1.50',
    cardTerminalLink: 'ربط الجهاز',
    cardTerminalUnlink: 'فصل الجهاز',
    cardTerminalTest: 'اختبار الاتصال',
    cardTerminalLinking: 'جارٍ الربط… اتبع التعليمات على الجهاز',
    cardTerminalTesting: 'جارٍ الاختبار…',
    cardTerminalLinkOk: 'تم ربط جهاز الدفع بنجاح',
    cardTerminalUnlinkOk: 'تم فصل جهاز الدفع',
    cardTerminalReachable: 'الجهاز متصل ويستجيب',
    cardTerminalUnreachable: 'لا يوجد رد من الجهاز — تحقق من الكابل ومن تشغيل الجهاز',
    cardTerminalRelinkWarning: 'الجهاز مربوط حاليًا. الربط من جديد سيستبدل المفاتيح المخزّنة.',
    cardTerminalConfirmRelink: 'تأكيد الربط من جديد',
    cardTerminalProbing: 'جارٍ التحقق من المنفذ…',
    cardTerminalNoAnswerOn: (port) => `لا يوجد رد على ${port}. تأكد من تشغيل الجهاز ومن وضع ECR ومن أن الكابل موصول بهذا المنفذ.`,
    cardTerminalLinkAnyway: 'تجاهل وحاول الربط',
    // The station remembers a port that Windows is no longer showing — almost
    // always an unplugged adapter, and worth saying outright.
    cardTerminalLinkedPortMissing: (port) => `المنفذ المحفوظ ${port} غير موجود حاليًا — يبدو أن الكابل مفصول.`,
    cardTerminalPortUnlikely: 'غير مرجّح',

    // CashDro screen
    insertCash: 'أدخل النقود',
    insertedSoFar: 'المبلغ المُدخل',
    cancelPayment: 'إلغاء الدفع',
    waitingCashMachine: 'الرجاء إدخال النقود في الماكينة…',
    startingCashMachine: 'جارٍ تشغيل ماكينة الدفع…',
    insertAmountMsg: (amount, currency) => `الرجاء إدخال ${amount} ${currency} في الماكينة`,
    waitingCustomerMsg: (inserted, currency) => `بانتظار إتمام الدفع… المُدخل: ${inserted} ${currency}`,

    // Receipt screen
    paymentComplete: 'تم الدفع بنجاح',
    takeYourReceipt: 'الرجاء أخذ الفاتورة',
    paid: 'المدفوع',
    change: 'الباقي',
    thankYou: 'شكرًا لتسوّقكم معنا — نراكم قريبًا!',
    done: 'إنهاء',
    autoCloseIn: (s) => `تُغلق الشاشة تلقائيًا خلال ${s} ثانية`,

    // Keypad
    typeBarcodeTitle: 'أدخل رقم الباركود',
    typeBarcodeHint: 'استخدم هذه الشاشة إذا تعذّر مسح الباركود',
    keypadPlaceholder: 'أدخل الأرقام…',
    addItem: 'إضافة المنتج',

    // Scale panel
    fruitsVegTitle: 'الخضار والفواكه',
    scaleWeighHint: 'ضع المنتج على الميزان ثم اختره من القائمة',
    scaleSearchPlaceholder: 'ابحث بالاسم…',
    scalePopular: 'الأكثر طلبًا',
    scaleShowAll: 'الكل',
    scaleItemCount: (n) => `${n} منتج`,
    scaleNoPopular: 'لا توجد منتجات شائعة بعد — جرّب عرض الكل أو ابحث بالاسم',
    scaleNoLetterResults: 'لا توجد منتجات بهذا الحرف',
    scaleNoSearchResults: 'لا نتائج مطابقة للبحث',
    close: 'إغلاق',
    all: 'الكل',
    fruits: 'فواكه',
    vegetables: 'خضار',
    others: 'أخرى',
    scaleOffline: 'الميزان غير متصل — الوزن غير متاح حاليًا. اطلب مساعدة الموظف.',
    noItems: 'لا توجد منتجات متاحة',

    // Staff / lock
    terminalLocked: 'الجهاز مُقفل',
    askStaffUnlock: 'اطلب من الموظف فتح الصندوق',
    staffUnlock: 'فتح بواسطة الموظف',
    signOut: 'تسجيل الخروج',
    staffMenu: 'قائمة الموظفين',
    chooseAction: 'اختر إجراءً',
    lockTill: 'إقفال الصندوق',
    logout: 'تسجيل الخروج',
    enterPasswordFor: (u) => `أدخل كلمة المرور للمستخدم ${u}`,
    enterCashierPassword: 'أدخل كلمة مرور الكاشير',
    checking: 'جارٍ التحقق…',
    unlock: 'فتح',
    incorrectPassword: 'كلمة المرور غير صحيحة',
    couldNotVerify: 'تعذّر التحقق من كلمة المرور',
    restart: 'إعادة تشغيل الجهاز',

    // Suspended orders panel
    suspendedOrders: 'الطلبات المعلّقة',
    suspendedOrdersSubtitle: 'اختر طلبًا لاستعادته',
    suspendedEmpty: 'لا توجد طلبات معلّقة حاليًا',
    suspendedFinishCurrentFirst: 'أنهِ أو أَلغِ الطلب الحالي أولًا لاستعادة طلب معلّق',
    resume: 'استعادة',
    suspendedAt: (time) => `الساعة ${time}`,

    // Confirm dialogs
    confirmRemoveItemTitle: 'حذف هذا المنتج؟',
    confirmCancelOrderTitle: 'إلغاء الطلب؟',
    confirmCancelOrderMsg: 'سيتم حذف جميع المنتجات',
    confirm: 'تأكيد',
    confirmSubtitle: 'الرجاء التأكيد للمتابعة',

    // Notifications (self-service specific)
    noTrxOpen: 'لا يوجد طلب مفتوح',
    cashMachineNotConfigured: 'ماكينة الدفع غير مهيأة على هذا الجهاز. اطلب مساعدة الموظف.',
    noRemainingAmount: 'لا يوجد مبلغ متبقٍ للدفع',
    cashDroCancelled: 'تم إلغاء الدفع النقدي',
    cashDroReturnFailed: 'تعذّر تأكيد استرجاع النقود من الماكينة — يرجى طلب مساعدة الموظف',
    cashDroTimeout: 'انتهت مهلة الدفع — لم يكتمل الدفع',
    cashDroError: 'خطأ في ماكينة الدفع',
    paymentFailed: 'فشل الدفع النقدي',
    noItemSelected: 'لم يتم اختيار منتج',
    noOrderToCancel: 'لا يوجد طلب لإلغائه',
    couldNotCancelPayment: 'تعذّر إلغاء الدفع',
    manualChangeNeeded: (amt, cur) => `يلزم صرف باقي يدويًا: ${amt} ${cur}`,
    receivedChange: (recv, chg) => `تم استلام ${recv} — الباقي ${chg}`,
    cashDroUnreachable: 'انقطع الاتصال بماكينة النقود — يرجى طلب مساعدة الموظف',
    finalizingPayment: 'جارٍ إتمام الفاتورة… لا تغادر',
    cashDroAmountMismatch: (got, expected) => `تنبيه: احتفظت الماكينة بـ ${got} بدلًا من ${expected} — يرجى مراجعة الموظف`,

    // Cash taken by the machine but not recorded on the sale — blocks the lane
    cashHeldTitle: 'يرجى انتظار الموظف',
    cashHeldHint: 'تم استلام نقودك ولكن لم يكتمل تسجيل الفاتورة. لا تدفع مرة أخرى — الموظف سيكمل العملية.',
    cashHeldAmount: 'المبلغ المستلم',
    cashHeldReference: 'رقم العملية',
    staffClearHold: 'للموظفين: إنهاء هذه العملية',
    // The sale IS paid here — only printing/closing failed. Saying "your money
    // was not recorded" would be both wrong and needlessly alarming.
    cashPaidNotClosedTitle: 'تم الدفع — بانتظار الموظف',
    cashPaidNotClosedHint: 'تم تسجيل دفعتك بنجاح ولكن لم تتم طباعة الفاتورة. لا تدفع مرة أخرى — الموظف سيطبعها لك.',
    visaChargedNotSettled: 'تم خصم المبلغ من البطاقة ولم تُغلق الفاتورة — لا تدفع مرة أخرى، اطلب مساعدة الموظف',

    // Loyalty card attach
    clubMember: 'عضو نادي شني',
    club: 'عضو نادي',
    employeeTag: 'موظف',
    removeCustomer: 'إزالة البطاقة',
    cardRecognized: 'تم التعرف على بطاقتك — أهلًا بك',
    customerRemoved: 'تمت إزالة البطاقة',
    employeeBalance: 'رصيد الموظف',
    cardNotFoundTitle: 'لم يتم التعرف على البطاقة',
    cardNotFoundHint: 'تأكد من أن البطاقة صالحة، أو اطلب مساعدة الموظف',

    remainingToPay: 'المتبقي',

    // Auto-suspend on stale open transaction
    autoSuspendedNotice: 'تم تعليق طلب سابق غير مكتمل تلقائيًا — يمكن استرجاعه من قائمة الطلبات المعلّقة',
};

export default AR;
