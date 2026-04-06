import React from 'react';

export default function PageShell({ children, className = '' }) {
  // Uses the global Layout padding/width; keep page spacing consistent.
  return <div className={`space-y-5 ${className}`}>{children}</div>;
}

