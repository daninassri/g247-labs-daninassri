// Hook reutilizable: expone datos, carga, error y recarga.
// Se vuelve a ejecutar cuando cambia alguna dependencia y descarta las respuestas antiguas.
import { useCallback, useEffect, useState } from "react";

export function useApi(fetcher, deps) {
  const [state, setState] = useState({ data: null, loading: true, error: null });
  const [tick, setTick] = useState(0);

  useEffect(() => {
    let ignore = false;
    setState((s) => ({ ...s, loading: true, error: null }));
    fetcher()
      .then((data) => {
        if (!ignore) setState({ data, loading: false, error: null });
      })
      .catch((error) => {
        if (!ignore) setState((s) => ({ ...s, loading: false, error }));
      });
    return () => {
      ignore = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, tick]);

  const reload = useCallback(() => setTick((t) => t + 1), []);
  return { ...state, reload };
}
