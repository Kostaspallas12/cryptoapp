import { Component, type ReactNode } from 'react';
import { translate } from '../i18n';
import { useSettings } from '../store/settings';

/** Shows a friendly message instead of a blank page if a page crashes. */
export class ErrorBoundary extends Component<{ children: ReactNode; resetKey?: string }, { error: Error | null }> {
  state = { error: null as Error | null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  componentDidCatch(error: Error) {
    console.error('Page crashed:', error);
  }

  componentDidUpdate(prev: { resetKey?: string }) {
    // Navigating to another page clears the error
    if (this.state.error && prev.resetKey !== this.props.resetKey) this.setState({ error: null });
  }

  render() {
    if (!this.state.error) return this.props.children;
    const lang = useSettings.getState().lang;
    return (
      <div className="card empty">
        <h3>{translate(lang, 'common.error')}</h3>
        <p className="faint small">{this.state.error.message}</p>
        <button className="btn btn-primary" onClick={() => location.reload()}>
          {translate(lang, 'common.retry')}
        </button>
      </div>
    );
  }
}
