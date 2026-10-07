import { describe, expect, it } from '@jest/globals';
import { milestones } from '../milestones';

const base = { been: 0, cities: 0, moments: 0, kept: 0, rated: 0, bass: 0 };
const by = (list: ReturnType<typeof milestones>, id: string) => list.find((m) => m.id === id)!;

describe('collecting milestones', () => {
  it('kandi, a shiny, stickers, gold and half the collection', () => {
    const none = milestones(base);
    for (const id of ['kandi', 'lucky', 'hunter', 'golden', 'halfway']) expect(by(none, id).earned).toBe(false);
    const all = milestones({ ...base, kandi: 5, shiny: 1, stickers: 6, gold: 1, collected: 50 });
    for (const id of ['kandi', 'lucky', 'hunter', 'golden', 'halfway']) expect(by(all, id).earned).toBe(true);
    expect(by(milestones({ ...base, collected: 23 }), 'halfway').current).toBe(23);
  });
});
