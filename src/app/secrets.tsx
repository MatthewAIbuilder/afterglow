import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg';
import { NightSky } from '../components/NightSky';
import { PageActions } from '../components/PageActions';
import { PageTitle } from '../components/PageTitle';
import { SECRET_GLOW, SECRETS, secretsLine } from '../features/secrets/secrets';
import { haptic } from '../lib/haptics';
import { revealSecret, useSecrets } from '../state/secrets';
import { color, radius, space, type } from '../theme/tokens';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const foundOn = (t: number) => {
  const d = new Date(t);
  return `Found ${MONTHS[d.getMonth()]} ${d.getDate()}`;
};

/**
 * Secrets: the hidden things around the app. Found ones say how, and play
 * again on a tap; the rest are a riddle.
 */
export default function SecretsScreen() {
  const insets = useSafeAreaInsets();
  const { found, loaded } = useSecrets();
  const count = Object.keys(found).length;
  return (
    <View style={styles.root}>
      <PageTitle title="Secrets" />
      <NightSky />
      <ScrollView contentContainerStyle={{ paddingTop: insets.top + 64, paddingBottom: insets.bottom + space.xxxl }} showsVerticalScrollIndicator={false}>
        <View style={styles.head}>
          <Text style={styles.title} accessibilityRole="header">
            Secrets
          </Text>
          <Text style={styles.sub}>{loaded ? secretsLine(count) : ' '}</Text>
          <View style={styles.bar}>
            <View style={[styles.barFill, { width: `${(count / SECRETS.length) * 100}%` }]} />
          </View>
          <Text style={styles.note}>Little things hidden around Afterglow. Each one found adds {SECRET_GLOW} glow.</Text>
        </View>
        {SECRETS.map((s) => {
          const when = found[s.id];
          return when ? (
            <Pressable
              key={s.id}
              onPress={() => {
                haptic.select();
                revealSecret(s.id);
              }}
              accessibilityRole="button"
              accessibilityLabel={`${s.title}. ${s.found} ${foundOn(when)}. Play it again.`}
              style={({ pressed }) => [styles.card, styles.found, pressed && { transform: [{ scale: 0.98 }] }]}
              testID={`secret-card-${s.id}`}
            >
              <Lock open />
              <View style={{ flex: 1 }}>
                <Text style={styles.cardTitle}>{s.title}</Text>
                <Text style={styles.cardText}>{s.found}</Text>
                <Text style={styles.when}>{foundOn(when)} · Tap to play again</Text>
              </View>
            </Pressable>
          ) : (
            <View key={s.id} style={styles.card} accessible accessibilityLabel={`A secret not found yet. Hint: ${s.riddle}`} testID={`secret-card-${s.id}`}>
              <Lock />
              <View style={{ flex: 1 }}>
                <Text style={[styles.cardTitle, styles.hidden]}>Not found yet</Text>
                <Text style={styles.cardText}>{s.riddle}</Text>
              </View>
            </View>
          );
        })}
      </ScrollView>
      <PageActions />
    </View>
  );
}

function Lock({ open }: { open?: boolean }) {
  return (
    <View style={[styles.lock, open && styles.lockOpen]}>
      <Svg width={18} height={18} viewBox="0 0 24 24">
        <Path d={open ? 'M8 11V7.5a4 4 0 0 1 7.6-1.7' : 'M8 11V7.5a4 4 0 0 1 8 0V11'} stroke={open ? color.night : color.moonDim} strokeWidth={2} fill="none" strokeLinecap="round" />
        <Path d="M5.5 11h13v9h-13z" fill={open ? color.night : color.moonDim} />
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: color.night },
  head: { paddingHorizontal: space.lg, marginBottom: space.lg },
  title: { ...type.largeTitle, color: color.moon },
  sub: { ...type.headline, color: color.glow, marginTop: space.xs },
  bar: { height: 6, borderRadius: 3, backgroundColor: 'rgba(243,240,255,0.1)', overflow: 'hidden', marginTop: space.md },
  barFill: { height: '100%', backgroundColor: color.glow, borderRadius: 3 },
  note: { ...type.caption, color: color.moonDim, marginTop: space.md },
  card: {
    flexDirection: 'row',
    gap: space.md,
    alignItems: 'center',
    marginHorizontal: space.lg,
    marginBottom: space.sm,
    padding: space.lg,
    borderRadius: radius.md,
    backgroundColor: color.glass,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: color.hairline,
  },
  found: { borderColor: color.glow, backgroundColor: 'rgba(169,124,255,0.1)' },
  lock: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', backgroundColor: color.glass },
  lockOpen: { backgroundColor: color.glow },
  cardTitle: { ...type.headline, color: color.moon },
  hidden: { color: color.moonFaint },
  cardText: { ...type.caption, color: color.moonDim, marginTop: 2 },
  when: { ...type.caption, color: color.glow, marginTop: space.xs },
});
