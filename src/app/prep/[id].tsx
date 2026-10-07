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
import { countTicketTapOnce } from '../../features/partners/ticketTaps';
import { useCatalog } from '../../state/catalog';
import { useSocial } from '../../state/social';
import { useWeekends } from '../../state/weekends';
import { color, space, type } from '../../theme/tokens';
import { t, tc } from '../../i18n';

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
  if (!whole) return <Missing title={t('Festival not found')} line={t('This festival isn’t on Afterglow any more, or the link isn’t quite right.')} />;
  return <PrepView festival={forYou(whole)} />;
}

function itemLabel(item: PrepItem): string {
  const base = item.detail ? t('{label}, {detail}', { label: item.label, detail: item.detail }) : item.label;
  if (!item.auto) return base;
  return item.done ? t('{label}, done', { label: base }) : t('{label}, not done yet. Opens it.', { label: base });
}

function PrepView({ festival }: { festival: Festival }) {
  const insets = useSafeAreaInsets();
  const today = useToday();
  const { sections, progress, toggle } = usePrep(festival);
  const { service, user } = useSocial();
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
      <PageTitle title={t('Get ready · {festival}', { festival: festival.name })} />
      <NightSky />
      <ScrollView contentContainerStyle={[styles.content, { paddingTop: insets.top + 64, paddingBottom: insets.bottom + space.xxxl }]}>
        <Text style={styles.kicker}>{festival.name}</Text>
        <Text style={styles.title}>{t('Get ready')}</Text>
        <Text style={styles.sub}>
          {soon ? t('{done} of {total} done · {soon}', { done: progress.done, total: progress.total, soon }) : tc('prep', '{done} of {total} done', { done: progress.done, total: progress.total })}
        </Text>
        <View style={styles.bar} accessible accessibilityLabel={tc('prep', '{done} of {total} done', { done: progress.done, total: progress.total })}>
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
                  accessibilityLabel={itemLabel(item)}
                  style={({ pressed }) => [styles.row, pressed && { opacity: 0.7 }]}
                >
                  <View style={[styles.check, item.done && styles.checkOn]}>{item.done ? <CheckIcon color={color.night} size={14} /> : null}</View>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.label, item.done && styles.labelDone]}>{item.label}</Text>
                    {item.detail || item.auto ? (
                      <Text style={styles.detail}>{[item.detail, item.auto ? (item.done ? t('Done in the app') : t('Do it in the app')) : ''].filter(Boolean).join(' · ')}</Text>
                    ) : null}
                  </View>
                  {item.auto ? <ChevronIcon color={color.moonFaint} size={12} /> : null}
                </Pressable>
                {item.action === 'tickets' && festival.links?.tickets && !item.done ? (
                  <Pressable
                    onPress={() => {
                      haptic.select();
                      countTicketTapOnce(service, festival.id, !!user);
                      void Linking.openURL(festival.links!.tickets!).catch(() => {});
                    }}
                    accessibilityRole="link"
                    accessibilityLabel={t('Get tickets for {festival}. Opens the official ticket page.', { festival: festival.name })}
                    hitSlop={8}
                    style={styles.inlineLink}
                  >
                    <Text style={styles.link}>{t('Get tickets ↗')}</Text>
                  </Pressable>
                ) : null}
                {item.link && !item.done ? (
                  <Pressable
                    onPress={() => {
                      haptic.select();
                      void Linking.openURL(item.link!.url).catch(() => {});
                    }}
                    accessibilityRole="link"
                    accessibilityLabel={t('{link}: {item}. Opens in your browser.', { link: item.link.label, item: item.label })}
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
        <Text style={styles.note}>{t('Only you see this list. It stays on this phone.')}</Text>
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
