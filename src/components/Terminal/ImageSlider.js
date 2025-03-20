import React, { useEffect, useState } from 'react';
import config from '../../config';

const ImageSlider = () => {
    const [slideImages, setSlideImages] = useState([]);

    // const loadImages = ({...props}) => {
    //     fetch("https://image.shini.ps/pos-screen/").then((response) => {
    //         response.text().then((htmlText) => {
    //             const parser = new DOMParser();
    //             const doc = parser.parseFromString(htmlText, "text/html");
    //             const links = [...doc.querySelectorAll("a")];
    //             const filenames = links
    //                 .map(link => link.getAttribute("href"))
    //                 .filter(filename => filename && filename.match(/\.(jpg|jpeg|png|gif)$/i)); // Keep only image files
    //             const imageUrls = filenames.map(filename => `https://image.shini.ps/pos-screen/${filename}`);
    //             console.log(imageUrls);
    //             const _images = [];
    //             setSlideImages(imageUrls);
    //         })
    //     });
    // }
    useEffect(() => {
        console.log(config);
    }, []);

    return (
        <>
        <img key={1} src={`https://image.shini.ps/pos-screen/${config.systemCurrency === 'NIS' ? 'pos.png' : 'pos_jod.png'}`} width='100%' style={{ height: '450px' }} alt='Error loading Ad image' />
        </>
    );
};

export default ImageSlider;
