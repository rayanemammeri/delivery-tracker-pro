import { useEffect, useState } from 'react';

/** Mini-routeur basé sur le hash (#/bilan/2026-11-21) : fonctionne sur tout hébergement statique. */
export function useRoute(): string[] {
  const get = () => (window.location.hash.replace(/^#\/?/, '') || '').split('/').filter(Boolean);
  const [route, setRoute] = useState(get);
  useEffect(() => {
    const on = () => {
      setRoute(get());
      window.scrollTo(0, 0);
    };
    window.addEventListener('hashchange', on);
    return () => window.removeEventListener('hashchange', on);
  }, []);
  return route;
}

export function navigate(path: string): void {
  window.location.hash = '#/' + path.replace(/^\//, '');
}
