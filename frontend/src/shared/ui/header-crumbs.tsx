import { createContext, useContext, useMemo, useState, type ReactNode } from 'react';

export interface Crumb {
  label: string;
  to?: string;
}

interface HeaderCrumbsApi {
  crumbs: Crumb[];
  setCrumbs: (crumbs: Crumb[]) => void;
}

const HeaderCrumbsContext = createContext<HeaderCrumbsApi>({ crumbs: [], setCrumbs: () => undefined });

/** Lets a page publish its ancestor breadcrumbs to the app header (see PageHeader). */
export function HeaderCrumbsProvider({ children }: { children: ReactNode }): JSX.Element {
  const [crumbs, setCrumbs] = useState<Crumb[]>([]);
  const api = useMemo(() => ({ crumbs, setCrumbs }), [crumbs]);
  return <HeaderCrumbsContext.Provider value={api}>{children}</HeaderCrumbsContext.Provider>;
}

export function useHeaderCrumbs(): HeaderCrumbsApi {
  return useContext(HeaderCrumbsContext);
}
