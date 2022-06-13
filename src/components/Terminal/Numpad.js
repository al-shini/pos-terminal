import React from 'react';
import { FlexboxGrid, IconButton, Button } from 'rsuite';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
    fa1, fa2, fa3, fa4, fa5, fa6, fa7, fa8, fa9,  faTimes, faAnglesLeft, faC, faBan
} from '@fortawesome/free-solid-svg-icons'
import styles from './Numpad.module.css';

const Numpad = (props) => {

    return (

        <FlexboxGrid dir='column' >
            <FlexboxGrid.Item colspan={6}>
                <IconButton className={styles.NumpadButton} icon={<FontAwesomeIcon icon={fa1} />} />
            </FlexboxGrid.Item>

            <FlexboxGrid.Item colspan={6}>
                <IconButton className={styles.NumpadButton} icon={<FontAwesomeIcon icon={fa2} />} />
            </FlexboxGrid.Item>

            <FlexboxGrid.Item colspan={6}>
                <IconButton className={styles.NumpadButton} icon={<FontAwesomeIcon icon={fa3} />} />
            </FlexboxGrid.Item>

            <FlexboxGrid.Item colspan={6}>
                <IconButton className={styles.NumpadButton} icon={<FontAwesomeIcon icon={faAnglesLeft} />} appearance='primary' color='orange' />
            </FlexboxGrid.Item>

            <FlexboxGrid.Item colspan={6}>
                <IconButton className={styles.NumpadButton} icon={<FontAwesomeIcon icon={fa4} />} />
            </FlexboxGrid.Item>

            <FlexboxGrid.Item colspan={6}>
                <IconButton className={styles.NumpadButton} icon={<FontAwesomeIcon icon={fa5} />} />
            </FlexboxGrid.Item>

            <FlexboxGrid.Item colspan={6}>
                <IconButton className={styles.NumpadButton} icon={<FontAwesomeIcon icon={fa6} />} />
            </FlexboxGrid.Item>

            <FlexboxGrid.Item colspan={6}>
                <IconButton className={styles.NumpadButton} icon={<FontAwesomeIcon icon={faTimes} />} appearance='primary' color='blue' />
            </FlexboxGrid.Item>

            <FlexboxGrid.Item colspan={6}>
                <IconButton className={styles.NumpadButton} icon={<FontAwesomeIcon icon={fa7} />} />
            </FlexboxGrid.Item>

            <FlexboxGrid.Item colspan={6}>
                <IconButton className={styles.NumpadButton} icon={<FontAwesomeIcon icon={fa8} />} />
            </FlexboxGrid.Item>

            <FlexboxGrid.Item colspan={6}>
                <IconButton className={styles.NumpadButton} icon={<FontAwesomeIcon icon={fa9} />} />
            </FlexboxGrid.Item>

            <FlexboxGrid.Item colspan={6}>
            </FlexboxGrid.Item>

            <FlexboxGrid.Item colspan={6}>
                <Button className={styles.NumpadButton} >
                    0
                </Button>
            </FlexboxGrid.Item>

            <FlexboxGrid.Item colspan={6}>
                <Button className={styles.NumpadButton} >
                    00
                </Button>
            </FlexboxGrid.Item>

            <FlexboxGrid.Item colspan={6}>
                <IconButton className={styles.NumpadButton} icon={<FontAwesomeIcon icon={faC} />} appearance='primary' color='red' />
            </FlexboxGrid.Item>

            <FlexboxGrid.Item colspan={6}>
                <Button color='green' appearance='primary' className={[styles.NumpadButton, styles.OK]} >
                    OK
                </Button>
            </FlexboxGrid.Item>
        </FlexboxGrid>
    );
}

export default Numpad;