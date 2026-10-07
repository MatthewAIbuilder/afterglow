import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { PersonAvatar } from '../../components/PersonAvatar';
import { SheetClose } from '../../components/SheetClose';
import { LOCALE, t, tn } from '../../i18n';
import { haptic } from '../../lib/haptics';
import type { Profile } from '../social/models';
import { useSocial } from '../../state/social';
import { color, radius, space, type } from '../../theme/tokens';
import type { GardenGlow } from './useGardenGlows';

/** Names shown before "and N more". */
const NAMED = 3;
/** People read for the list (the newest). */
const LISTED = 40;
const GOLD = '#FFE58A';

const day = (iso: string) => {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleDateString(LOCALE, { month: 'short', day: 'numeric' });
};

/**
 * The glows visitors left on your garden: how many, and the latest few by
 * name. A tap lists everyone who left one, with a way to visit theirs back.
 * Nothing until someone leaves one.
 */
export function GlowsLine({ glows }: { glows: readonly GardenGlow[] }) {
  const { service } = useSocial();
  const [people, setPeople] = useState<Record<string, Profile | null>>({});
  const [open, setOpen] = useState(false);
  const wanted = glows.slice(0, open ? LISTED : NAMED).map((g) => g.from).join(',');
  useEffect(() => {
    if (!wanted) return;
    let live = true;
    const uids = wanted.split(',');
    Promise.all(uids.map((uid) => service.profileOf(uid).catch(() => null)))
      .then((list) => {
        if (!live) return;
        setPeople((cur) => ({ ...cur, ...Object.fromEntries(uids.map((uid, i) => [uid, list[i]])) }));
      })
      .catch(() => {});
    return () => {
      live = false;
    };
  }, [wanted, service]);
  if (!glows.length) return null;
  const names = glows
    .slice(0, NAMED)
    .flatMap((g) => (people[g.from]?.handle ? [`@${people[g.from]!.handle}`] : []));
  const more = glows.length - names.length;
  const who = !names.length ? '' : more > 0 ? t('{names} and {n} more', { names: names.join(', '), n: more }) : names.join(t(' and '));
  const count = tn(glows.length, '{n} glow from visitors', '{n} glows from visitors');
  return (
    <>
      <Pressable
        onPress={() => {
          haptic.select();
          setOpen(true);
        }}
        accessibilityRole="button"
        accessibilityLabel={`${count}${who ? `. ${who}` : ''}. ${t('See who')}`}
        style={({ pressed }) => [styles.wrap, pressed && styles.pressed]}
      >
        <Text style={styles.count}>{`✦ ${count}`}</Text>
        {who ? <Text style={styles.who}>{who}</Text> : null}
      </Pressable>
      <GlowsSheet open={open} glows={glows.slice(0, LISTED)} people={people} onClose={() => setOpen(false)} />
    </>
  );
}

function GlowsSheet({ open, glows, people, onClose }: { open: boolean; glows: readonly GardenGlow[]; people: Record<string, Profile | null>; onClose: () => void }) {
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();
  return (
    <Modal visible={open} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.scrim} onPress={onClose} accessibilityRole="button" accessibilityLabel={t('Close')}>
        <Pressable style={[styles.sheet, { paddingBottom: insets.bottom + space.xl, maxHeight: height * 0.8 }]} onPress={() => {}} accessible={false}>
          <SheetClose onPress={onClose} />
          <Text style={styles.title} accessibilityRole="header">
            {t('Glows on your garden')}
          </Text>
          <Text style={styles.sub}>{t('People who visited and liked it. Visit theirs back?')}</Text>
          <ScrollView contentContainerStyle={styles.list}>
            {glows.map((g) => {
              const p = people[g.from];
              if (!p) return null;
              return (
                <View key={g.from} style={styles.row}>
                  <PersonAvatar name={p.displayName} url={p.avatarUrl} size={40} uid={p.uid} />
                  <View style={styles.rowText}>
                    <Text style={styles.name} numberOfLines={1}>
                      {p.displayName}
                    </Text>
                    <Text style={styles.handle} numberOfLines={1}>{`@${p.handle} · ${day(g.at)}`}</Text>
                  </View>
                  <Pressable
                    onPress={() => {
                      haptic.select();
                      onClose();
                      router.push({ pathname: '/garden-visit', params: { uid: p.uid, handle: p.handle } });
                    }}
                    accessibilityRole="button"
                    accessibilityLabel={t('Visit @{handle}’s garden', { handle: p.handle })}
                    style={({ pressed }) => [styles.visit, pressed && styles.pressed]}
                  >
                    <Text style={styles.visitText}>{t('Visit')}</Text>
                  </Pressable>
                </View>
              );
            })}
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', gap: 2, marginTop: space.xs, alignSelf: 'center', paddingHorizontal: space.md, paddingVertical: space.xs, borderRadius: radius.pill },
  pressed: { opacity: 0.8 },
  count: { ...type.label, color: GOLD },
  who: { ...type.caption, color: 'rgba(255,229,138,0.7)' },
  scrim: { flex: 1, backgroundColor: 'rgba(5,4,14,0.7)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: color.nightRaised, borderTopLeftRadius: radius.sheet, borderTopRightRadius: radius.sheet, padding: space.xl, gap: space.sm, maxWidth: 560, width: '100%', alignSelf: 'center' },
  title: { ...type.title, color: GOLD },
  sub: { ...type.body, color: color.moonDim },
  list: { gap: space.md, paddingTop: space.md },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  rowText: { flex: 1, minWidth: 0 },
  name: { ...type.headline, color: color.moon },
  handle: { ...type.caption, color: color.moonDim },
  visit: { paddingHorizontal: space.lg, paddingVertical: space.sm, borderRadius: radius.pill, borderWidth: 1, borderColor: GOLD },
  visitText: { ...type.label, color: GOLD },
});
