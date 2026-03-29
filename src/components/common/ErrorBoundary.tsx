import React, { Component, ErrorInfo, ReactNode } from 'react';
import { debugError } from '../../lib/utils';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  name?: string;
}

interface State {
  hasError: boolean;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false
  };

  public static getDerivedStateFromError(_: Error): State {
    return { hasError: true };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    debugError(`Uncaught error in ${this.props.name || 'Component'}:`, error, errorInfo);
    // In a production environment, you would log this to a service like Sentry or LogRocket
    // window.monitoringService?.logError(error, errorInfo);
  }

  public render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="flex flex-col items-center justify-center min-h-[300px] p-8 bg-surface border border-subtle rounded-3xl text-center">
          <h2 className="text-2xl font-thematic text-primary mb-4 uppercase tracking-wider">
            Something went wrong
          </h2>
          <p className="text-tertiary text-sm mb-6 max-w-md">
            The {this.props.name || 'component'} encountered a critical error. 
            The Assembly is attempting to recover.
          </p>
          <button
            onClick={() => this.setState({ hasError: false })}
            className="btn-primary px-6 py-2 rounded-xl text-sm uppercase tracking-widest"
          >
            Attempt Recovery
          </button>
          <button
            onClick={() => window.location.reload()}
            className="mt-4 text-xs text-muted hover:text-primary transition-colors uppercase tracking-widest"
          >
            Reload Application
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
