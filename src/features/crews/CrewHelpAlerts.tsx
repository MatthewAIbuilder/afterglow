import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { PersonAvatar } from '../../components/PersonAvatar';
import { haptic } from '../../lib/haptics';
import { useNow } from '../../lib/useNow';
import { useCrewUpdates } from '../../state/crewUpdates';
import { color, radius, space, type } from '../../theme/tokens';
import { helpTitle } from './care';
import { firstName } from './together';
import { ago, clock, lateLine } from './updates';
import { t } from '../../i18n';

/**
 * Crewmates who asked for help, at the top of wherever the crew shows: who,
 * when they sent it (and when it got through, if the signal held it back),
 * where they last said they were, and two ways to answer: see their update,
 * or "On my way" in one tap. Gone once they say they're OK.
 */
export function CrewHelpAlerts({ festivalId }: { festivalId?: string }) {
  const { careAlerts, stories, profileOf, reply } = useCrewUpdates();
  const now = useNow().getTime();
  const [answered, setAnswered] = useState<string[]>([]);
  const alerts = careAlerts.filter((u) => !festivalId || u.festivalId === festivalId);
  if (!alerts.length) return null;
  return (
    <View style={styles.wrap}>
      {alerts.map((u) => {
        const p = profileOf(u.uid);
        const name = p ? firstName(p.displayName) : t('Someone in your crew');
        const place = stories.find((s) => s.uid === u.uid)?.updates.find((x) => x.stage && !x.care && Date.parse(x.at) <= Date.parse(u.at) + 60_000);
        const late = lateLine(u);
        const on = answered.includes(u.id);
        return (
          <View key={u.id} style={styles.card} accessibilityRole="alert">
            <View style={styles.head}>
              <PersonAvatar name={p?.displayName ?? name} url={p?.avatarUrl} size={40} />
              <View style={{ flex: 1 }}>
                <Text style={styles.title}>{helpTitle(name)}</Text>
                <Text style={styles.when}>
                  {t('Asked for help {time} · {ago}', { time: clock(u.at), ago: ago(u.at, now).toLowerCase() })}
                </Text>
              </View>
            </View>
            {late ? <Text style={styles.late}>{late}</Text> : null}
            <Text style={styles.body}>{place ? t('Last said they were at {stage}, {time}.', { stage: place.stage ?? '', time: clock(place.at) }) : t('They haven’t said where they are. Try calling, or head to your meeting spot.')}</Text>
            <View style={styles.actions}>
              <Pressable
                onPress={() => {
                  haptic.select();
                  router.push(`/crew-story?uid=${encodeURIComponent(u.uid)}`);
                }}
                accessibilityRole="button"
                accessibilityLabel={t('See {name}’s update', { name })}
                style={({ pressed }) => [styles.button, pressed && styles.pressed]}
              >
                <Text style={styles.buttonText}>{t('See their update')}</Text>
              </Pressable>
              <Pressable
                onPress={() => {
                  if (on || !reply(u, 'On my way')) return;
                  haptic.settle();
                  setAnswered((a) => [...a, u.id]);
                }}
                disabled={on}
                accessibilityRole="button"
                accessibilityLabel={on ? t('You told {name} you’re on your way', { name }) : t('Tell {name} you’re on your way', { name })}
                style={({ pressed }) => [styles.button, styles.primary, on && styles.done, pressed && styles.pressed]}
              >
                <Text style={[styles.buttonText, styles.primaryText]}>{on ? t('Told them ✓') : t('On my way')}</Text>
              </Pressable>
            </View>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: space.sm },
  card: { padding: space.lg, gap: space.sm, borderRadius: radius.lg, backgroundColor: 'rgba(255,110,110,0.12)', borderWidth: 1, borderColor: 'rgba(255,140,140,0.5)' },
  head: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  title: { ...type.headline, color: color.moon },
  when: { ...type.caption, color: 'rgba(255,170,170,0.95)', marginTop: 2 },
  late: { ...type.caption, color: '#FFB86B' },
  body: { ...type.body, color: color.moonDim },
  actions: { flexDirection: 'row', gap: space.sm },
  button: { flex: 1, minHeight: 44, alignItems: 'center', justifyContent: 'center', borderRadius: radius.pill, backgroundColor: color.glass, borderWidth: StyleSheet.hairlineWidth, borderColor: color.hairline },
  primary: { backgroundColor: 'rgba(255,140,140,0.9)', borderColor: 'transparent' },
  done: { opacity: 0.6 },
  buttonText: { ...type.label, color: color.moon },
  primaryText: { color: color.night },
  pressed: { opacity: 0.8, transform: [{ scale: 0.98 }] },
});
