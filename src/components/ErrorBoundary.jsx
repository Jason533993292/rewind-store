import React from 'react';

export class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, info) {
    console.error('ErrorBoundary caught:', error, info);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          padding: '40px 20px', textAlign: 'center', fontFamily: 'system-ui, sans-serif',
          maxWidth: '400px', margin: '80px auto', color: 'var(--ink, #16130F)'
        }}>
          <h2 style={{ fontSize: '20px', marginBottom: '12px' }}>Something went wrong</h2>
          <p style={{ fontSize: '14px', color: 'var(--muted, #6E665A)', marginBottom: '20px' }}>
            The page hit an unexpected error. Please try refreshing.
          </p>
          <button onClick={() => window.location.reload()}
            style={{
              padding: '10px 24px', borderRadius: '8px', border: 'none',
              background: 'var(--ink, #16130F)', color: 'var(--surface, #FAF6EF)',
              cursor: 'pointer', fontSize: '14px', fontWeight: 600
            }}>
            Refresh page
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
