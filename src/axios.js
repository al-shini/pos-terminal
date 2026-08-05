import axios from 'axios';
import config from './config';

const instance = axios.create({
    baseURL: 'http://'+config.serverIp+':8080/'
});

instance.interceptors.request.use(request => {
    // console.log(request);
    // Edit request config
    const token = localStorage.getItem("jwt");

    if (token) {
        request.headers.Authorization = `Bearer ${token}`;
    } else {
        request.headers.Authorization = `Bearer `;
    }

    // Tells the backend this lane is an unattended self-checkout, which is what
    // makes it round the payable total to something a CashDro can settle
    // exactly. The kiosk had no way to say so before, so its sales kept their
    // odd agorot while the cash machine could only collect in 0.50 steps — and
    // a customer who inserted the exact amount asked of them left a paid sale
    // that could not be closed. Sent on every call because several endpoints
    // rebuild the totals.
    if (config.selfService) {
        request.headers.selfCheckout = 'true';
    }

    return request;
}, error => {
    console.error('Request Error:', error);
    return Promise.reject(error);
});

instance.interceptors.response.use(response => {
    // Edit response config
    return response;
}, error => {
    if (error.response) {
        console.error(`Response Error: ${JSON.stringify(error.response)}`);
    } else {
        console.error('Network Error:', error.message);
    }
    return Promise.reject(error);
});


export default instance;
