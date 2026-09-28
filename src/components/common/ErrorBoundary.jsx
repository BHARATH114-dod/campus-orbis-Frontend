import { Component } from 'react';

/**
 * Catches render/lifecycle errors in its subtree and shows a recoverable
 * screen instead of letting the crash blank out the whole page. Does not
 * catch errors in event handlers or async code (React error boundaries
 * never do) — those still need their own try/catch, which is why the
 * Test Monitoring recorder code guards its own MediaRecorder calls. This
 * is a last-resort safety net on top of that, not a replacement for it.
 *
 * @param {{ children: React.ReactNode, message?: string, onReset?: () => void }} props
 */
export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, info) {
    // The full stack + component stack is exactly what's needed to trace a
    // render-time crash back to its actual origin (as opposed to guessing
    // from the async operation that indirectly triggered it via setState —
    // see FaceRecognitionAttendance.jsx for that distinction). Kept as a
    // console.error (not suppressed) specifically so this is still visible
    // even in production builds where dev tools might otherwise be closed.
    console.error('ErrorBoundary caught an error:', error, info);
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
    this.props.onReset?.();
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex min-h-[50vh] flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-line bg-paper-card p-8 text-center">
          <p className="text-sm font-semibold text-ink">{this.props.message || 'Something went wrong.'}</p>
          {this.state.error?.message && (
            // Collapsed by default — doesn't change what a normal user
            // sees, but means the exact error text (e.g. "X.some is not a
            // function") is one click away in the field instead of only
            // existing in a console the reporter may not have open.
            <details className="max-w-sm text-left text-xs text-ink-light">
              <summary className="cursor-pointer select-none text-center">Show details</summary>
              <pre className="mt-2 whitespace-pre-wrap break-words rounded-lg bg-paper p-2">{this.state.error.message}</pre>
            </details>
          )}
          <button
            type="button"
            onClick={this.handleReset}
            className="rounded-full bg-hero-primary px-4 py-2 text-xs font-semibold text-white hover:opacity-90"
          >
            Try again
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
