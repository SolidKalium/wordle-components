import { useEffect, useMemo, useRef, useState } from 'react';
import { ANSWERS, WORDS } from '../../../lib/words.gen.mjs';
import { BrowserSuggestionWorker } from '../workers/BrowserSuggestionWorker.mjs';

const ANSWERS_SET = new Set(ANSWERS);
const NON_ANSWER_THRESHOLD = 8;
export const SUGGESTION_CAP = 6;

// Manages a suggestion worker and returns ranked suggestions for the given
// remaining word list. When constraints is provided, non-answer valid words
// are included as a fallback when the answer count is low.
export function useSuggestions(remainingWords, constraints = null) {
  const [suggestions, setSuggestions] = useState([]);
  const [loading, setLoading]         = useState(false);
  const workerRef = useRef(null);
  const reqRef    = useRef(0);

  useEffect(() => {
    workerRef.current = new BrowserSuggestionWorker();
    return () => { workerRef.current?.terminate(); workerRef.current = null; };
  }, []);

  const nonAnswerMatches = useMemo(() => {
    if (!constraints || remainingWords.length === 0 || remainingWords.length > NON_ANSWER_THRESHOLD) return [];
    return WORDS.filter(w => !ANSWERS_SET.has(w) && constraints.matches(w));
  }, [remainingWords, constraints]);

  useEffect(() => {
    if (!workerRef.current || remainingWords.length === 0 || remainingWords.length === ANSWERS.length) {
      setSuggestions([]);
      setLoading(false);
      return;
    }
    const id = ++reqRef.current;
    setLoading(true);
    workerRef.current.compute(remainingWords, null).then(({ words }) => {
      if (reqRef.current === id) { setSuggestions(words); setLoading(false); }
    }).catch(() => {
      if (reqRef.current === id) setLoading(false);
    });
  }, [remainingWords]);

  const displayed    = suggestions.slice(0, SUGGESTION_CAP);
  const nonAnswers   = nonAnswerMatches.slice(0, Math.max(0, SUGGESTION_CAP - displayed.length));

  return { suggestions: displayed, nonAnswers, loading };
}
