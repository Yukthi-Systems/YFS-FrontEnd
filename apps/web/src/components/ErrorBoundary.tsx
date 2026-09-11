import { Component, type ErrorInfo, type ReactNode } from "react";

interface Props {
  children: ReactNode;
}

interface State {
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("Unhandled error in the UI:", error, info.componentStack);
  }

  render() {
    if (!this.state.error) return this.props.children;

    return (
      <div className="min-h-screen w-screen flex flex-col items-center justify-center gap-3 bg-bg-main text-text-main px-6 text-center">
        <h3 className="text-lg font-bold text-text-heading">Something went wrong</h3>
        <p className="text-sm text-text-main max-w-sm">{this.state.error.message || "An unexpected error occurred."}</p>
        <button onClick={() => window.location.reload()} className="btn-primary" style={{ width: "auto" }}>
          Reload
        </button>
      </div>
    );
  }
}
