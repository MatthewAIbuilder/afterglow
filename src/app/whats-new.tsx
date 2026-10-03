import { router } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeInDown, useReducedMotion } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { NightSky } from '../components/NightSky';
import { CalendarIcon, MapIcon } from '../components/TabIcons';
import { WHATS_NEW } from '../features/whatsNew/whatsNew';
import { QUEST_GOLD, SparkIcon } from '../features/quests/QuestRing';
import { haptic } from '../lib/haptics';
import { color, radius, space, type, glowA, nightA } from '../theme/tokens';

const ICONS: Record<string, React.ReactNode> = {
  map: <MapIcon color={color.glow} size={22} />,
  quests: <SparkIcon size={22} />,
  secrets: <Text style={{ fontSize: 20, color: color.glow }}>?</Text>,
  calendar: <CalendarIcon color={color.glow} size={20} />,
};

/** What's new in this update, once: each thing with a way to try it. */
export default function WhatsNewScreen() {
  const insets = useSafeAreaInsets();
  const reduced = useReducedMotion();
  const go = (href: string) => {
    haptic.select();
    if (!router.canGoBack()) {
      router.replace(href as never);
      return;
    }
    router.back();
    setTimeout(() => router.push(href as never), 250);
  };
  return (
    <View style={styles.root}>
      <NightSky />
      <ScrollView contentContainerStyle={{ paddingTop: insets.top + space.xxl, paddingBottom: insets.bottom + 120, paddingHorizontal: space.xl }}>
        <Text style={styles.kicker}>New in Afterglow</Text>
        <Text style={styles.title} accessibilityRole="header">
          Fresh tonight
        </Text>
        {WHATS_NEW.items.map((item, i) => (
          <Animated.View key={item.id} entering={reduced ? undefined : FadeInDown.delay(120 + i * 90).duration(320)}>
            <Pressable
              onPress={() => (item.href ? go(item.href) : undefined)}
              disabled={!item.href}
              accessibilityRole={item.href ? 'button' : 'text'}
              accessibilityLabel={`${item.title}. ${item.body}`}
              style={({ pressed }) => [styles.card, pressed && { transform: [{ scale: 0.98 }] }]}
            >
              <View style={[styles.icon, item.id === 'quests' && { backgroundColor: 'rgba(255,211,110,0.14)' }]}>{ICONS[item.id]}</View>
              <View style={{ flex: 1 }}>
                <Text style={styles.cardTitle}>{item.title}</Text>
                <Text style={styles.body}>{item.body}</Text>
                {item.href ? <Text style={[styles.try, item.id === 'quests' && { color: QUEST_GOLD }]}>Try it ›</Text> : null}
              </View>
            </Pressable>
          </Animated.View>
        ))}
      </ScrollView>
      <View style={[styles.bottom, { paddingBottom: insets.bottom + space.lg }]}>
        <Pressable
          onPress={() => {
            haptic.tap();
            if (router.canGoBack()) router.back();
            else router.replace('/');
          }}
          accessibilityRole="button"
          style={({ pressed }) => [styles.done, pressed && { opacity: 0.85 }]}
        >
          <Text style={styles.doneText}>Let’s go</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: color.night },
  kicker: { ...type.caption, color: color.glow, letterSpacing: 1.5, textTransform: 'uppercase' },
  title: { ...type.largeTitle, color: color.moon, marginBottom: space.xl },
  card: {
    flexDirection: 'row',
    gap: space.md,
    padding: space.lg,
    marginBottom: space.md,
    borderRadius: radius.lg,
    backgroundColor: color.glass,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: color.hairline,
  },
  icon: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', backgroundColor: glowA(0.14) },
  cardTitle: { ...type.headline, color: color.moon },
  body: { ...type.body, color: color.moonDim, marginTop: 2 },
  try: { ...type.label, color: color.glow, marginTop: space.sm },
  bottom: { position: 'absolute', left: 0, right: 0, bottom: 0, paddingHorizontal: space.xl, paddingTop: space.md, backgroundColor: nightA(0.9) },
  done: { paddingVertical: space.md, borderRadius: radius.pill, backgroundColor: color.glow, alignItems: 'center' },
  doneText: { ...type.headline, color: color.night },
});
