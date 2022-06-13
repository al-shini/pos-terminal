import { faMoneyBill, faCreditCard, faWallet, faIdCard, faTag, 
    faArrowUp19, faPercent, faEraser, faPause, faBan, faRotateLeft
} from '@fortawesome/free-solid-svg-icons';


const buildActions = (mode ) => {
    let tmp = [];

    switch (mode) {
        case 'payment':

            tmp.push({
                icon: faMoneyBill,
                label: 'Cash'
            })

            tmp.push({
                icon: faCreditCard,
                label: 'Credit Card'
            })

            tmp.push({
                icon: faWallet,
                label: 'Jawwal Pay'
            })

            tmp.push({
                icon: faIdCard,
                label: 'On Account'
            })

            break;

        case 'operations':

            tmp.push({
                icon: faTag,
                label: 'Price Change'
            })

            tmp.push({
                icon: faArrowUp19,
                label: 'QTY Change'
            })

            tmp.push({
                icon: faPercent,
                label: 'Line Discount'
            })

            tmp.push({
                icon: faEraser,
                label: 'Void Item'
            })

            tmp.push({
                icon: faBan,
                label: 'Void TRX'
            })

            tmp.push({
                icon: faPause,
                label: 'Suspend TRX'
            })

            tmp.push({
                icon: faRotateLeft,
                label: 'Refund',
            })
            break;

        case 'fastItems':

            break;
    }
    
    return tmp;
}


 export default buildActions;