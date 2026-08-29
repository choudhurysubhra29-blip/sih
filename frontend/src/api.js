import { useEffect, useRef, useState } from "react";

export const API = process.env.REACT_APP_BACKEND_URL;

export async function get(path) {
  const res = await fetch(`${API}/api${path}`);
  if (!res.ok) throw new Error(`GET ${path} ${res.status}`);
  return res.json();
}

export async function post(path, body) {
  const res = await fetch(`${API}/api${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`POST ${path} ${res.status}`);
  return res.json();
}

export function usePoll(path, intervalMs = 3000, deps = []) {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const timer = useRef(null);
  useEffect(() => {
    let active = true;
    setData(null);
    const load = () =>
      get(path)
        .then((d) => active && (setData(d), setError(null)))
        .catch((e) => active && setError(e));
    load();
    timer.current = setInterval(load, intervalMs);
    return () => {
      active = false;
      clearInterval(timer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
  return { data, error };
}
