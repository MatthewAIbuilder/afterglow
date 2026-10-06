import { describe, expect, it } from '@jest/globals';
import { cleanLedger, creditGlow, EMPTY_LEDGER, glowAtLevel, LEDGER_ACCOUNTS_MAX } from '../accountGlow';
import { levelOf } from '../daily';

describe('each account’s glow on this phone', () => {
  it('knows the glow each level starts at', () => {
    for (const level of [1, 2, 5, 11, 12, 14]) expect(levelOf(glowAtLevel(level)).level).toBe(level);
    expect(levelOf(glowAtLevel(5) - 1).level).toBe(4);
    expect(glowAtLevel(0)).toBe(0);
  });

  it('gives the phone’s glow so far to the first account signed in, and new glow to whoever is signed in', () => {
    let l = creditGlow(EMPTY_LEDGER, 'sam', 300);
    expect(l.accounts.sam).toBe(300);
    l = creditGlow(l, 'sam', 340);
    expect(l.accounts.sam).toBe(340);
    // Maya signs in on the same phone: Sam's glow isn't hers.
    l = creditGlow(l, 'maya', 340);
    expect(l.accounts.maya).toBe(0);
    l = creditGlow(l, 'maya', 400);
    expect(l.accounts).toEqual({ sam: 340, maya: 60 });
    // Back to Sam: unchanged.
    l = creditGlow(l, 'sam', 400);
    expect(l.accounts.sam).toBe(340);
  });

  it('is the same ledger when nothing changed, and signed out nothing is given', () => {
    const l = creditGlow(EMPTY_LEDGER, 'sam', 100);
    expect(creditGlow(l, 'sam', 100)).toBe(l);
    expect(creditGlow(l, undefined, 500)).toBe(l);
    // Glow earned signed out goes to the next account signed in.
    expect(creditGlow(l, 'sam', 500).accounts.sam).toBe(500);
  });

  it('never takes glow away, and glow earned back after a drop isn’t counted twice', () => {
    let l = creditGlow(EMPTY_LEDGER, 'sam', 300);
    l = creditGlow(l, 'sam', 150);
    expect(l.accounts.sam).toBe(300);
    l = creditGlow(l, 'sam', 300);
    expect(l.accounts.sam).toBe(300);
    l = creditGlow(l, 'sam', 320);
    expect(l.accounts.sam).toBe(320);
  });

  it('starts from the level the account already shows, without adding this phone’s glow on top of it', () => {
    // Level 5 shown (sent from another phone), nothing here yet.
    let l = creditGlow(EMPTY_LEDGER, 'sam', 0, 5);
    expect(levelOf(l.accounts.sam).level).toBe(5);
    l = creditGlow(l, 'sam', 30, 5);
    expect(l.accounts.sam).toBe(glowAtLevel(5) + 30);
    // The level shown came from this phone: not counted twice.
    const same = creditGlow(EMPTY_LEDGER, 'maya', glowAtLevel(3) + 20, 3);
    expect(same.accounts.maya).toBe(glowAtLevel(3) + 20);
  });

  it('keeps a bounded number of accounts, always the one signed in', () => {
    let l = EMPTY_LEDGER;
    for (let i = 0; i < LEDGER_ACCOUNTS_MAX + 5; i++) l = creditGlow(l, `u${i}`, (i + 1) * 10);
    expect(Object.keys(l.accounts)).toHaveLength(LEDGER_ACCOUNTS_MAX);
    expect(l.accounts[`u${LEDGER_ACCOUNTS_MAX + 4}`]).toBe(10);
  });

  it('cleans what was saved', () => {
    expect(cleanLedger(null)).toEqual(EMPTY_LEDGER);
    expect(cleanLedger({ phone: 'x', accounts: { sam: 40.7, maya: -3, '': 5, bob: 'no' } })).toEqual({ phone: 0, accounts: { sam: 40, maya: 0, bob: 0 } });
  });
});
