import { useEffect, useRef } from 'react';
import { useSelector } from 'react-redux';

import welcomeMp3 from '../../../assets/self-service/voice/welcome.mp3';
import firstScanMp3 from '../../../assets/self-service/voice/first-scan.mp3';
import choosePaymentMp3 from '../../../assets/self-service/voice/choose-payment.mp3';
import insertCashMp3 from '../../../assets/self-service/voice/insert-cash.mp3';
import paymentCompleteMp3 from '../../../assets/self-service/voice/payment-complete.mp3';
import scanErrorMp3 from '../../../assets/self-service/voice/scan-error.mp3';

/**
 * Voice guidance for the self-checkout (Palestinian/Levantine female voice,
 * generated with ElevenLabs — see workspace voice-samples/generate-prompts.js
 * to regenerate or swap the voice).
 *
 * Plays one prompt per state TRANSITION (rising edge), never on re-renders:
 *   idle entered            -> welcome
 *   first item scanned      -> first-scan guidance
 *   pay modal opened        -> choose payment
 *   CashDro screen opened   -> insert cash
 *   receipt screen shown    -> payment complete + thanks
 *   barcode not recognized  -> scan error (slightly delayed so the existing
 *                              error BEEP from Terminal.js is heard first)
 *
 * Only one clip plays at a time; a new prompt interrupts the previous one.
 * Renders nothing.
 */
const SelfServiceVoice = ({ itemCount, payOpen, cashDroOpen, showReceipt }) => {
    const itemScanError = useSelector((state) => state.ui.itemScanError);

    const audioRef = useRef(null);
    const errorDelayRef = useRef(null);
    const prev = useRef({
        itemCount: 0,
        payOpen: false,
        cashDroOpen: false,
        showReceipt: false,
        itemScanError: false,
        idle: null, // null => first evaluation (mount)
    });

    const play = (src) => {
        try {
            if (audioRef.current) {
                audioRef.current.pause();
                audioRef.current.currentTime = 0;
            }
            const audio = new Audio(src);
            audioRef.current = audio;
            audio.play().catch(() => { /* autoplay blocked outside Electron — ignore */ });
        } catch (_) { /* never break checkout because of audio */ }
    };

    useEffect(() => () => {
        if (audioRef.current) audioRef.current.pause();
        if (errorDelayRef.current) clearTimeout(errorDelayRef.current);
    }, []);

    useEffect(() => {
        const p = prev.current;
        const idle = itemCount === 0 && !showReceipt && !cashDroOpen && !payOpen;

        if (itemScanError && !p.itemScanError) {
            // Let the Terminal.js error beep hit first, then speak.
            if (errorDelayRef.current) clearTimeout(errorDelayRef.current);
            errorDelayRef.current = setTimeout(() => play(scanErrorMp3), 550);
        } else if (showReceipt && !p.showReceipt) {
            play(paymentCompleteMp3);
        } else if (cashDroOpen && !p.cashDroOpen) {
            play(insertCashMp3);
        } else if (payOpen && !p.payOpen) {
            play(choosePaymentMp3);
        } else if (itemCount > 0 && p.itemCount === 0) {
            play(firstScanMp3);
        } else if (idle && (p.idle === null || p.idle === false)) {
            play(welcomeMp3);
        }

        prev.current = { itemCount, payOpen, cashDroOpen, showReceipt, itemScanError, idle };
    }, [itemCount, payOpen, cashDroOpen, showReceipt, itemScanError]);

    return null;
};

export default SelfServiceVoice;
