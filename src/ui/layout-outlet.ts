import { useOutletContext } from 'react-router';

export interface LayoutOutletContext {
  projectRemoved: (slug: string) => void;
}

export function useProjectRemoved(): ((slug: string) => void) | undefined {
  return useOutletContext<LayoutOutletContext | null | undefined>()
    ?.projectRemoved;
}
