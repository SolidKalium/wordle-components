/**
 * Browser wrapper around the simulation Web Worker.
 * Supports concurrent calls: each compute() supersedes any in-flight request
 * (stale results are ignored via reqId). The worker maintains its first-guess
 * cache across calls, so re-running with a different strategy is fast after
 * the first run.
 */
export class SimulationWorker {
  constructor() {
    this._worker = new Worker(
      new URL('../../../worker/simulation.browser.worker.mjs', import.meta.url),
      { type: 'module' },
    );
    this._reqId    = 0;
    this._activeId = 0;
    this._resolve  = null;
    this._reject   = null;
    this._onProgress = null;

    this._worker.onmessage = ({ data }) => {
      if (data.reqId !== this._activeId) return;
      if (data.type === 'progress') {
        this._onProgress?.(data.i, data.total);
      } else if (data.type === 'done') {
        this._resolve?.({ summary: data.summary, tree: data.tree });
        this._resolve = this._reject = this._onProgress = null;
      }
    };

    this._worker.onerror = (e) => {
      this._reject?.(e);
      this._resolve = this._reject = this._onProgress = null;
    };
  }

  /**
   * @param {{ strategyId: string, filterId: string | null }} params
   * @param {(i: number, total: number) => void} [onProgress]
   * @returns {Promise<{ summary: import('../../../lib/analysis.mjs').SimulationSummary, tree: import('../../../lib/analysis.mjs').TreeNode }>}
   */
  compute(params, onProgress) {
    const reqId = ++this._reqId;
    this._activeId   = reqId;
    this._onProgress = onProgress ?? null;
    this._resolve    = null;
    this._reject     = null;

    return new Promise((resolve, reject) => {
      this._resolve = resolve;
      this._reject  = reject;
      this._worker.postMessage({ ...params, reqId });
    });
  }

  terminate() {
    this._worker.terminate();
  }
}
