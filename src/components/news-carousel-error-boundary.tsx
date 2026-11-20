"use client";

import { Component, type ReactNode } from "react";

type Props = { children: ReactNode };
type State = { failed: boolean };

export class NewsCarouselErrorBoundary extends Component<Props, State> {
  state: State = { failed: false };

  static getDerivedStateFromError(): State {
    return { failed: true };
  }

  componentDidCatch(error: Error) {
    console.error("News slideshow failed to render", { errorName: error.name });
  }

  render() {
    if (this.state.failed) {
      return <p className="mb-6 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4 text-sm" role="status">The story slideshow is unavailable right now. You can still read the latest stories below.</p>;
    }
    return this.props.children;
  }
}
