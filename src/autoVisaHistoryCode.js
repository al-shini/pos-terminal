/**
 * This code is store in a comment, it is designed and written to work directly in Terminal.js file.
 */
/*const arabBankVisaFlow = () => {
    axios({
        method: 'post',
        data: {
            id,
            amt,
            curr
        },
        url: 'http://127.0.0.1:3001/visaPurchaseCommand'
    }).then((response) => {
        try {
            let makePayment = false;

            const badFormatData = response.data;
            const responseDataAsString = badFormatData.split("{")[1].split("}")[0];
            const responseData = JSON.parse("{" + responseDataAsString + "}");
            console.log(responseData, responseData.RespCode);
            if (responseData.RespCode === '-139') {
            } else if (responseData.RespCode === '000') {
                makePayment = true;
            } else if (responseData.RespCode === '001') {
                makePayment = true;
            } else if (responseData.RespCode === '003') {
                makePayment = true;
            } else if (responseData.RespCode === '004') {
                makePayment = true;
            } else if (responseData.RespCode === '007') {
                makePayment = true;
            } else if (responseData.RespCode === '010') {
                makePayment = true;
            }

            if (makePayment) {
                dispatch(notify({ msg: responseData.RespDesc, sev: 'info' }));
                const transactionAmountAsString = responseData.TransAmount;
                const transactionAmount = parseFloat(transactionAmountAsString) / 100;

                dispatch(submitPayment({
                    tillKey: terminal.till ? terminal.till.key : null,
                    trxKey: trxSlice.trx ? trxSlice.trx.key : null,
                    paymentMethodKey: trxSlice.selectedPaymentMethod,
                    currency: trxSlice.selectedCurrency,
                    amount: transactionAmount,
                    sourceKey: 'AUTO VISA'
                }))
            }

        } catch (e) {
            console.log(e);
            dispatch(notify({ msg: 'could not parse response data object!', sev: 'error' }));
        }
        dispatch(hideLoading())
    }).catch((error) => {
        if (error.response) {
            if (error.response.status === 401) {
                dispatch(notify({ msg: 'Un-Authorized', sev: 'error' }))
            } else {
                dispatch(notify({ msg: error.response.data, sev: 'error' }));
            }
        } else {
            dispatch(notify({ msg: error.message, sev: 'error' }));
        }
        dispatch(hideLoading())
    });
} */