/**
 * Browser-compatible wrapper around the suggestions Web Worker.
 * Same interface as SuggestionWorker (Node) — compute() / terminate().
 *
 * Race-condition note: the underlying Web Worker processes messages
 * sequentially (FIFO). If compute() is called N times before any response
 * arrives, we receive N responses in order but only care about the last one.
 * _sentCount / _recvCount tracks this: when recvCount catches up to sentCount
 * we have the response to the latest request; all earlier responses are dropped.
 */
export class BrowserSuggestionWorker {
  constructor() {
    this._worker    = new Worker(
      new URL('../../../worker/suggestions.browser.worker.mjs', import.meta.url),
      { type: 'module' }
    );
    this._pending   = null;
    this._sentCount = 0;
    this._recvCount = 0;

    this._worker.onmessage = ({ data: result }) => {
      this._recvCount++;
      if (this._pending && this._recvCount === this._sentCount) {
        this._pending.resolve(result);
        this._pending = null;
      }
      // else: stale response for a superseded request — discard
    };

    this._worker.onerror = (err) => {
      this._recvCount++;
      if (this._pending && this._recvCount === this._sentCount) {
        this._pending.reject(err);
        this._pending = null;
      }
    };
  }

  compute(remaining, played = null) {
    this._sentCount++;
    // Abandon the previous pending promise (it will hang, which is fine —
    // the caller's reqRef guard means the stale result would be ignored anyway).
    this._pending = null;
    return new Promise((resolve, reject) => {
      this._pending = { resolve, reject };
      this._worker.postMessage({ remaining, played });
    });
  }

  terminate() {
    this._worker.terminate();
  }
}
