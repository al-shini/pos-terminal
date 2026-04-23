import React from 'react';
import ReactDOM from 'react-dom';
import App from './App';
import reportWebVitals from './reportWebVitals';
import { Provider } from 'react-redux';
import { store } from './store/store';
import 'rsuite/dist/rsuite.min.css' 
import ErrorBoundary from './ErrorBoundary';

// Silence the benign "ResizeObserver loop completed with undelivered notifications"
// warning emitted by rsuite's auto-layout Table. It does not indicate a real
// issue, but Create React App's dev overlay shows every window error. We swallow
// only this specific message; everything else is still reported normally.
const RESIZE_OBSERVER_ERR = /^ResizeObserver loop (completed with undelivered notifications\.?|limit exceeded)/;
const swallowResizeObserverError = (event) => {
    const message = event && (event.message || (event.reason && event.reason.message));
    if (message && RESIZE_OBSERVER_ERR.test(message)) {
        event.stopImmediatePropagation();
        if (typeof event.preventDefault === 'function') event.preventDefault();
        return true;
    }
    return false;
};
window.addEventListener('error', swallowResizeObserverError, true);
window.addEventListener('unhandledrejection', swallowResizeObserverError, true);


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
