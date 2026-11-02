import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { GlassCircleButton } from '../components/GlassCircleButton';
import { NightSky } from '../components/NightSky';
import { ChevronIcon } from '../components/TabIcons';
import { connectionView, connectProblem, type ConnectionView } from '../features/music/copy';
import { MUSIC_PROVIDERS, PROVIDER_NAME, type MusicProviderId } from '../features/music/models';
import { matchedBy, onUpcomingFestivals } from '../features/music/reach';
import { haptic } from '../lib/haptics';
import { useNow } from '../lib/useNow';
import { useCatalog } from '../state/catalog';
import { useMusic } from '../state/music';
import { color, radius, space, type, glowA, pageColumn } from '../theme/tokens';
import { showAlert } from '../lib/dialog';
import { goBack } from '../lib/nav';
import { t } from '../i18n';
import { PageFeedback } from '../components/PageFeedback';

/**
 * Music connections: connect Apple Music (signing in) or add Spotify
 * playlists (pasting their links) so Afterglow starts from the artists you
 * already play. Each service is one card that
 * says exactly where it stands, what came in, and how to remove it; below,
 * plainly, what's read and what stays private.
 */
export default function MusicScreen() {
  const insets = useSafeAreaInsets();
  const music = useMusic();
  const { festivals } = useCatalog();
  const now = useNow();

  // Per service: how many of its artists Afterglow has, and how many of those play an upcoming festival.
  const reach = useMemo(() => {
    const out: Partial<Record<MusicProviderId, { matched: number; upcoming: number }>> = {};
    for (const p of MUSIC_PROVIDERS) {
      const ids = matchedBy(music.imported.from, p);
      out[p] = { matched: ids.length, upcoming: onUpcomingFestivals(ids, festivals, now) };
    }
    return out;
  }, [music.imported.from, festivals, now]);

  return (
    <View style={styles.root}>
      <NightSky />
      <ScrollView
        contentContainerStyle={[pageColumn, { paddingTop: insets.top + 64, paddingBottom: insets.bottom + space.xxxl }]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.pad}>
          <Text style={styles.title} accessibilityRole="header">
            {t('Music connections')}
          </Text>
          <Text style={styles.meta}>{t('Start your map from the artists you already play. What you do in Afterglow still counts for more.')}</Text>
        </View>

        <View style={[styles.pad, styles.list]}>
          {MUSIC_PROVIDERS.map((p) => (
            <ServiceCard
              key={p}
              provider={p}
              view={connectionView(p, music.state[p], music.availability[p], now, {
                connecting: music.connecting.includes(p),
                ...reach[p],
              })}
            />
          ))}
        </View>

        <View style={[styles.pad, styles.about]}>
          <Text style={styles.aboutTitle}>{t('What Afterglow reads')}</Text>
          <Text style={styles.aboutBody}>
            {t(
              'The artists you follow, the songs you’ve saved and the artists you play most (from Spotify, the songs on the playlists you add). From those it keeps only each artist’s name, how much you play them and their genres.',
            )}
          </Text>
          <Text style={styles.aboutTitle}>{t('What it never keeps')}</Text>
          <Text style={styles.aboutBody}>
            {t(
              'Your password, your account details or the songs themselves. A sign-in or a playlist link is kept in this phone’s secure storage and used only to read your music.',
            )}
          </Text>
          <Text style={styles.aboutTitle}>{t('Private to you')}</Text>
          <Text style={styles.aboutBody}>
            {t('Your library stays on this phone and is never shown to anyone. Disconnecting removes everything imported and forgets the sign-in.')}
          </Text>
        </View>
        <PageFeedback />
      </ScrollView>

      <View style={[styles.back, { top: insets.top + space.sm }]}>
        <GlassCircleButton label={t('Back')} onPress={() => goBack()}>
          <ChevronIcon color={color.moon} direction="left" size={18} />
        </GlassCircleButton>
      </View>
    </View>
  );
}

function ServiceCard({ provider, view }: { provider: MusicProviderId; view: ConnectionView }) {
  const music = useMusic();
  const name = PROVIDER_NAME[provider];
  // A sign-in that didn't finish leaves no state behind, so its reason is said here, once.
  const [problem, setProblem] = useState<string | undefined>();

  // Spotify is added by pasting playlist links.
  const byLink = provider === 'spotify';
  const [link, setLink] = useState('');
  const [adding, setAdding] = useState(false);
  const [added, setAdded] = useState<{ name?: string; kind: string }[]>([]);
  const synced = view.status === 'synced';
  useEffect(() => {
    if (!byLink) return;
    let live = true;
    void music.links(provider).then((l) => live && setAdded(l));
    return () => {
      live = false;
    };
  }, [byLink, music, provider, synced]);

  const act = async (action: 'connect' | 'sync') => {
    haptic.tap();
    setProblem(undefined);
    if (action === 'sync') return music.sync(provider);
    const reason = await music.connect(provider, byLink ? link : undefined);
    const text = connectProblem(provider, reason);
    setProblem(text);
    if (!reason) {
      haptic.settle();
      setLink('');
      setAdding(false);
    } else if (text) haptic.soft();
  };
  const showForm = byLink && view.primary?.action === 'connect' ? true : byLink && synced && adding;

  const disconnect = () => {
    haptic.select();
    showAlert(
      t('Disconnect {service}?', { service: name }),
      byLink
        ? t('Everything Afterglow imported from your Spotify playlists is removed from this phone and the links are forgotten. Your likes, saves and ratings stay.')
        : t('Everything Afterglow imported from {service} is removed from this phone and the sign-in is forgotten. Your likes, saves and ratings stay.', { service: name }),
      [
        { text: t('Cancel'), style: 'cancel' },
        {
          text: t('Disconnect & remove'),
          style: 'destructive',
          onPress: () => {
            setProblem(undefined);
            void music.disconnect(provider).then(() => haptic.settle());
          },
        },
      ],
    );
  };

  const spoken = [name, view.label, view.headline, view.detail, ...view.stats.map((s) => `${s.label} ${s.value}`)].filter(Boolean).join('. ');

  return (
    <View style={[styles.card, view.tone === 'good' && styles.cardOn, view.tone === 'warn' && styles.cardWarn]}>
      <View accessible accessibilityLabel={spoken}>
        <View style={styles.cardHead}>
          <Text style={styles.kicker}>{name}</Text>
          <StatusPill view={view} />
        </View>
        <Text style={styles.headline} accessibilityLiveRegion="polite">
          {view.headline}
        </Text>
        {view.detail ? <Text style={styles.detail}>{view.detail}</Text> : null}

        {view.stats.length ? (
          <View style={styles.stats}>
            {view.stats.map((s, i) => (
              <View key={s.label} style={[styles.stat, i > 0 && styles.statDivided]}>
                <Text style={styles.statValue} numberOfLines={1} adjustsFontSizeToFit>
                  {s.value}
                </Text>
                <Text style={styles.statLabel}>{s.label}</Text>
              </View>
            ))}
          </View>
        ) : null}

        {view.notes.map((n) => (
          <Text key={n} style={styles.note}>
            {n}
          </Text>
        ))}
      </View>

      {problem ? (
        <Text style={styles.problem} accessibilityLiveRegion="assertive">
          {problem}
        </Text>
      ) : null}

      {byLink && added.length && (synced || view.status === 'failed') ? (
        <Text style={styles.note}>{added.map((l) => l.name ?? t('A Spotify playlist')).join(' · ')}</Text>
      ) : null}

      {showForm ? (
        <View style={styles.linkForm}>
          <TextInput
            value={link}
            onChangeText={setLink}
            placeholder={t('Paste a Spotify playlist link')}
            placeholderTextColor={color.moonFaint}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="url"
            returnKeyType="done"
            onSubmitEditing={() => link.trim() && void act('connect')}
            accessibilityLabel={t('Spotify playlist link')}
            style={styles.linkInput}
          />
          <Text style={styles.note}>{t('In Spotify, open a playlist (your Top Songs from Wrapped work well), tap Share, then Copy link. It must be public.')}</Text>
          <Pressable
            onPress={() => void act('connect')}
            disabled={view.busy || !music.hydrated || !link.trim()}
            accessibilityRole="button"
            accessibilityLabel={t('Add this Spotify playlist')}
            accessibilityState={{ disabled: view.busy || !music.hydrated || !link.trim() }}
            style={({ pressed }) => [styles.primary, !link.trim() && { opacity: 0.5 }, pressed && styles.pressed]}
          >
            <Text style={styles.primaryText}>{t('Add playlist')}</Text>
          </Pressable>
        </View>
      ) : null}

      {byLink && synced && !adding ? (
        <Pressable onPress={() => setAdding(true)} accessibilityRole="button" hitSlop={8} style={({ pressed }) => [styles.secondary, pressed && styles.pressed]}>
          <Text style={styles.secondaryText}>{t('Add another playlist')}</Text>
        </Pressable>
      ) : null}

      {view.primary && !(showForm && view.primary.action === 'connect') ? (
        <Pressable
          onPress={() => void act(view.primary!.action)}
          disabled={view.busy || !music.hydrated}
          accessibilityRole="button"
          accessibilityLabel={view.primary.label.includes(name) ? view.primary.label : t('{action}, {service}', { action: view.primary.label, service: name })}
          accessibilityState={{ disabled: view.busy || !music.hydrated }}
          style={({ pressed }) => [styles.primary, pressed && styles.pressed]}
        >
          <Text style={styles.primaryText}>{view.primary.label}</Text>
        </Pressable>
      ) : null}

      {view.canDisconnect ? (
        <Pressable
          onPress={disconnect}
          accessibilityRole="button"
          accessibilityLabel={t('Disconnect {service} and remove imported music data', { service: name })}
          hitSlop={8}
          style={({ pressed }) => [styles.secondary, pressed && styles.pressed]}
        >
          <Text style={styles.secondaryText}>{t('Disconnect & remove imported music data')}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

/** "Synced", "Sync failed": a small capsule with a light, or a spinner while something is happening. */
function StatusPill({ view }: { view: ConnectionView }) {
  return (
    <View style={[styles.pill, view.tone === 'good' && styles.pillOn, view.tone === 'warn' && styles.pillWarn]}>
      {view.busy ? (
        <ActivityIndicator color={color.glow} size="small" style={styles.spinner} />
      ) : (
        <View style={[styles.dot, view.tone === 'good' && styles.dotOn, view.tone === 'warn' && styles.dotWarn]} />
      )}
      <Text style={styles.pillText}>{view.label}</Text>
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
    gap: space.md,
    borderRadius: radius.lg,
    backgroundColor: color.glass,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: color.hairline,
    borderTopColor: color.rim,
  },
  cardOn: { borderColor: glowA(0.4) },
  cardWarn: { borderColor: 'rgba(255,122,198,0.35)' },
  cardHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  kicker: { ...type.caption, color: color.moonFaint, textTransform: 'uppercase', letterSpacing: 1.2 },
  headline: { ...type.title, color: color.moon, marginTop: space.sm },
  detail: { ...type.body, color: color.moonDim, marginTop: space.xs },
  stats: {
    flexDirection: 'row',
    marginTop: space.lg,
    paddingVertical: space.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: color.hairline,
  },
  stat: { flex: 1, paddingHorizontal: space.sm, gap: 2 },
  statDivided: { borderLeftWidth: StyleSheet.hairlineWidth, borderLeftColor: color.hairline },
  statValue: { ...type.headline, color: color.moon, fontVariant: ['tabular-nums'] },
  statLabel: { ...type.caption, color: color.moonDim },
  note: { ...type.caption, color: color.moonDim, marginTop: space.md },
  problem: { ...type.label, color: color.moon },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: space.sm + 2,
    paddingVertical: 5,
    borderRadius: radius.pill,
    backgroundColor: color.glass,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: color.hairline,
    borderTopColor: color.rim,
  },
  pillOn: { backgroundColor: glowA(0.14), borderColor: glowA(0.4) },
  pillWarn: { backgroundColor: 'rgba(255,122,198,0.1)', borderColor: 'rgba(255,122,198,0.35)' },
  pillText: { ...type.caption, color: color.moon },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: color.moonFaint },
  dotOn: { backgroundColor: color.glow, shadowColor: color.glow, shadowOpacity: 0.9, shadowRadius: 4, shadowOffset: { width: 0, height: 0 } },
  dotWarn: { backgroundColor: color.stage },
  spinner: { transform: [{ scale: 0.6 }], width: 10, height: 10 },
  primary: {
    alignSelf: 'flex-start',
    paddingHorizontal: space.lg,
    paddingVertical: space.sm + 2,
    borderRadius: radius.pill,
    backgroundColor: glowA(0.18),
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: glowA(0.4),
  },
  primaryText: { ...type.label, color: color.moon },
  secondary: { alignSelf: 'flex-start', paddingVertical: space.xs },
  linkForm: { gap: space.sm },
  linkInput: {
    ...type.body,
    color: color.moon,
    paddingHorizontal: space.md,
    paddingVertical: space.sm + 2,
    borderRadius: radius.md,
    backgroundColor: color.glass,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: color.hairline,
  },
  secondaryText: { ...type.caption, color: color.moonDim },
  pressed: { opacity: 0.75, transform: [{ scale: 0.98 }] },
  about: { marginTop: space.xxl, gap: space.sm },
  aboutTitle: { ...type.headline, color: color.moon, marginTop: space.sm },
  aboutBody: { ...type.body, color: color.moonDim },
});
