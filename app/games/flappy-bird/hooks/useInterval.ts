import { useEffect, useRef } from "react";

/**
 * A React hook that calls the callback every `delay` ms.
 * Pass `null` to pause; passing `undefined` also pauses.
 */
export function useInterval(callback: () => void, delay: number | undefined) {
  const savedCallback = useRef(callback);

  // Remember the latest callback.
  useEffect(() => {
    savedCallback.current = callback;
  }, [callback]);

  useEffect(() => {
    if (delay === undefined || delay === null) return;

    const id = setInterval(() => savedCallback.current(), delay);
    return () => clearInterval(id);
  }, [delay]);
}
