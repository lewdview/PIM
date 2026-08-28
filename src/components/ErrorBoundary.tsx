import React, { Component, type ErrorInfo, type ReactNode } from "react";
import { AlertTriangle, RefreshCw, Home } from "lucide-react";

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  sectionName?: string;
  onReset?: () => void;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
    errorInfo: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error, errorInfo: null };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("[PIM ErrorBoundary caught error]:", error, errorInfo);
    this.setState({ errorInfo });
  }

  public handleReset = () => {
    this.setState({ hasError: false, error: null, errorInfo: null });
    if (this.props.onReset) {
      this.props.onReset();
    }
  };

  public handleReload = () => {
    window.location.reload();
  };

  public handleGoHome = () => {
    window.location.href = "/";
  };

  public render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      const isDev = process.env.NODE_ENV !== "production";
      const section = this.props.sectionName ? `[${this.props.sectionName}]` : "SYSTEM MALFUNCTION";

      return (
        <div className="min-h-[50vh] flex flex-col items-center justify-center p-6 text-center z-50">
          <div className="max-w-md w-full bg-[#0c0c14]/90 border border-[#ff5500]/40 rounded-xl p-6 backdrop-blur-xl shadow-2xl shadow-[#ff5500]/10 flex flex-col items-center">
            <div className="w-14 h-14 rounded-full bg-[#ff5500]/10 border border-[#ff5500]/30 flex items-center justify-center text-[#ff5500] mb-4">
              <AlertTriangle className="w-7 h-7 animate-pulse" />
            </div>

            <div className="font-mono text-xs uppercase tracking-[0.25em] text-[#ff5500] mb-1">
              SIGNAL CORRUPTED // {section}
            </div>

            <h2 className="text-xl font-bold font-sans text-white mb-2 tracking-wide uppercase">
              Module Execution Interrupted
            </h2>

            <p className="text-sm text-zinc-400 font-mono mb-6 leading-relaxed">
              A runtime anomaly was isolated. Recovery subroutines are available below.
            </p>

            {isDev && this.state.error && (
              <div className="w-full text-left bg-black/70 border border-zinc-800 rounded p-3 mb-6 font-mono text-xs text-red-400 overflow-x-auto max-h-40">
                <p className="font-bold text-red-300 mb-1">{this.state.error.toString()}</p>
                {this.state.errorInfo?.componentStack && (
                  <pre className="text-[10px] text-zinc-500 whitespace-pre-wrap">
                    {this.state.errorInfo.componentStack.slice(0, 300)}...
                  </pre>
                )}
              </div>
            )}

            <div className="flex flex-wrap items-center justify-center gap-3 w-full">
              <button
                type="button"
                onClick={this.handleReset}
                className="flex-1 min-w-[120px] px-4 py-2.5 bg-zinc-900 hover:bg-zinc-800 border border-zinc-700 text-zinc-200 rounded-lg text-xs font-mono font-medium transition-colors flex items-center justify-center gap-2 cursor-pointer"
              >
                <RefreshCw className="w-3.5 h-3.5" /> Retry
              </button>

              <button
                type="button"
                onClick={this.handleGoHome}
                className="flex-1 min-w-[120px] px-4 py-2.5 bg-[#ff1493]/20 hover:bg-[#ff1493]/30 border border-[#ff1493]/40 text-[#ff1493] rounded-lg text-xs font-mono font-medium transition-colors flex items-center justify-center gap-2 cursor-pointer"
              >
                <Home className="w-3.5 h-3.5" /> Return Hub
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
