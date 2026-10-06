import { router, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import Animated, { useAnimatedStyle, useReducedMotion, useSharedValue, withSequence, withSpring, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ConfettiBurst } from '../../components/ConfettiBurst';
import { GlassCircleButton } from '../../components/GlassCircleButton';
import { Missing } from '../../components/Missing';
import { NightSky } from '../../components/NightSky';
import { PageTitle } from '../../components/PageTitle';
import { ChevronIcon } from '../../components/TabIcons';
import type { Festival } from '../../data/models';
import { useFestivalWeek } from '../../features/festivalWeek/useFestivalWeek';
import type { Door, DoorAction } from '../../features/festivalWeek/week';
import { haptic } from '../../lib/haptics';
import { useCatalog } from '../../state/catalog';
import { openDoor } from '../../state/festivalWeek';
import { useWeekends } from '../../state/weekends';
import { color, motion, radius, space, type, glowA } from '../../theme/tokens';
import { goBack } from '../../lib/nav';
import { t } from '../../i18n';

const GOLD = '#FFD58A';

/**
 * Festival week: seven doors, one a day, in the week before a festival you're
 * going to. A door opens on its day; opening it flips it over to show one
 * small thing that gets you ready, with a button that takes you there.
 */
export default function FestivalWeekScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const whole = useCatalog().festival(id);
  const { forYou } = useWeekends();
  const festival = useMemo(() => (whole ? forYou(whole) : undefined), [whole, forYou]);
  if (!festival) return <Missing title={t('Festival not found')} line={t('This festival isn’t on Afterglow any more, or the link isn’t quite right.')} />;
  return <Week festival={festival} />;
}

function Week({ festival }: { festival: Festival }) {
  const insets = useSafeAreaInsets();
  const week = useFestivalWeek(festival);
  const [chosen, setChosen] = useState<number>();
  const [burst, setBurst] = useState(0);
  const shown = week?.doors.find((d) => d.day === chosen) ?? week?.doors.filter((d) => d.opened).sort((a, b) => a.day - b.day)[0];

  const open = (d: Door & { unlocked: boolean; opened: boolean }) => {
    if (!d.unlocked) {
      haptic.select();
      return;
    }
    if (!d.opened) {
      haptic.celebrate();
      openDoor(festival.id, d.day);
      setBurst((b) => b + 1);
    } else haptic.select();
    setChosen(d.day);
  };

  return (
    <View style={styles.root}>
      <PageTitle title={`Festival week · ${festival.name}`} />
      <NightSky />
      <ScrollView contentContainerStyle={{ paddingTop: insets.top + 64, paddingBottom: insets.bottom + space.xxxl, paddingHorizontal: space.xl, gap: space.lg }}>
        <View style={{ gap: 4 }}>
          <Text style={styles.kicker}>FESTIVAL WEEK</Text>
          <Text style={styles.title} accessibilityRole="header">
            {festival.name}
          </Text>
          {week ? (
            <Text style={styles.sub}>{week.until <= 0 ? 'It’s today' : week.until === 1 ? 'Tomorrow' : `${week.until} days to go`} · one door a day</Text>
          ) : (
            <Text style={styles.sub}>The doors open in the week before a festival you’re going to.</Text>
          )}
        </View>
        {week ? (
          <>
            <View style={styles.grid}>
              {week.doors.map((d) => (
                <DoorTile key={d.day} door={d} until={week.until} chosen={shown?.day === d.day} onPress={() => open(d)} />
              ))}
            </View>
            {shown ? <DoorCard door={shown} festival={festival} burst={burst} /> : <Text style={styles.hint}>{week.line}</Text>}
          </>
        ) : null}
      </ScrollView>
      <View style={[styles.back, { top: insets.top + space.sm }]}>
        <GlassCircleButton label="Back" onPress={() => (router.canGoBack() ? goBack() : router.replace({ pathname: '/festival/[id]', params: { id: festival.id } }))}>
          <ChevronIcon color={color.moon} direction="left" size={18} />
        </GlassCircleButton>
      </View>
    </View>
  );
}

function DoorTile({ door, until, chosen, onPress }: { door: Door & { unlocked: boolean; opened: boolean }; until: number; chosen: boolean; onPress: () => void }) {
  const reduced = useReducedMotion();
  const flip = useSharedValue(1);
  const ready = door.unlocked && !door.opened;
  const style = useAnimatedStyle(() => ({ transform: [{ scaleX: flip.get() }] }));
  const press = () => {
    if (ready && !reduced) flip.set(withSequence(withTiming(0, { duration: 160 }), withSpring(1, motion.bloom)));
    onPress();
  };
  const label = door.opened
    ? `Door ${door.day}, open: ${door.title}`
    : door.unlocked
      ? `Door ${door.day}, ready. Tap to open it`
      : `Door ${door.day}, opens ${until - door.day === 1 ? 'tomorrow' : `in ${until - door.day} days`}`;
  return (
    <Pressable onPress={press} accessibilityRole="button" accessibilityLabel={label} accessibilityState={{ selected: chosen, disabled: !door.unlocked }} style={styles.tileWrap}>
      <Animated.View style={[styles.tile, ready && styles.tileReady, door.opened && styles.tileOpen, chosen && styles.tileChosen, !door.unlocked && styles.tileLocked, style]}>
        {door.opened ? (
          <>
            <Text style={styles.emoji}>{door.emoji}</Text>
            <Text style={styles.tileTitle} numberOfLines={2}>
              {door.title}
            </Text>
          </>
        ) : (
          <>
            <Text style={[styles.number, ready && { color: GOLD }]}>{door.day}</Text>
            <Text style={[styles.tileHint, ready && { color: GOLD }]}>{ready ? 'Open' : door.day === 1 ? 'Day before' : `${door.day} days out`}</Text>
          </>
        )}
      </Animated.View>
    </Pressable>
  );
}

function DoorCard({ door, festival, burst }: { door: Door; festival: Festival; burst: number }) {
  return (
    <View style={styles.card} accessible accessibilityLabel={`Door ${door.day}. ${door.title}. ${door.line}`}>
      {burst ? <ConfettiBurst key={burst} /> : null}
      <Text style={styles.cardKicker}>{door.day === 1 ? 'DOOR 1 · THE DAY BEFORE' : `DOOR ${door.day} · ${door.day} DAYS OUT`}</Text>
      <Text style={styles.cardTitle}>
        {door.emoji}  {door.title}
      </Text>
      <Text style={styles.cardLine}>{door.line}</Text>
      {door.action ? (
        <Pressable onPress={() => act(door.action!, festival)} accessibilityRole="button" accessibilityLabel={door.action.label} style={({ pressed }) => [styles.action, pressed && { opacity: 0.85 }]}>
          <Text style={styles.actionText}>{door.action.label}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

function act(a: DoorAction, festival: Festival) {
  haptic.select();
  switch (a.kind) {
    case 'festival':
      router.push({ pathname: '/festival/[id]', params: { id: festival.id } });
      return;
    case 'tune':
      router.push({ pathname: '/tune/[id]', params: { id: festival.id } });
      return;
    case 'warmup':
      void Linking.openURL(a.url).catch(() => {});
      return;
    case 'discover':
      router.navigate({ pathname: '/', params: { festival: festival.id } });
      return;
    case 'chat':
      router.push({ pathname: '/crew-chat/[id]', params: { id: a.crewId } });
      return;
    case 'crew':
      router.push({ pathname: '/crew/[id]', params: { id: a.crewId } });
      return;
    case 'start-crew':
      router.push('/start-crew');
      return;
    case 'prep':
      router.push({ pathname: '/prep/[id]', params: { id: festival.id } });
      return;
    case 'map':
      router.push({ pathname: '/festival-map', params: { focus: festival.id } });
      return;
  }
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: color.night },
  back: { position: 'absolute', left: space.lg },
  kicker: { ...type.caption, color: GOLD, letterSpacing: 2, fontWeight: '700' },
  title: { ...type.largeTitle, color: color.moon },
  sub: { ...type.body, color: color.moonDim },
  hint: { ...type.body, color: color.moonDim, textAlign: 'center' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: space.sm },
  tileWrap: { width: '23%', aspectRatio: 0.78 },
  tile: {
    flex: 1,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    padding: space.xs,
    gap: 2,
    backgroundColor: color.glass,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: color.hairline,
  },
  tileReady: { borderWidth: 1.5, borderColor: GOLD, backgroundColor: 'rgba(255,213,138,0.10)', shadowColor: GOLD, shadowOpacity: 0.5, shadowRadius: 12, shadowOffset: { width: 0, height: 0 } },
  tileOpen: { backgroundColor: glowA(0.14), borderColor: glowA(0.45) },
  tileChosen: { borderWidth: 1.5, borderColor: color.glow },
  tileLocked: { opacity: 0.45 },
  number: { ...type.largeTitle, color: color.moon, fontVariant: ['tabular-nums'] },
  tileHint: { ...type.caption, fontSize: 10, color: color.moonFaint, textAlign: 'center' },
  emoji: { fontSize: 22, color: color.moon },
  tileTitle: { ...type.caption, fontSize: 10, color: color.moon, textAlign: 'center' },
  card: { padding: space.lg, borderRadius: radius.lg, backgroundColor: 'rgba(255,255,255,0.07)', borderWidth: StyleSheet.hairlineWidth, borderColor: color.hairline, gap: space.sm, overflow: 'visible' },
  cardKicker: { ...type.caption, color: GOLD, letterSpacing: 1.5, fontWeight: '700' },
  cardTitle: { ...type.title, color: color.moon },
  cardLine: { ...type.body, color: color.moonDim },
  action: { alignSelf: 'flex-start', marginTop: space.xs, paddingHorizontal: space.lg, paddingVertical: space.sm + 2, borderRadius: radius.pill, backgroundColor: color.glowDeep },
  actionText: { ...type.headline, color: color.moon },
});
