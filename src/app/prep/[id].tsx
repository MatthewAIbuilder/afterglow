import { router, useLocalSearchParams } from 'expo-router';
import { Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Missing } from '../../components/Missing';
import { NightSky } from '../../components/NightSky';
import { PageActions } from '../../components/PageActions';
import { PageTitle } from '../../components/PageTitle';
import { CheckIcon, ChevronIcon } from '../../components/TabIcons';
import type { Festival } from '../../data/models';
import { sectionNotes, type PrepItem } from '../../features/prep/checklist';
import { usePrep } from '../../features/prep/usePrep';
import { countdown } from '../../features/festivals/when';
import { haptic } from '../../lib/haptics';
import { useToday } from '../../lib/useToday';
import { useCatalog } from '../../state/catalog';
import { useWeekends } from '../../state/weekends';
import { color, space, type } from '../../theme/tokens';

/**
 * Get ready: one checklist for a festival you're going to. The app ticks
 * what it can see you've done (rating the lineup, starring must-sees,
 * reminders); you tick the rest (ticket, travel, what to pack).
 */
export default function PrepScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const catalog = useCatalog();
  const { forYou } = useWeekends();
  const whole = catalog.festival(id);
  if (!whole) return <Missing title="Festival not found" line="This festival isn’t on Afterglow any more, or the link isn’t quite right." />;
  return <PrepView festival={forYou(whole)} />;
}

function PrepView({ festival }: { festival: Festival }) {
  const insets = useSafeAreaInsets();
  const today = useToday();
  const { sections, progress, toggle } = usePrep(festival);
  const soon = countdown(festival, today);

  const onItem = (item: PrepItem) => {
    if (item.auto) {
      haptic.select();
      if (item.action === 'tune') router.push(`/tune/${festival.id}`);
      else router.push(`/festival/${festival.id}`);
      return;
    }
    haptic[item.done ? 'select' : 'tap']();
    toggle(item.id);
  };

  return (
    <View style={styles.root}>
      <PageTitle title={`Get ready · ${festival.name}`} />
      <NightSky />
      <ScrollView contentContainerStyle={[styles.content, { paddingTop: insets.top + 64, paddingBottom: insets.bottom + space.xxxl }]}>
        <Text style={styles.kicker}>{festival.name}</Text>
        <Text style={styles.title}>Get ready</Text>
        <Text style={styles.sub}>
          {progress.done} of {progress.total} done{soon ? ` · ${soon}` : ''}
        </Text>
        <View style={styles.bar} accessible accessibilityLabel={`${progress.done} of ${progress.total} done`}>
          <View style={[styles.fill, { width: `${(progress.done / Math.max(1, progress.total)) * 100}%` }]} />
        </View>
        {sections.map((s) => (
          <View key={s.title} style={styles.section}>
            <Text style={styles.sectionTitle}>{s.title}</Text>
            {s.items.map((item) => (
              <View key={item.id} style={styles.rowWrap}>
                <Pressable
                  onPress={() => onItem(item)}
                  accessibilityRole={item.auto ? 'button' : 'checkbox'}
                  accessibilityState={item.auto ? undefined : { checked: item.done }}
                  accessibilityLabel={`${item.label}${item.detail ? `, ${item.detail}` : ''}${item.auto ? (item.done ? ', done' : ', not done yet. Opens it.') : ''}`}
                  style={({ pressed }) => [styles.row, pressed && { opacity: 0.7 }]}
                >
                  <View style={[styles.check, item.done && styles.checkOn]}>{item.done ? <CheckIcon color={color.night} size={14} /> : null}</View>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.label, item.done && styles.labelDone]}>{item.label}</Text>
                    {item.detail || item.auto ? (
                      <Text style={styles.detail}>{[item.detail, item.auto ? (item.done ? 'Done in the app' : 'Do it in the app') : ''].filter(Boolean).join(' · ')}</Text>
                    ) : null}
                  </View>
                  {item.auto ? <ChevronIcon color={color.moonFaint} size={12} /> : null}
                </Pressable>
                {item.action === 'tickets' && festival.links?.tickets && !item.done ? (
                  <Pressable
                    onPress={() => {
                      haptic.select();
                      void Linking.openURL(festival.links!.tickets!).catch(() => {});
                    }}
                    accessibilityRole="link"
                    accessibilityLabel={`Get tickets for ${festival.name}. Opens the official ticket page.`}
                    hitSlop={8}
                    style={styles.inlineLink}
                  >
                    <Text style={styles.link}>Get tickets ↗</Text>
                  </Pressable>
                ) : null}
                {item.link && !item.done ? (
                  <Pressable
                    onPress={() => {
                      haptic.select();
                      void Linking.openURL(item.link!.url).catch(() => {});
                    }}
                    accessibilityRole="link"
                    accessibilityLabel={`${item.link.label}: ${item.label}. Opens in your browser.`}
                    hitSlop={8}
                    style={styles.inlineLink}
                  >
                    <Text style={styles.link}>{item.link.label} ↗</Text>
                  </Pressable>
                ) : null}
              </View>
            ))}
            {sectionNotes(s, festival).map((n) => (
              <Text key={n} style={styles.partnerNote}>
                {n}
              </Text>
            ))}
          </View>
        ))}
        <Text style={styles.note}>Only you see this list. It stays on this phone.</Text>
      </ScrollView>
      <PageActions />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: color.night },
  content: { paddingHorizontal: space.xl, alignSelf: 'center', width: '100%', maxWidth: 640 },
  kicker: { ...type.label, color: color.glow },
  title: { ...type.largeTitle, color: color.moon, marginTop: space.xs },
  sub: { ...type.body, color: color.moonDim, marginTop: space.xs },
  bar: { height: 6, borderRadius: 3, backgroundColor: color.glass, marginTop: space.md, overflow: 'hidden' },
  fill: { height: 6, borderRadius: 3, backgroundColor: color.glow },
  section: { marginTop: space.xl },
  sectionTitle: { ...type.label, color: color.moonFaint, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: space.sm },
  rowWrap: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: color.hairline },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingVertical: space.md },
  check: { width: 24, height: 24, borderRadius: 12, borderWidth: 1.5, borderColor: color.moonFaint, alignItems: 'center', justifyContent: 'center' },
  checkOn: { backgroundColor: color.glow, borderColor: color.glow },
  label: { ...type.body, color: color.moon },
  labelDone: { color: color.moonDim },
  detail: { ...type.caption, color: color.moonFaint, marginTop: 2 },
  inlineLink: { paddingLeft: 24 + space.md, paddingBottom: space.md, marginTop: -space.xs },
  link: { ...type.label, color: color.glow },
  note: { ...type.caption, color: color.moonFaint, marginTop: space.xl },
  partnerNote: { ...type.caption, color: color.moonFaint, marginTop: space.sm },
});
