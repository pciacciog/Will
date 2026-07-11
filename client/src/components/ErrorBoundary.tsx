import { Component, type ReactNode } from "react";

interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
}

export default class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(): ErrorBoundaryState {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: { componentStack: string }) {
    console.error("[ErrorBoundary] Caught render error:", error, info.componentStack);
  }

  private handleReload = () => {
    this.setState({ hasError: false });
    window.location.reload();
  };

  private handleGoHome = () => {
    this.setState({ hasError: false });
    window.location.href = "/";
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50 px-6">
          <div className="max-w-sm w-full text-center">
            <h1 className="text-lg font-bold text-gray-900 mb-2" data-testid="text-error-title">
              Something went wrong
            </h1>
            <p className="text-sm text-gray-500 mb-6">
              This screen ran into a problem. You can reload or head back home.
            </p>
            <div className="flex flex-col gap-2">
              <button
                onClick={this.handleReload}
                className="w-full py-3 rounded-2xl font-semibold text-sm text-white transition-all active:scale-95"
                style={{ background: "linear-gradient(135deg, #7C3AED, #4F46E5)" }}
                data-testid="button-error-reload"
              >
                Reload
              </button>
              <button
                onClick={this.handleGoHome}
                className="w-full py-3 rounded-2xl font-semibold text-sm text-gray-700 bg-white border border-gray-200 transition-all active:scale-95"
                data-testid="button-error-home"
              >
                Go Home
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
