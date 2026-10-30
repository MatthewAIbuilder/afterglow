import { useCallback, useEffect, useState } from 'react';
import { AppState } from 'react-native';
import type { CrewItem } from '../features/social/models';
import { useSocial } from './social';

const READ_EVERY_MS = 30_000;

/**
 * The crew's list (who's bringing what): read when the crew page opens and
 * every half minute while it's open; adding, ticking and removing show at
 * once and need signal (they say so when they can't be saved).
 */
export function useCrewList(crewId: string) {
  const social = useSocial();
  const service = social.service;
  const signedIn = !!social.user;
  const [state, setState] = useState<{ crewId: string; items: CrewItem[]; loaded: boolean }>({ crewId, items: [], loaded: false });
  const read = useCallback(
    () =>
      service
        .crewList(crewId)
        .then((items) => setState({ crewId, items, loaded: true }))
        .catch(() => setState((s) => (s.crewId === crewId ? { ...s, loaded: true } : { crewId, items: [], loaded: true }))),
    [crewId, service],
  );
  useEffect(() => {
    if (!signedIn) return;
    void Promise.resolve().then(read);
    const timer = setInterval(() => {
      if (AppState.currentState === 'active') void read();
    }, READ_EVERY_MS);
    return () => clearInterval(timer);
  }, [signedIn, read]);
  const items = state.crewId === crewId ? state.items : [];
  const change = (next: (list: CrewItem[]) => CrewItem[]) => setState((s) => ({ crewId, items: next(s.crewId === crewId ? s.items : []), loaded: true }));
  const add = useCallback(
    async (text: string) => {
      const item = await service.addCrewItem(crewId, text);
      setState((s) => ({ crewId, items: [...(s.crewId === crewId ? s.items : []), item], loaded: true }));
    },
    [crewId, service],
  );
  const tick = async (item: CrewItem, done: boolean, me: string) => {
    change((list) => list.map((x) => (x.id === item.id ? (done ? { ...x, done: true, doneBy: me } : { id: x.id, text: x.text, by: x.by, at: x.at }) : x)));
    try {
      await service.setCrewItemDone(crewId, item.id, done);
    } catch (e) {
      void read();
      throw e;
    }
  };
  const remove = async (item: CrewItem) => {
    change((list) => list.filter((x) => x.id !== item.id));
    try {
      await service.removeCrewItem(crewId, item.id);
    } catch (e) {
      void read();
      throw e;
    }
  };
  return { items, loaded: state.crewId === crewId && state.loaded, add, tick, remove };
}
