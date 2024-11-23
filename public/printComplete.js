const { PDFDocument, rgb } = require('pdf-lib');
const fontkit = require('@pdf-lib/fontkit');
const fs = require('fs');
const { print } = require('pdf-to-printer');
const qr = require('qrcode');

let localConfigFile = fs.readFileSync('C:/pos/posconfig.json');
let localConfig = JSON.parse(localConfigFile);

const reverseNumber = (number) => {
    return number.toString().split('').reverse().join('');
};

const printComplete = async (object) => {
    const pdfDoc = await PDFDocument.create();
    pdfDoc.registerFontkit(fontkit);

    const page = pdfDoc.addPage([210, 400 + (object.lines.length * 40)]);
    const { width, height } = page.getSize();
    console.log('height');
    console.log(height);


    // Embed the Arial font
    let arialFontBytes;

    try {
        arialFontBytes = fs.readFileSync('C:\\pos\\arialbold.ttf');
    } catch (err) {
        console.log('arialbold.ttf not found, using arial.ttf');
        arialFontBytes = fs.readFileSync('C:\\pos\\arial.ttf');
    }

    const arialFont = await pdfDoc.embedFont(arialFontBytes);

    // Embed the logo image
    const logoBytes = fs.readFileSync('C:\\pos\\logo.png');
    const logoImage = await pdfDoc.embedPng(logoBytes);

    // Generate QR code
    // const qrCodeBytes = await qr.toBuffer(object.qr);
    // const qrImage = await pdfDoc.embedPng(qrCodeBytes);

    let fontSize = 7.5;

    // Draw the logo
    const logoWidth = 180; // Adjust as needed
    const logoHeight = (logoImage.height / logoImage.width) * logoWidth;
    page.drawImage(logoImage, {
        x: 10 + (width - logoWidth) / 2,
        y: height - logoHeight - 5,
        width: logoWidth,
        height: logoHeight,
    });

    // Extract and draw the transaction ID above the store detail
    const transactionID = object.qr.split('_')[1];
    page.drawText(`Transaction ID: ${transactionID}`, {
        x: 20,
        y: height - logoHeight - 15,
        size: 10,
    });
    page.drawText(`Tax #: 040252388`, {
        x: 20,
        y: height - logoHeight - 35,
        size: 8
    });

    // Draw the additional details in a 2x2 grid
    const detailsYStart = height - logoHeight - 50;
    const detailsXStart = 20;
    const detailsXEnd = width - 5;

    page.setFont(arialFont);
    page.setFontSize(fontSize);

    // Store name
    page.drawText(`Store: ${object.store}`, {
        x: detailsXStart,
        y: detailsYStart,
    });

    // Cashier name
    page.drawText(`Cashier: ${object.cashier} POS ${object.terminal}`, {
        x: detailsXEnd - arialFont.widthOfTextAtSize(`Cashier: ${object.cashier}`, fontSize),
        y: detailsYStart,
    });

    // Date and time
    page.drawText(`Date: ${object.date}`, {
        x: detailsXStart,
        y: detailsYStart - 12.5,
    });

    // Type
    page.drawText(`Type: ${object.type}`, {
        x: detailsXEnd - arialFont.widthOfTextAtSize(`Type: ${object.type}`, fontSize),
        y: detailsYStart - 12.5,
    });

    // Draw a dashed line
    const lineYPosition = detailsYStart - 25;
    const lineDash = [3, 1]; // Dash pattern: 5 units on, 5 units off
    page.drawLine({
        start: { x: 0, y: lineYPosition },
        end: { x: width, y: lineYPosition },
        thickness: 1,
        color: rgb(0, 0, 0),
        dashArray: lineDash,
    });

    // Draw the items grid
    let yPosition = lineYPosition - 20;
    fontSize = 10;
    page.setFontSize(fontSize);

    // Table headers
    const headers = ['الإجمالي', 'السعر', 'الكمية', 'الوصف'];
    const headerPositions = [60, 90, 115, 200];

    headers.forEach((header, index) => {
        const textWidth = arialFont.widthOfTextAtSize(header, fontSize);
        page.drawText(header, { x: headerPositions[index] - textWidth, y: yPosition });
    });

    yPosition -= 15;

    // Table rows
    fontSize = 9;
    page.setFontSize(fontSize);
    object.lines.forEach((item) => {
        let textWidth;
        let offer = false;

        if (item.totalPrice !== item.finalPrice) {
            offer = true;
            // Original total price with strikethrough
            textWidth = arialFont.widthOfTextAtSize(item.totalPrice.toFixed(localConfig.systemCurrency === 'NIS' ? 2 : 3), fontSize);
            page.drawText(item.totalPrice.toFixed(localConfig.systemCurrency === 'NIS' ? 2 : 3), { x: headerPositions[0] - textWidth, y: yPosition, color: rgb(1, 0, 0) });
            page.drawLine({
                start: { x: headerPositions[0] - textWidth, y: yPosition + 2 },
                end: { x: headerPositions[0], y: yPosition + 2 },
                thickness: 1,
                color: rgb(1, 0, 0),
            });

            // Original price per unit with strikethrough
            textWidth = arialFont.widthOfTextAtSize((item.totalPrice / item.quantity).toFixed(localConfig.systemCurrency === 'NIS' ? 2 : 3), fontSize);
            page.drawText((item.totalPrice / item.quantity).toFixed(localConfig.systemCurrency === 'NIS' ? 2 : 3), { x: headerPositions[1] - textWidth, y: yPosition, color: rgb(1, 0, 0) });
            page.drawLine({
                start: { x: headerPositions[1] - textWidth, y: yPosition + 2 },
                end: { x: headerPositions[1], y: yPosition + 2 },
                thickness: 1,
                color: rgb(1, 0, 0),
            });

            yPosition -= 10;

            // Discounted total price
            textWidth = arialFont.widthOfTextAtSize(item.finalPrice.toFixed(localConfig.systemCurrency === 'NIS' ? 2 : 3), fontSize);
            page.drawText(item.finalPrice.toFixed(localConfig.systemCurrency === 'NIS' ? 2 : 3), { x: headerPositions[0] - textWidth, y: yPosition });

            // Discounted price per unit
            textWidth = arialFont.widthOfTextAtSize((item.finalPrice / item.quantity).toFixed(localConfig.systemCurrency === 'NIS' ? 2 : 3), fontSize);
            page.drawText((item.finalPrice / item.quantity).toFixed(localConfig.systemCurrency === 'NIS' ? 2 : 3), { x: headerPositions[1] - textWidth, y: yPosition });
        } else {
            // Regular price
            textWidth = arialFont.widthOfTextAtSize(item.finalPrice.toFixed(localConfig.systemCurrency === 'NIS' ? 2 : 3), fontSize);
            page.drawText(item.finalPrice.toFixed(localConfig.systemCurrency === 'NIS' ? 2 : 3), { x: headerPositions[0] - textWidth, y: yPosition });

            textWidth = arialFont.widthOfTextAtSize((item.totalPrice / item.quantity).toFixed(localConfig.systemCurrency === 'NIS' ? 2 : 3), fontSize);
            page.drawText((item.totalPrice / item.quantity).toFixed(localConfig.systemCurrency === 'NIS' ? 2 : 3), { x: headerPositions[1] - textWidth, y: yPosition });
        }

        // Quantity and description
        textWidth = arialFont.widthOfTextAtSize(item.quantity.toString(), fontSize);
        page.drawText(item.quantity.toString(), { x: headerPositions[2] - textWidth, y: yPosition });

        textWidth = arialFont.widthOfTextAtSize(item.description, fontSize);
        page.drawText(item.description, { x: headerPositions[3] - textWidth, y: yPosition });

        yPosition -= 12.5;
    });

    // Draw the total, discount, paid, and change in a 2x2 grid in Arabic
    const summaryYStart = yPosition - 15;

    const summaryLabels = ['المجموع النهائي', 'مجموع التوفير', 'المدفوع', 'الباقي', 'قيمة الضريبة', 'خصم ضريبي'];
    const summaryValues = [
        object.total.toFixed(localConfig.systemCurrency === 'NIS' ? 2 : 3),
        object.discount.toFixed(localConfig.systemCurrency === 'NIS' ? 2 : 3),
        object.paid.toFixed(localConfig.systemCurrency === 'NIS' ? 2 : 3),
        object.change.toFixed(localConfig.systemCurrency === 'NIS' ? 2 : 3),
        object.totalTax.toFixed(localConfig.systemCurrency === 'NIS' ? 2 : 3),
        object.taxDiscount ? object.taxDiscount.toFixed(localConfig.systemCurrency === 'NIS' ? 2 : 3) : 0.000,
    ];

    page.setFontSize(fontSize);

    page.drawLine({
        start: { x: 0, y: summaryYStart + 20 },
        end: { x: width, y: summaryYStart + 20 },
        thickness: 1,
        color: rgb(0, 0, 0),
        dashArray: lineDash,
    });

    // المجموع النهائي (Total)
    page.drawText(`${summaryLabels[0]}: ${reverseNumber(summaryValues[0])} ${localConfig.systemCurrency === 'NIS' ? '₪' : 'DJ'}`, {
        x: detailsXEnd - arialFont.widthOfTextAtSize(`${summaryLabels[0]}: ${reverseNumber(summaryValues[0])} ${localConfig.systemCurrency === 'NIS' ? '₪' : 'DJ'}`, fontSize),
        y: summaryYStart,
    });

    // مجموع الخصم (Discount)
    page.drawText(`${summaryLabels[1]}: ${reverseNumber(summaryValues[1])} ${localConfig.systemCurrency === 'NIS' ? '₪' : 'DJ'}`, {
        x: detailsXStart,
        y: summaryYStart,
    });

    // المدفوع (Paid)
    page.drawText(`${summaryLabels[2]}: ${reverseNumber(summaryValues[2])} ${localConfig.systemCurrency === 'NIS' ? '₪' : 'DJ'}`, {
        x: detailsXEnd - arialFont.widthOfTextAtSize(`${summaryLabels[2]}: ${reverseNumber(summaryValues[2])} ${localConfig.systemCurrency === 'NIS' ? '₪' : 'DJ'}`, fontSize),
        y: summaryYStart - 12.5,
    });

    // الباقي (Change)
    page.drawText(`${summaryLabels[3]}: ${reverseNumber(summaryValues[3])} ${localConfig.systemCurrency === 'NIS' ? '₪' : 'DJ'}`, {
        x: detailsXStart,
        y: summaryYStart - 12.5,
    });

    // Tax Total
    page.drawText(`${summaryLabels[4]}: ${reverseNumber(summaryValues[4])} ${localConfig.systemCurrency === 'NIS' ? '₪' : 'DJ'}`, {
        x: detailsXEnd - arialFont.widthOfTextAtSize(`${summaryLabels[4]}: ${reverseNumber(summaryValues[4])} ${localConfig.systemCurrency === 'NIS' ? '₪' : 'DJ'}`, fontSize),
        y: summaryYStart - 25,
    });

    // Tax discount
    page.drawText(`${summaryLabels[5]}: ${reverseNumber(summaryValues[5])} ${localConfig.systemCurrency === 'NIS' ? '₪' : 'DJ'}`, {
        x: detailsXStart,
        y: summaryYStart - 25,
    });

    let yAxisPointer = 25;

    yAxisPointer += 20;

    object.payments.map((payment) => {
        page.drawText(`► ${payment.amount} in ${payment.paymentMethodName} (${payment.currency})`, {
            x: detailsXStart,
            y: summaryYStart - yAxisPointer,
        });
        yAxisPointer += 12.5;
    })



    // Draw the "thank you" message
    const thankYouMessage = "شكرا لتسوقكم لدى الشني إكسترا";
    const thankYouMessageWidth = arialFont.widthOfTextAtSize(thankYouMessage, fontSize);
    page.drawText(thankYouMessage, {
        x: (width - thankYouMessageWidth) / 2,
        y: summaryYStart - (5 + yAxisPointer),
    });

    // Draw the QR code next to the "thank you" message
    const qrWidth = 100; // Adjust size as needed
    const qrHeight = 100;
    // page.drawImage(qrImage, {
    //     x: (width - qrWidth) / 2, // Center the QR code
    //     y: summaryYStart - 140, // Position below the "thank you" message
    //     width: qrWidth,
    //     height: qrHeight,
    // });

    // Save the PDF to a file
    const pdfBytes = await pdfDoc.save();
    fs.writeFileSync('C:\\pos\\invoice.pdf', pdfBytes);

    console.log('PDF created successfully');

    print('C:\\pos\\invoice.pdf', { scale: 'noscale' });
};

module.exports = printComplete;
