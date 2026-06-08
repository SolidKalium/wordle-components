/**
 * Browser-compatible wrapper around the suggestions Web Worker.
 * Same interface as SuggestionWorker (Node) — compute() / terminate().
 */
export class BrowserSuggestionWorker {
  constructor() {
    this._worker = new Worker(
      new URL('../../../worker/suggestions.browser.worker.mjs', import.meta.url),
      { type: 'module' }
    );
    this._pending = null;

    this._worker.onmessage = ({ data: result }) => {
      if (this._pending) {
        this._pending.resolve(result);
        this._pending = null;
      }
    };

    this._worker.onerror = (err) => {
      if (this._pending) {
        this._pending.reject(err);
        this._pending = null;
      }
    };
  }

  compute(remaining, played = null) {
    return new Promise((resolve, reject) => {
      this._pending = { resolve, reject };
      this._worker.postMessage({ remaining, played });
    });
  }

  terminate() {
    this._worker.terminate();
  }
}
