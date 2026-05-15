import { useCallback, useRef, useState } from 'react';

/** Shows full-page skeleton only on the first load; background refetches stay silent. */
export function useInitialPageLoading(initiallyLoading = true) {
  const [loading, setLoading] = useState(initiallyLoading);
  const initialCompleteRef = useRef(false);

  const beginLoad = useCallback(() => {
    if (!initialCompleteRef.current) setLoading(true);
  }, []);

  const endLoad = useCallback(() => {
    initialCompleteRef.current = true;
    setLoading(false);
  }, []);

  return { loading, beginLoad, endLoad };
}
