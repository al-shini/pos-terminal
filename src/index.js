import React from 'react';
import ReactDOM from 'react-dom';
import App from './App';
import reportWebVitals from './reportWebVitals';
import { Provider } from 'react-redux';
import { store } from './store/store';
import 'rsuite/dist/rsuite.min.css' 
import ErrorBoundary from './ErrorBoundary';


// // Capture global errors
// window.onerror = (message, source, lineno, colno, error) => {
//   console.error(`Global Error: ${message} at ${source}:${lineno}:${colno}`, error);
// };

// // Capture unhandled promise rejections
// window.onunhandledrejection = (event) => {
//   console.error('Unhandled Rejection:', event.reason);
// };


ReactDOM.render(
  <React.StrictMode>
    <Provider store={store}>
      <ErrorBoundary>
        <App />
      </ErrorBoundary>
    </Provider>
  </React.StrictMode>,
  document.getElementById('root')
);

// If you want to start measuring performance in your app, pass a function
// to log results (for example: reportWebVitals(console.log))
// or send to an analytics endpoint. Learn more: https://bit.ly/CRA-vitals
reportWebVitals();
