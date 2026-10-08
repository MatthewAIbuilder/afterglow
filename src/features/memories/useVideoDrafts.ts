import { useEffect, useState } from 'react';
import { listDrafts, onDraftsChange, type VideoDraft } from './webDrafts';

/** The website camera's drafts, newest first, kept up to date (none in the app). */
export function useVideoDrafts(): VideoDraft[] | undefined {
  const [drafts, setDrafts] = useState<VideoDraft[] | undefined>();
  useEffect(() => {
    let live = true;
    const load = () => void listDrafts().then((d) => live && setDrafts(d));
    load();
    const off = onDraftsChange(load);
    return () => {
      live = false;
      off();
    };
  }, []);
  return drafts;
}
