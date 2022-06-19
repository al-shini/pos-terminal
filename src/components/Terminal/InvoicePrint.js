import React, { useRef } from 'react';
import { useDispatch, useSelector } from 'react-redux'

import ReactToPrint from 'react-to-print';
import QRCode from "react-qr-code";
import { Button, Divider, FlexboxGrid } from 'rsuite';
import FlexboxGridItem from 'rsuite/esm/FlexboxGrid/FlexboxGridItem';

const InvoicePrint = (props) => {
    const toPrintRef = useRef();


    const terminal = useSelector((state) => state.terminal);
    const trxSlice = useSelector((state) => state.trx);

    const dispatch = useDispatch();


    return (
        <React.Fragment>
            <ReactToPrint
                trigger={() => <Button id='bboy' style={{ visibility: 'hidden', height: '0px', width: '0px', padding: '0px', margin: '0px', position: 'fixed' }} ></Button>}
                content={() => toPrintRef.current}
            />

            {
                trxSlice.trx &&
                <div ref={toPrintRef} style={{ width: '100%', textAlign: 'center' }}>
                    <FlexboxGrid>
                        <FlexboxGridItem colspan={24}>
                            <br />
                        </FlexboxGridItem>
                        <FlexboxGridItem colspan={8}>
                            <span>{new Date().toString()}</span>
                        </FlexboxGridItem>
                        <FlexboxGridItem colspan={8}>
                            {trxSlice.trx.totalafterdiscount}
                        </FlexboxGridItem>
                        <FlexboxGridItem colspan={8}>

                        </FlexboxGridItem>
                        <FlexboxGridItem colspan={24}>
                            <Divider />
                            <div style={{ width: '100%', textAlign: 'center' }}>
                                <QRCode value={JSON.stringify(trxSlice.trx.key)} size={200} />
                            </div>
                            <br />
                        </FlexboxGridItem>
                    </FlexboxGrid>
                </div>
            }
        </React.Fragment>
    );
}

export default InvoicePrint;