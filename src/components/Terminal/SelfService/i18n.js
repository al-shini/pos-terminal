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
    card: 'بطاقة',
    cardDisabled: 'الدفع بالبطاقة غير متاح حاليًا',

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
    cashDroTimeout: 'انتهت مهلة الدفع — لم يكتمل الدفع',
    cashDroError: 'خطأ في ماكينة الدفع',
    paymentFailed: 'فشل الدفع النقدي',
    noItemSelected: 'لم يتم اختيار منتج',
    noOrderToCancel: 'لا يوجد طلب لإلغائه',
    couldNotCancelPayment: 'تعذّر إلغاء الدفع',
    manualChangeNeeded: (amt, cur) => `يلزم صرف باقي يدويًا: ${amt} ${cur}`,
    receivedChange: (recv, chg) => `تم استلام ${recv} — الباقي ${chg}`,
};

export default AR;
