import { router, useLocalSearchParams } from 'expo-router';
import { useMemo, useRef, useState } from 'react';
import { Platform, Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { GlassCircleButton } from '../../components/GlassCircleButton';
import { CloseIcon } from '../../components/TabIcons';
import { useFestivalPlan } from '../../features/plan/useFestivalPlan';
import { CARD_MAX_WIDTH, PosterCard, sharePoster } from '../../features/plan/PosterCard';
import { LineupPosterCard } from '../../features/plan/LineupPosterCard';
import { lineupPoster, lineupPosterText } from '../../features/plan/lineupPoster';
import { mustSeeCard, mustSeeText } from '../../features/plan/mustSeeCard';
import { MustSeeCardView } from '../../features/plan/MustSeeCardView';
import { usePickReasons } from '../../features/plan/usePickReasons';
import { APP_NAME, WEB_URL } from '../../config/app';
import type { Festival } from '../../data/types';
import { haptic } from '../../lib/haptics';
import { useCatalog } from '../../state/catalog';
import { useWeekends } from '../../state/weekends';
import { color, radius, space, type } from '../../theme/tokens';
import { shareMessage } from '../../lib/share';
import { goBack } from '../../lib/nav';
import { shareParams } from '../../features/messages/shares';
import { useSocial } from '../../state/social';

/**
 * Share your plan: your must-sees (your top picks and why), a poster-like
 * card of it (the route once set times are out, your picks before), or your
 * lineup as a festival poster, as an image or as plain text. A modal over the
 * festival page. Opens on your day once set times are out, else your must-sees.
 */
export default function PlanCardScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const catalog = useCatalog();
  const { forYou } = useWeekends();
  const whole = catalog.festival(id);
  if (!whole) return null;
  return <PlanCardView festival={forYou(whole)} />;
}

function PlanCardView({ festival }: { festival: Festival }) {
  const { card, text: planText, picks, route } = useFestivalPlan(festival);
  const social = useSocial();
  // Your must-sees, your plan as a list, or your lineup as a festival poster.
  const poster = useMemo(() => lineupPoster(festival, picks), [festival, picks]);
  const reason = usePickReasons();
  const mustSees = useMemo(() => mustSeeCard(festival, picks, reason), [festival, picks, reason]);
  const hasDay = !!route?.some((d) => d.stops.length);
  const modes = [...(mustSees ? (['mustsee'] as const) : []), ...(card ? (['plan'] as const) : []), ...(poster ? (['poster'] as const) : [])];
  const [chosen, setMode] = useState<Mode | undefined>();
  const mode: Mode = chosen ?? (hasDay || !mustSees ? 'plan' : 'mustsee');
  const showPoster = mode === 'poster' && !!poster;
  const showMustSees = mode === 'mustsee' && !!mustSees;
  const text = showPoster ? lineupPosterText(poster) : showMustSees ? mustSeeText(mustSees, APP_NAME, WEB_URL) : planText;
  const what = showPoster ? 'lineup poster' : showMustSees ? 'must-sees' : 'plan';
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const cardRef = useRef<View>(null);
  const [busy, setBusy] = useState(false);

  const shareImage = async () => {
    if (busy) return;
    haptic.tap();
    setBusy(true);
    await sharePoster(cardRef, showPoster ? `My ${festival.name} lineup` : showMustSees ? `My must-sees at ${festival.name}` : `My ${festival.name}`);
    setBusy(false);
  };

  return (
    <View style={styles.root}>
      <View style={[styles.top, { paddingTop: insets.top + space.sm }]}>
        <Text style={styles.heading}>Share your plan</Text>
        <GlassCircleButton label="Close" onPress={() => goBack()}>
          <CloseIcon color={color.moon} />
        </GlassCircleButton>
      </View>
      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + space.xxl }]}>
        {modes.length > 1 ? (
          <View style={styles.modes} accessibilityRole="tablist">
            {modes.map((m) => (
              <Pressable
                key={m}
                onPress={() => {
                  haptic.select();
                  setMode(m);
                }}
                accessibilityRole="tab"
                accessibilityState={{ selected: mode === m }}
                style={[styles.mode, mode === m && styles.modeOn]}
              >
                <Text style={[styles.modeText, mode === m && { color: color.moon }]}>{MODE_LABEL[m]}</Text>
              </Pressable>
            ))}
          </View>
        ) : null}
        {showPoster ? (
          <View ref={cardRef} collapsable={false} style={{ width: Math.min(width - space.xl * 2, CARD_MAX_WIDTH) }}>
            <LineupPosterCard poster={poster} />
          </View>
        ) : showMustSees ? (
          <View ref={cardRef} collapsable={false} style={{ width: Math.min(width - space.xl * 2, CARD_MAX_WIDTH) }}>
            <MustSeeCardView card={mustSees} />
          </View>
        ) : card ? (
          <View ref={cardRef} collapsable={false} style={{ width: Math.min(width - space.xl * 2, CARD_MAX_WIDTH) }}>
            <PosterCard card={card} />
          </View>
        ) : (
          <Text style={styles.empty}>Like a few clips or rate some artists and your plan will be ready to share.</Text>
        )}
        {/* A picture needs the phone (the card is captured natively); the website shares the text. */}
        {(card || showPoster || showMustSees) && Platform.OS !== 'web' ? (
          <Pressable
            onPress={shareImage}
            disabled={busy}
            accessibilityRole="button"
            accessibilityLabel={`Share your ${what} as an image`}
            style={({ pressed }) => [styles.button, styles.primary, (pressed || busy) && styles.pressed]}
          >
            <Text style={styles.buttonText}>{busy ? 'Getting it ready…' : 'Share image'}</Text>
          </Pressable>
        ) : null}
        {showMustSees && mustSees && social.user && social.profile ? (
          <Pressable
            onPress={() => {
              haptic.select();
              router.push({ pathname: '/send', params: shareParams({ kind: 'festival', id: festival.id, picks: mustSees.lines.map((l) => l.artist.id) }) });
            }}
            accessibilityRole="button"
            accessibilityLabel="Send your must-sees to a friend"
            style={({ pressed }) => [styles.button, pressed && styles.pressed]}
          >
            <Text style={styles.buttonText}>Send to a friend</Text>
          </Pressable>
        ) : null}
        {text ? (
          <Pressable
            onPress={() => {
              haptic.select();
              void shareMessage(text);
            }}
            accessibilityRole="button"
            accessibilityLabel={showPoster ? 'Share your lineup as text' : `Share your ${what} as text`}
            style={({ pressed }) => [styles.button, pressed && styles.pressed]}
          >
            <Text style={styles.buttonText}>Share as text</Text>
          </Pressable>
        ) : null}
      </ScrollView>
    </View>
  );
}

type Mode = 'mustsee' | 'plan' | 'poster';
const MODE_LABEL: Record<Mode, string> = { mustsee: 'Must-sees', plan: 'Your plan', poster: 'Lineup poster' };

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: color.night },
  top: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: space.xl, paddingBottom: space.md },
  heading: { ...type.title, color: color.moon },
  modes: { flexDirection: 'row', alignSelf: 'flex-start', padding: 3, borderRadius: radius.pill, backgroundColor: color.glass },
  mode: { paddingHorizontal: space.lg, paddingVertical: 6, borderRadius: radius.pill },
  modeOn: { backgroundColor: 'rgba(169,124,255,0.22)' },
  modeText: { ...type.label, color: color.moonDim },
  content: { paddingHorizontal: space.xl, paddingTop: space.md, gap: space.md },
  empty: { ...type.body, color: color.moonDim },
  button: {
    minHeight: 52,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: color.glass,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: color.hairline,
  },
  primary: { backgroundColor: color.glowDeep, borderColor: color.glowDeep, marginTop: space.md },
  pressed: { opacity: 0.8, transform: [{ scale: 0.98 }] },
  buttonText: { ...type.headline, color: color.moon },
});
