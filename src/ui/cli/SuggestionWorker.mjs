import { Worker } from 'node:worker_threads';

const WORKER_URL = new URL('../../worker/suggestions.worker.mjs', import.meta.url);

/**
 * Persistent wrapper around the suggestions worker thread.
 *
 * Spawns one worker for the lifetime of a game session; requests are
 * serialised (one at a time). Call terminate() when done.
 */
export class SuggestionWorker {
  constructor() {
    this._worker = new Worker(WORKER_URL);
    this._pending = null;

    this._worker.on('message', result => {
      if (this._pending) {
        this._pending.resolve(result);
        this._pending = null;
      }
    });

    this._worker.on('error', err => {
      if (this._pending) {
        this._pending.reject(err);
        this._pending = null;
      }
    });
  }

  /**
   * Rank `remaining` words and optionally score `played` against them.
   *
   * @param {string[]} remaining
   * @param {string|null} [played]
   * @returns {Promise<{words: string[], total: number, rank?: number, percentile?: number, bestWord?: string}>}
   */
  compute(remaining, played = null) {
    return new Promise((resolve, reject) => {
      this._pending = { resolve, reject };
      this._worker.postMessage({ remaining, played });
    });
  }

  terminate() {
    return this._worker.terminate();
  }
}
