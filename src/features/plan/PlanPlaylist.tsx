import { useState } from 'react';
import { Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import type { Festival } from '../../data/types';
import { showAlert } from '../../lib/dialog';
import { haptic } from '../../lib/haptics';
import { useMusic } from '../../state/music';
import { color, glowA, radius, space, type } from '../../theme/tokens';
import { MUSIC_PROVIDERS, PROVIDER_NAME, type MusicProviderId } from '../music/models';
import { planPlaylist } from '../music/playlist';
import { errorKind } from '../music/service';
import type { Pick } from './plan';
import { t, tn } from '../../i18n';

/**
 * Plan to playlist: your plan for a festival as a private playlist in a
 * music service you've connected (Apple Music on iPhone, Spotify in the
 * full app), each act's most popular songs, to warm up on the way. Nothing
 * when no service is connected.
 */
export function PlanPlaylist({ festival, picks }: { festival: Festival; picks: Pick[] }) {
  const music = useMusic();
  const [busy, setBusy] = useState<MusicProviderId | undefined>();
  const ready = MUSIC_PROVIDERS.filter((p) => music.state[p]?.connected && music.availability[p].ok);
  const names = picks.filter((p) => p.tier !== 'explore' || p.pinned).map((p) => p.artist.name);
  if (!ready.length || !names.length) return null;

  const make = async (provider: MusicProviderId) => {
    if (busy) return;
    haptic.tap();
    setBusy(provider);
    try {
      const r = await music.makePlaylist(provider, planPlaylist(festival.name, names));
      haptic.settle();
      if (!r.added) {
        showAlert(t('Couldn’t find their songs'), t('{service} didn’t have songs for these artists.', { service: PROVIDER_NAME[provider] }));
        return;
      }
      const body = r.missing.length
        ? tn(r.missing.length, '{n} artist wasn’t on {service}.', '{n} artists weren’t on {service}.', { service: PROVIDER_NAME[provider] })
        : t('It’s in your {service} library.', { service: PROVIDER_NAME[provider] });
      showAlert(tn(r.added, 'Added {n} song', 'Added {n} songs'), body, [
        { text: t('OK') },
        ...(r.url ? [{ text: t('Open {service}', { service: PROVIDER_NAME[provider] }), onPress: () => void Linking.openURL(r.url!).catch(() => {}) }] : []),
      ]);
    } catch (e) {
      const kind = errorKind(e);
      showAlert(
        t('Couldn’t make the playlist'),
        kind === 'denied' || kind === 'expired'
          ? t('Connect {service} again in Music connections to let Afterglow make playlists.', { service: PROVIDER_NAME[provider] })
          : kind === 'network'
            ? t('Check your signal and try again.')
            : t('{service} didn’t answer. Try again in a moment.', { service: PROVIDER_NAME[provider] }),
      );
    } finally {
      setBusy(undefined);
    }
  };

  return (
    <View style={styles.row}>
      {ready.map((p) => (
        <Pressable
          key={p}
          onPress={() => void make(p)}
          disabled={!!busy}
          accessibilityRole="button"
          accessibilityLabel={t('Make your plan a playlist in {service}', { service: PROVIDER_NAME[p] })}
          style={({ pressed }) => [styles.pill, (pressed || busy === p) && { opacity: 0.7 }]}
        >
          <Text style={styles.text}>{busy === p ? t('Making it…') : t('Plan → {service} playlist', { service: PROVIDER_NAME[p] })}</Text>
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm, marginTop: space.sm },
  pill: { paddingHorizontal: space.md, paddingVertical: space.sm, borderRadius: radius.pill, backgroundColor: glowA(0.14), borderWidth: StyleSheet.hairlineWidth, borderColor: glowA(0.4) },
  text: { ...type.label, color: color.moon },
});
