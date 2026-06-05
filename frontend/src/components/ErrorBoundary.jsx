import { Component } from 'react';

export default class ErrorBoundary extends Component {
    constructor(props) {
        super(props);
        this.state = { hasError: false };
    }

    static getDerivedStateFromError() {
        return { hasError: true };
    }

    componentDidCatch(error, info) {
        console.error('ErrorBoundary caught an error:', error, info);
    }

    render() {
        if (this.state.hasError) {
            return (
                <div className="flex items-center justify-center h-screen bg-gray-50">
                    <div className="text-center p-8 bg-white rounded-xl shadow-sm max-w-sm w-full">
                        <p className="text-gray-700 text-sm mb-4">
                            Something went wrong. Please refresh the page.
                        </p>
                        <button
                            onClick={() => window.location.reload()}
                            className="px-5 py-2 bg-blue-600 text-white border-none rounded-lg text-sm cursor-pointer hover:bg-blue-700"
                        >
                            Refresh
                        </button>
                    </div>
                </div>
            );
        }

        return this.props.children;
    }
}
