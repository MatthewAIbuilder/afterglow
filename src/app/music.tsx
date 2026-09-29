import { router } from 'expo-router';
import { useMemo } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { GlassCircleButton } from '../components/GlassCircleButton';
import { NightSky } from '../components/NightSky';
import { ChevronIcon } from '../components/TabIcons';
import { connectionView, type ConnectionView } from '../features/music/copy';
import { MUSIC_PROVIDERS, PROVIDER_NAME, type MusicProviderId } from '../features/music/models';
import { haptic } from '../lib/haptics';
import { useNow } from '../lib/useNow';
import { useMusic } from '../state/music';
import { color, radius, space, type } from '../theme/tokens';

/**
 * Music connections: connect Spotify or Apple Music so Afterglow starts from
 * the artists you already play. Says plainly what's read, that it stays on
 * the phone, and how to remove it.
 */
export default function MusicScreen() {
  const insets = useSafeAreaInsets();
  const music = useMusic();
  const now = useNow();
  // Of each service's artists, how many are on Afterglow's lineups.
  const onLineups = useMemo(() => {
    const n: Partial<Record<MusicProviderId, number>> = {};
    for (const ps of Object.values(music.imported.from)) for (const p of ps) n[p] = (n[p] ?? 0) + 1;
    return n;
  }, [music.imported.from]);

  return (
    <View style={styles.root}>
      <NightSky />
      <ScrollView
        contentContainerStyle={{ paddingTop: insets.top + 64, paddingBottom: insets.bottom + space.xxxl }}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.pad}>
          <Text style={styles.title}>Music connections</Text>
          <Text style={styles.meta}>Connect your music library to help Afterglow understand your taste.</Text>
        </View>

        <View style={[styles.pad, styles.list]}>
          {MUSIC_PROVIDERS.map((p) => (
            <ServiceCard
              key={p}
              provider={p}
              view={connectionView(p, music.state[p], music.availability[p], now, onLineups[p] ?? 0)}
            />
          ))}
        </View>

        <View style={[styles.pad, styles.about]}>
          <Text style={styles.aboutTitle}>What Afterglow uses</Text>
          <Text style={styles.aboutBody}>
            Afterglow uses your music library to understand which artists and sounds you already love. You can
            disconnect at any time.
          </Text>
          <Text style={styles.aboutBody}>
            It reads the artists you follow, the songs you’ve saved and the artists you play most, and keeps only
            each artist’s name, how much you play them and their genres. Never your playlists, your account details
            or your password.
          </Text>
          <Text style={styles.aboutBody}>
            It stays on this phone, private to you. What you like, save and skip here still counts for more than
            your library.
          </Text>
        </View>
      </ScrollView>

      <View style={[styles.back, { top: insets.top + space.sm }]}>
        <GlassCircleButton label="Back" onPress={() => router.back()}>
          <ChevronIcon color={color.moon} direction="left" size={18} />
        </GlassCircleButton>
      </View>
    </View>
  );
}

function ServiceCard({ provider, view }: { provider: MusicProviderId; view: ConnectionView }) {
  const music = useMusic();
  const name = PROVIDER_NAME[provider];
  const act = async (action: 'connect' | 'sync') => {
    haptic.tap();
    if (action === 'sync') return music.sync(provider);
    const problem = await music.connect(provider);
    if (!problem) haptic.settle();
  };
  const disconnect = () => {
    haptic.select();
    Alert.alert(
      `Disconnect ${name}?`,
      `This removes everything Afterglow imported from ${name} and forgets the sign-in on this phone. Your likes, saves and ratings stay.`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Disconnect & remove', style: 'destructive', onPress: () => void music.disconnect(provider) },
      ],
    );
  };

  return (
    <View style={[styles.card, view.tone === 'good' && styles.cardOn]} accessibilityLabel={`${name}. ${view.line}`}>
      <View style={styles.cardHead}>
        <Text style={styles.cardTitle}>{name}</Text>
        {view.busy ? <ActivityIndicator color={color.glow} size="small" accessibilityLabel="Syncing" /> : null}
      </View>
      <Text style={[styles.cardLine, view.tone === 'warn' && styles.warn]} accessibilityLiveRegion="polite">
        {view.line}
      </Text>
      {view.primary || view.canDisconnect ? (
        <View style={styles.cardActions}>
          {view.primary ? (
            <Pressable
              onPress={() => void act(view.primary!.action)}
              disabled={view.busy}
              accessibilityRole="button"
              accessibilityLabel={`${view.primary.label}, ${name}`}
              style={({ pressed }) => [styles.primary, pressed && styles.pressed]}
            >
              <Text style={styles.primaryText}>{view.primary.label}</Text>
            </Pressable>
          ) : null}
          {view.canDisconnect ? (
            <Pressable
              onPress={disconnect}
              accessibilityRole="button"
              accessibilityLabel={`Disconnect ${name} and remove imported music data`}
              hitSlop={8}
              style={({ pressed }) => [styles.secondary, pressed && styles.pressed]}
            >
              <Text style={styles.secondaryText}>Disconnect & remove imported music data</Text>
            </Pressable>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: color.night },
  pad: { paddingHorizontal: space.xl },
  back: { position: 'absolute', left: space.lg },
  title: { ...type.largeTitle, color: color.moon },
  meta: { ...type.body, color: color.moonDim, marginTop: space.xs },
  list: { marginTop: space.xl, gap: space.md },
  card: {
    padding: space.lg,
    gap: space.sm,
    borderRadius: radius.lg,
    backgroundColor: color.glass,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: color.hairline,
  },
  cardOn: { borderColor: 'rgba(169,124,255,0.4)' },
  cardHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  cardTitle: { ...type.headline, color: color.moon },
  cardLine: { ...type.body, color: color.moonDim, fontVariant: ['tabular-nums'] },
  warn: { color: color.moon },
  cardActions: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: space.md, marginTop: space.xs },
  primary: {
    paddingHorizontal: space.lg,
    paddingVertical: space.sm,
    borderRadius: radius.pill,
    backgroundColor: 'rgba(169,124,255,0.18)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(169,124,255,0.4)',
  },
  primaryText: { ...type.label, color: color.moon },
  secondary: { paddingVertical: space.sm },
  secondaryText: { ...type.caption, color: color.moonDim },
  pressed: { opacity: 0.75, transform: [{ scale: 0.98 }] },
  about: { marginTop: space.xxl, gap: space.sm },
  aboutTitle: { ...type.headline, color: color.moon },
  aboutBody: { ...type.body, color: color.moonDim },
});
