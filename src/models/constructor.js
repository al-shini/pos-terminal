const construct = (model) => {

    switch (model) {
        case 'item-line': return {
            image: '',
            itemCode: '',
            barcode: '',
            description: '',
            lineQty: 0,
            price: 0,
            discountAmt: 0.0,
            lineTotal: 0
        };
    }
}

export default construct;