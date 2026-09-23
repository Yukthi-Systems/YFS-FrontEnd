import { Component, type ErrorInfo, type ReactNode } from "react";
import { AlertTriangle, Check, ChevronDown, ChevronRight, Copy, Home, RefreshCw, RotateCcw } from "lucide-react";

interface Props {
  children: ReactNode;
}

interface State {
  error: Error | null;
  componentStack: string | null;
  // Short, human-quotable id so a screenshot of this page can be matched to the
  // console/log entry recorded at the same moment.
  errorId: string | null;
  occurredAt: string | null;
  detailsOpen: boolean;
  copied: boolean;
}

const INITIAL: State = {
  error: null,
  componentStack: null,
  errorId: null,
  occurredAt: null,
  detailsOpen: false,
  copied: false,
};

export class ErrorBoundary extends Component<Props, State> {
  state: State = INITIAL;

  static getDerivedStateFromError(error: Error): Partial<State> {
    return {
      error,
      errorId: Math.random().toString(36).slice(2, 10).toUpperCase(),
      occurredAt: new Date().toISOString(),
      // Developers shouldn't have to click to see the stack on every crash.
      detailsOpen: import.meta.env.DEV,
    };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    this.setState({ componentStack: info.componentStack ?? null });
    console.error(`Unhandled error in the UI [${this.state.errorId ?? "?"}]:`, error, info.componentStack);
  }

  // Everything a bug report needs, in one paste.
  private report(): string {
    const { error, componentStack, errorId, occurredAt } = this.state;
    return [
      `Error ID:   ${errorId}`,
      `When:       ${occurredAt}`,
      `Where:      ${window.location.pathname}${window.location.search}`,
      `Browser:    ${navigator.userAgent}`,
      "",
      `${error?.name ?? "Error"}: ${error?.message ?? "(no message)"}`,
      "",
      "Stack:",
      error?.stack ?? "(none)",
      "",
      "Component stack:",
      componentStack ?? "(none)",
    ].join("\n");
  }

  private copyReport = async () => {
    try {
      await navigator.clipboard.writeText(this.report());
      this.setState({ copied: true });
      setTimeout(() => this.setState({ copied: false }), 2000);
    } catch {
      /* clipboard blocked — the details are on screen to copy by hand */
    }
  };

  // Re-mounts the subtree without a full page load. Often enough on its own, since
  // most crashes come from one bad render rather than corrupted state.
  private tryAgain = () => this.setState(INITIAL);

  render() {
    if (!this.state.error) return this.props.children;

    const { error, componentStack, errorId, detailsOpen, copied } = this.state;

    return (
      <div className="min-h-screen w-screen flex items-center justify-center bg-bg-main px-6 py-10">
        <div className="w-full max-w-xl flex flex-col items-center text-center">
          <div className="w-12 h-12 rounded-2xl bg-red-500/10 border border-red-500/20 flex items-center justify-center mb-4">
            <AlertTriangle className="w-5 h-5 text-red-500" />
          </div>

          <h1 className="text-xl font-semibold text-text-heading m-0">Something went wrong</h1>
          <p className="text-sm text-text-main mt-2 max-w-md leading-relaxed">
            This page hit an unexpected error and stopped. Your files are safe — nothing was deleted or changed.
          </p>

          <div className="flex flex-wrap items-center justify-center gap-2 mt-6">
            <button onClick={this.tryAgain} className="btn-primary gap-1.5" style={{ width: "auto" }}>
              <RotateCcw className="w-3.5 h-3.5" /> Try again
            </button>
            <button onClick={() => window.location.reload()} className="btn-outline gap-1.5">
              <RefreshCw className="w-3.5 h-3.5" /> Reload page
            </button>
            <button onClick={() => window.location.assign("/drive")} className="btn-outline gap-1.5">
              <Home className="w-3.5 h-3.5" /> Go to My Drive
            </button>
          </div>

          <p className="text-[11px] text-text-main mt-4">
            If it keeps happening, send this reference to the team:{" "}
            <span className="font-mono text-text-heading">{errorId}</span>
          </p>

          <div className="w-full mt-6 rounded-xl border border-border-main bg-code-bg/50 text-left overflow-hidden">
            <div className="flex items-center gap-2 px-3 py-2">
              <button
                onClick={() => this.setState({ detailsOpen: !detailsOpen })}
                aria-expanded={detailsOpen}
                className="flex-1 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-text-main hover:text-text-heading bg-transparent border-none cursor-pointer p-0 transition"
              >
                {detailsOpen ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
                Technical details
              </button>
              <button
                onClick={this.copyReport}
                title="Copy everything needed for a bug report"
                className="shrink-0 inline-flex items-center gap-1.5 px-2 py-1 rounded-lg border border-border-main bg-bg-main text-[11px] font-semibold text-text-heading cursor-pointer transition hover:border-accent hover:text-accent"
              >
                {copied ? <Check className="w-3 h-3 text-accent" /> : <Copy className="w-3 h-3" />}
                {copied ? "Copied" : "Copy details"}
              </button>
            </div>

            {detailsOpen && (
              <div className="px-3 pb-3 pt-1 border-t border-border-main flex flex-col gap-3">
                <div>
                  <div className="text-[10px] uppercase tracking-wider text-text-main mb-1">Error</div>
                  <p className="font-mono text-[11px] text-red-500 break-words m-0">
                    {error.name}: {error.message || "(no message)"}
                  </p>
                </div>

                {error.stack && (
                  <div>
                    <div className="text-[10px] uppercase tracking-wider text-text-main mb-1">Stack</div>
                    <pre className="font-mono text-[10px] text-text-main leading-relaxed m-0 max-h-48 overflow-auto whitespace-pre-wrap break-words">
                      {error.stack}
                    </pre>
                  </div>
                )}

                {componentStack && (
                  <div>
                    <div className="text-[10px] uppercase tracking-wider text-text-main mb-1">Component stack</div>
                    <pre className="font-mono text-[10px] text-text-main leading-relaxed m-0 max-h-40 overflow-auto whitespace-pre-wrap break-words">
                      {componentStack}
                    </pre>
                  </div>
                )}

                <div className="text-[10px] text-text-main font-mono break-all">
                  {window.location.pathname}
                  {window.location.search}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }
}
