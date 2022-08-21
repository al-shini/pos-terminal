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

    return request;
}, error => {
    console.log(error);
    return Promise.reject(error);
});

instance.interceptors.response.use(response => {
    // console.log(response);
    // Edit response config
    return response;
}, error => {
    return Promise.reject(error);
});


export default instance;
