'use client';

import React, { Component, type ReactNode } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

interface ErrorBoundaryProps {
  children: ReactNode;
  fallbackTitle?: string;
  fallbackDescription?: string;
  onReset?: () => void;
}

interface ErrorBoundaryState {
  hasError: boolean;
}

/**
 * Reusable client ErrorBoundary for isolating runtime or WebGL/3D rendering failures
 * so a single widget failure does not crash the entire Next.js page into `__next_error__`.
 */
export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { hasError: false };

  static getDerivedStateFromError(): ErrorBoundaryState {
    return { hasError: true };
  }

  componentDidCatch(error: Error) {
    console.error('[ErrorBoundary]', error);
  }

  private handleReset = () => {
    this.setState({ hasError: false });
    this.props.onReset?.();
  };

  render() {
    if (this.state.hasError) {
      return (
        <div
          role="alert"
          className="surface-card flex min-h-[260px] flex-col items-center justify-center gap-3 p-6 text-center"
        >
          <AlertTriangle className="h-6 w-6 text-status-caution" aria-hidden="true" />
          <div className="space-y-1">
            <p className="text-sm font-semibold text-blueberry">
              {this.props.fallbackTitle ?? 'Display temporarily unavailable'}
            </p>
            <p className="max-w-sm text-xs text-stem">
              {this.props.fallbackDescription ??
                'A rendering error occurred in this panel. Other telemetry remains active.'}
            </p>
          </div>
          <button
            type="button"
            onClick={this.handleReset}
            className="tactile-press inline-flex items-center gap-1.5 rounded-sm border border-line bg-surface px-3 py-1.5 text-xs font-semibold text-blueberry hover:bg-surface-tinted"
          >
            <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
            <span>Retry</span>
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
