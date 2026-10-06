import { Redirect, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { PageActions } from '../components/PageActions';
import { PageTitle } from '../components/PageTitle';
import { isSupportAccount } from '../features/admin/admin';
import { useMyOrg } from '../state/orgs';
import type { Sticker } from '../features/finds/finds';
import { STICKER_W, StickerCard } from '../features/finds/StickerCard';
import { useSocial } from '../state/social';
import { color, radius, space, type } from '../theme/tokens';

/** Copies of one sticker on a sheet (a hunt prints one of each). */
const COPIES = 4;

/** A `data-` attribute on the website, for the print rules (React Native for Web's `dataSet`). */
const mark = (d: Record<string, string>) => ({ dataSet: d }) as object;

/** What the browser should do when printing: just the stickers, in their colours, nothing else. */
const PRINT_CSS = `
@page { margin: 0.4in; }
@media print {
  [data-noprint] { display: none !important; }
  * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
  html, body, #root, *:has([data-sheet="scroll"]), [data-sheet="scroll"], [data-sheet="scroll"] > div {
    overflow: visible !important; height: auto !important; max-height: none !important; position: static !important; background: #fff !important;
  }
  [data-sheet="sticker"] { break-inside: avoid; page-break-inside: avoid; }
}`;

/**
 * Print stickers (HQ, or an organizer's team with `?org=`): `?code=` for
 * copies of one, `?hunt=` for one of each in a hunt. On the website, Print opens the browser's print window
 * (choose Save as PDF to send them to a sticker printer). Each sticker is
 * the creature on its night tile, its name and its code, with a white
 * square behind the code so any phone camera reads it.
 */
export default function StickerSheetScreen() {
  const { code, hunt, org } = useLocalSearchParams<{ code?: string; hunt?: string; org?: string }>();
  const social = useSocial();
  // HQ, or an organizer's team printing its own (`?org=`).
  const mine = useMyOrg(social.user?.uid);
  const allowed = isSupportAccount(social.user) || (!!org && mine === org);
  const insets = useSafeAreaInsets();
  const [stickers, setStickers] = useState<Sticker[] | undefined>();

  useEffect(() => {
    if (!social.ready || !allowed) return;
    let on = true;
    (async () => {
      try {
        if (code) {
          const s = await social.service.sticker(code);
          if (on) setStickers(s && s.takenDownAt === undefined ? Array.from({ length: COPIES }, () => s) : []);
        } else if (hunt) {
          const all = org ? await social.service.orgStickers(org, 200) : await social.service.stickers(200);
          if (on) setStickers(all.filter((s) => s.huntId === hunt).sort((a, b) => (a.slot ?? 0) - (b.slot ?? 0)));
        } else if (on) setStickers([]);
      } catch {
        if (on) setStickers([]);
      }
    })();
    return () => {
      on = false;
    };
  }, [social.ready, allowed, social.service, code, hunt, org]);

  // The browser's print rules, while this page is open.
  useEffect(() => {
    if (Platform.OS !== 'web' || typeof document === 'undefined') return;
    const el = document.createElement('style');
    el.textContent = PRINT_CSS;
    document.head.appendChild(el);
    return () => el.remove();
  }, []);

  if (social.ready && !allowed && !(org && mine === null && social.user)) return <Redirect href="/" />;

  const web = Platform.OS === 'web';
  return (
    <View style={styles.root}>
      <PageTitle title="Print stickers" />
      <View {...mark({ noprint: '1' })}>
        <PageActions />
      </View>
      <ScrollView {...mark({ sheet: 'scroll' })} contentContainerStyle={[styles.content, { paddingTop: insets.top + space.xxxl + space.lg, paddingBottom: insets.bottom + space.xxl }]}>
        <View {...mark({ noprint: '1' })} style={styles.intro}>
          <Text style={styles.title}>Print stickers</Text>
          <Text style={styles.body}>
            {web
              ? 'Print opens your browser’s print window. Choose Save as PDF to send them to a sticker printer, or print a test sheet at home and scan it with your phone.'
              : 'Open Afterglow HQ on the website on a computer to print these.'}
          </Text>
          {web ? (
            <Pressable onPress={() => window.print()} accessibilityRole="button" style={({ pressed }) => [styles.primary, pressed && styles.pressed]}>
              <Text style={styles.primaryText}>Print</Text>
            </Pressable>
          ) : null}
        </View>
        {!stickers ? null : stickers.length ? (
          <View style={styles.sheet}>
            {stickers.map((s, i) => (
              <View key={`${s.code}-${i}`} {...mark({ sheet: 'sticker' })}>
                <StickerCard sticker={s} />
              </View>
            ))}
          </View>
        ) : (
          <Text style={styles.body}>No stickers to print here.</Text>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: color.night },
  content: { paddingHorizontal: space.xl, gap: space.lg, alignItems: 'center' },
  intro: { maxWidth: 560, gap: space.sm, alignSelf: 'stretch' },
  title: { ...type.title, color: color.moon },
  body: { ...type.body, color: color.moonDim },
  primary: { alignSelf: 'flex-start', paddingHorizontal: space.xl, paddingVertical: space.md, borderRadius: radius.pill, backgroundColor: color.glow, marginTop: space.xs },
  primaryText: { ...type.headline, color: color.night },
  sheet: { flexDirection: 'row', flexWrap: 'wrap', gap: 24, justifyContent: 'center', maxWidth: STICKER_W * 2 + 24 },
  pressed: { opacity: 0.8, transform: [{ scale: 0.98 }] },
});
