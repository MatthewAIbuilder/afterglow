import { router } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { LOCALE, t } from '../../i18n';
import { haptic } from '../../lib/haptics';
import { useFinds } from '../../state/finds';
import { color, radius, space, type } from '../../theme/tokens';
import { Collectible } from '../sprouts/Collectible';
import { huntLine, lookOf, untilLine } from './finds';
import { HuntRow } from './HuntRow';

const TILE = 104;
const day = (at: number) => new Date(at).toLocaleDateString(LOCALE, { month: 'short', day: 'numeric', year: 'numeric' });

/**
 * The garden's stickers: hunts you've started (finished ones in gold) and
 * every sticker you've found. Hidden until you've scanned one.
 */
export function FindsSection() {
  const { finds, hunts } = useFinds();
  const shown = finds.filter((f) => f.state === 'found' || f.state === 'checking');
  if (!shown.length) return null;
  const count = shown.filter((f) => f.state === 'found').length;
  return (
    <View style={styles.section}>
      <Text style={styles.h2} accessibilityRole="header">
        {count ? t('Stickers you’ve found · {n}', { n: count }) : t('Stickers you’ve found')}
      </Text>
      <Text style={styles.sub}>{t('Scanned at festivals. Each one lives here for good.')}</Text>
      {hunts.map((p) => (
        <Pressable
          key={p.hunt.id}
          onPress={() => {
            haptic.select();
            router.push({ pathname: '/hunt/[id]', params: { id: p.hunt.id } });
          }}
          accessibilityRole="button"
          accessibilityLabel={t('{hunt}: {progress}.', { hunt: p.hunt.name, progress: huntLine(p) })}
          accessibilityHint={p.done ? t('Opens a card to share') : t('Opens the hunt')}
          style={({ pressed }) => [styles.hunt, p.done && styles.huntDone, pressed && styles.pressed]}
        >
          <Text style={styles.huntName}>{p.hunt.name}</Text>
          <Text style={[styles.huntLine, p.done && { color: '#FFD24A' }]}>
            {!p.done && p.hunt.until ? t('{progress} · {until}', { progress: huntLine(p), until: untilLine(p.hunt.until) }) : huntLine(p)}
          </Text>
          <HuntRow hunt={p.hunt} found={p.found} size={40} />
        </Pressable>
      ))}
      <View style={styles.grid}>
        {shown.map((f) => (
          <Pressable
            key={f.code}
            onPress={() => {
              haptic.select();
              router.push({ pathname: '/find/[code]', params: { code: f.code, c: f.creature, n: f.name } });
            }}
            accessibilityRole="button"
            accessibilityLabel={f.state === 'checking' ? t('{name}, waiting for signal to check it.', { name: f.name }) : t('{name}, found {date}.', { name: f.name, date: day(f.at) })}
            style={({ pressed }) => [styles.tile, pressed && styles.pressed]}
          >
            <Collectible look={lookOf(f.creature)} size={78} locked={f.state !== 'found'} />
            <Text style={styles.tileName} numberOfLines={2}>
              {f.name}
            </Text>
            <Text style={styles.tileSub} numberOfLines={1}>
              {f.state === 'found' ? day(f.at) : t('Checking…')}
            </Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  section: { gap: space.sm, marginTop: space.md },
  h2: { ...type.headline, color: color.moon },
  sub: { ...type.caption, color: color.moonDim },
  hunt: { padding: space.md, gap: space.xs, borderRadius: radius.md, backgroundColor: color.glass, borderWidth: StyleSheet.hairlineWidth, borderColor: color.hairline, alignItems: 'center' },
  huntDone: { borderColor: 'rgba(255,210,74,0.5)' },
  huntName: { ...type.label, color: color.moon },
  huntLine: { ...type.caption, color: color.moonDim },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  tile: { width: TILE, alignItems: 'center', paddingVertical: space.sm, paddingHorizontal: 4, borderRadius: radius.md, backgroundColor: color.glass, borderWidth: StyleSheet.hairlineWidth, borderColor: color.hairline },
  tileName: { ...type.label, color: color.moon, marginTop: 2, textAlign: 'center' },
  tileSub: { ...type.caption, color: color.moonFaint },
  pressed: { opacity: 0.8, transform: [{ scale: 0.98 }] },
});
