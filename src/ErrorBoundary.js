import React from 'react';
import errorImg from './assets/error-img.png';
import { Button } from 'rsuite';


class ErrorBoundary extends React.Component {
    constructor(props) {
        super(props);
        this.state = { hasError: false, errorObject: undefined, errorInfo: undefined };
    }

    static getDerivedStateFromError(error) {
        return { hasError: true };
    }

    componentDidCatch(error, errorInfo) {
        if (error) {
            this.setState({
                hasError: true,
                errorInfo: errorInfo,
                errorObject: error.toString()
            })

        }
        console.error('ErrorBoundary caught an error', error, errorInfo);
    }

    render() {
        if (this.state.hasError) {
            return <div style={{ width: '102%', height: '100%', background: 'white', padding: '10px' }}>
                {this.state.errorObject ? <h5 style={{ textAlign: 'center', color: 'black' }}>{this.state.errorObject}</h5> : <b>Error message is not clear</b>}
                <hr />
                <img style={{ margin: 'auto', display: 'block' }} width={400} height={400} src={errorImg} alt='no_image' />

                <hr />
                <p style={{ textAlign: 'center' }}>
                    <Button appearance='primary' color='green' onClick={() => { window.location.reload() }}>
                        ↻ Click here to Restart the Application
                    </Button>
                </p>
            </div>;
        }

        return this.props.children;
    }
}

export default ErrorBoundary;
