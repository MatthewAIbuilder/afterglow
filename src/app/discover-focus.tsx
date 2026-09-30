import { router, useLocalSearchParams } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { CheckIcon, ChevronIcon } from '../components/TabIcons';
import { focusChoices, MIX, type FocusChoice } from '../features/discover/focus';
import { PlayIcon } from '../features/discover/icons';
import { countdown } from '../features/festivals/when';
import { haptic } from '../lib/haptics';
import { useToday } from '../lib/useToday';
import { useCatalog } from '../state/catalog';
import { useCommunity } from '../state/community';
import { useGoing } from '../state/going';
import { useSocial } from '../state/social';
import { color, radius, space, type } from '../theme/tokens';

/**
 * What Discover shows: your mix (a bit of everything), or one festival's
 * lineup. Festivals you're going to come first; others appear only when
 * they have clips to watch. A sheet over Discover.
 */
export default function DiscoverFocusScreen() {
  const { current } = useLocalSearchParams<{ current?: string }>();
  const catalog = useCatalog();
  const { going } = useGoing();
  const today = useToday();
  const insets = useSafeAreaInsets();
  const social = useSocial();
  const community = useCommunity();
  const choices = focusChoices(catalog.festivals, catalog.clips, going, today);
  const currentFestival = current && current !== MIX ? catalog.festival(current) : undefined;

  const pick = (focus: string) => {
    haptic.select();
    router.dismissTo({ pathname: '/', params: { festival: focus } });
  };

  const row = (key: string, title: string, detail: string, selected: boolean, onPress?: () => void, icon?: React.ReactNode) => (
    <Pressable
      key={key}
      onPress={onPress}
      disabled={!onPress}
      accessibilityRole="button"
      accessibilityLabel={`${title}, ${detail}`}
      accessibilityState={{ selected, disabled: !onPress }}
      style={({ pressed }) => [styles.row, selected && styles.selected, !onPress && styles.muted, pressed && styles.pressed]}
    >
      {icon}
      <View style={styles.rowText}>
        <Text style={styles.rowTitle} numberOfLines={1}>
          {title}
        </Text>
        <Text style={styles.detail} numberOfLines={1}>
          {detail}
        </Text>
      </View>
      {selected ? <CheckIcon color={color.glow} size={18} /> : null}
    </Pressable>
  );

  const festivalRow = ({ festival, clips }: FocusChoice) => {
    const when = countdown(festival, today) ?? festival.dates;
    const detail = clips > 0 ? `${clips} ${clips === 1 ? 'clip' : 'clips'} · ${when}` : `No clips yet · ${when}`;
    return row(festival.id, festival.name, detail, current === festival.id, clips > 0 ? () => pick(festival.id) : undefined);
  };

  return (
    <ScrollView style={styles.root} contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + space.xl }]}>
      <Text style={styles.title}>What to discover</Text>
      <Text style={styles.body}>Focus on a festival to shape your plan for it, or mix it up.</Text>

      <View style={styles.list}>
        {row(MIX, 'Your mix', 'A bit of everything, from every lineup', current === MIX, () => pick(MIX), (
          <View style={styles.mixIcon}>
            <PlayIcon color={color.moon} size={14} />
          </View>
        ))}
      </View>

      {choices.going.length > 0 && (
        <>
          <Text style={styles.section}>Going</Text>
          <View style={styles.list}>{choices.going.map(festivalRow)}</View>
        </>
      )}
      {choices.others.length > 0 && (
        <>
          <Text style={styles.section}>{choices.going.length ? 'More festivals' : 'Festivals'}</Text>
          <View style={styles.list}>{choices.others.map(festivalRow)}</View>
        </>
      )}
      {choices.going.length === 0 && (
        <Text style={styles.hint}>Mark the festivals you’re going to on the Festivals tab and they’ll show up first.</Text>
      )}

      {social.availability.ok && (
        <View style={styles.switchRow}>
          <View style={styles.rowText}>
            <Text style={styles.rowTitle}>Videos from the crowd</Text>
            <Text style={styles.switchDetail}>
              {!social.user
                ? 'Sign in on your profile to see videos people shared from the festival.'
                : community.enabled
                  ? 'Videos people shared from the festival, beside the official clips.'
                  : 'Only official clips.'}
            </Text>
          </View>
          <Switch
            value={community.enabled}
            onValueChange={(v) => {
              haptic.select();
              community.setEnabled(v);
            }}
            trackColor={{ true: color.glowDeep, false: 'rgba(255,255,255,0.15)' }}
            accessibilityLabel="Videos from the crowd"
            testID="community-switch"
          />
        </View>
      )}

      {currentFestival && (
        <Pressable
          onPress={() => {
            haptic.select();
            router.back();
            router.push(`/festival/${currentFestival.id}`);
          }}
          accessibilityRole="button"
          accessibilityLabel={`Open ${currentFestival.name}, its lineup and your plan`}
          style={({ pressed }) => [styles.link, pressed && { opacity: 0.7 }]}
        >
          <Text style={styles.linkText}>Open {currentFestival.name}</Text>
          <ChevronIcon color={color.moonDim} size={12} />
        </Pressable>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: color.nightRaised },
  content: { paddingHorizontal: space.xl, paddingTop: space.xxl },
  title: { ...type.title, color: color.moon },
  body: { ...type.body, color: color.moonDim, marginTop: space.xs },
  section: { ...type.label, color: color.moonFaint, textTransform: 'uppercase', letterSpacing: 0.8, marginTop: space.xl },
  list: { gap: space.sm, marginTop: space.md },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    minHeight: 60,
    paddingHorizontal: space.lg,
    paddingVertical: space.sm,
    borderRadius: radius.md,
    backgroundColor: color.glass,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: color.hairline,
  },
  selected: { backgroundColor: 'rgba(169,124,255,0.16)', borderColor: 'rgba(169,124,255,0.45)' },
  muted: { opacity: 0.45 },
  pressed: { opacity: 0.75, transform: [{ scale: 0.99 }] },
  rowText: { flex: 1 },
  rowTitle: { ...type.headline, color: color.moon },
  detail: { ...type.caption, color: color.moonDim, marginTop: 2, fontVariant: ['tabular-nums'] },
  mixIcon: {
    width: 32,
    height: 32,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: color.glowDeep,
  },
  hint: { ...type.caption, color: color.moonFaint, marginTop: space.lg },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    marginTop: space.xl,
    paddingHorizontal: space.lg,
    paddingVertical: space.md,
    borderRadius: radius.md,
    backgroundColor: color.glass,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: color.hairline,
  },
  switchDetail: { ...type.caption, color: color.moonDim, marginTop: 2 },
  link: { flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'center', marginTop: space.xl, padding: space.sm },
  linkText: { ...type.label, color: color.moonDim },
});
