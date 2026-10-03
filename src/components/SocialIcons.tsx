import { Linking, Pressable, StyleSheet, View } from 'react-native';
import Svg, { Circle, Path, Rect } from 'react-native-svg';
import { SOCIALS, socialA11y, socialUrl, type SocialKey, type Socials } from '../features/social/socials';
import { haptic } from '../lib/haptics';
import { color } from '../theme/tokens';

type P = { color: string; size?: number };

/*
 * Simple one-colour versions of each service's own glyph, used only as links
 * to someone's account (which all three allow). Before launch, swap in the
 * official files from each brand's resources page (Instagram, Snapchat and
 * TikTok brand guidelines); they must not be recoloured into gradients or
 * changed.
 */
export function InstagramIcon({ color: c, size = 20 }: P) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Rect x={3} y={3} width={18} height={18} rx={5.2} stroke={c} strokeWidth={2} />
      <Circle cx={12} cy={12} r={4.2} stroke={c} strokeWidth={2} />
      <Circle cx={17.3} cy={6.7} r={1.25} fill={c} />
    </Svg>
  );
}

export function SnapchatIcon({ color: c, size = 20 }: P) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M12 2.6c2.9 0 5 2.2 5 5.2v2.2c.5.2 1.1.1 1.6-.1.5-.2 1 .4.6.8-.4.4-1.3.7-1.9.9.3 1.3 1.6 2.7 3.4 3.3.4.1.4.6 0 .8-.8.3-1.6.4-1.8.6-.2.3-.1.9-.5 1-.6.1-1.4-.2-2.2 0-.9.2-1.7 1.6-4.2 1.6s-3.3-1.4-4.2-1.6c-.8-.2-1.6.1-2.2 0-.4-.1-.3-.7-.5-1-.2-.2-1-.3-1.8-.6-.4-.2-.4-.7 0-.8 1.8-.6 3.1-2 3.4-3.3-.6-.2-1.5-.5-1.9-.9-.4-.4.1-1 .6-.8.5.2 1.1.3 1.6.1V7.8c0-3 2.1-5.2 5-5.2z"
        stroke={c}
        strokeWidth={1.8}
        strokeLinejoin="round"
      />
    </Svg>
  );
}

export function TikTokIcon({ color: c, size = 20 }: P) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M14 3h2.6c.2 1.6 1.4 3.1 3.4 3.3V9c-1.3 0-2.5-.4-3.4-1v6.6c0 3.1-2.5 5.4-5.4 5.4s-5.4-2.4-5.4-5.4 2.4-5.4 5.4-5.4c.3 0 .6 0 .9.1v2.8c-.3-.1-.6-.2-.9-.2-1.5 0-2.7 1.2-2.7 2.7s1.2 2.7 2.7 2.7 2.8-1.2 2.8-2.8V3z"
        fill={c}
      />
    </Svg>
  );
}

const ICONS: Record<SocialKey, (p: P) => React.JSX.Element> = { instagram: InstagramIcon, snapchat: SnapchatIcon, tiktok: TikTokIcon };

export function SocialIcon({ kind, color: c, size }: P & { kind: SocialKey }) {
  const Icon = ICONS[kind];
  return <Icon color={c} size={size} />;
}

/** Someone's Instagram, Snapchat and TikTok as a row of small round buttons that open the account. */
export function SocialLinks({ socials, whose }: { socials?: Socials; whose?: string }) {
  const shown = SOCIALS.filter((s) => socials?.[s.key]);
  if (!shown.length) return null;
  return (
    <View style={styles.row}>
      {shown.map((s) => {
        const name = socials![s.key]!;
        return (
          <Pressable
            key={s.key}
            onPress={() => {
              haptic.select();
              void Linking.openURL(socialUrl(s.key, name)).catch(() => {});
            }}
            accessibilityRole="link"
            accessibilityLabel={socialA11y(s.key, name, whose)}
            hitSlop={6}
            style={({ pressed }) => [styles.button, pressed && { opacity: 0.7 }]}
          >
            <SocialIcon kind={s.key} color={color.moon} size={18} />
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', justifyContent: 'center', gap: 10, marginTop: 10 },
  button: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: color.glass,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: color.hairline,
  },
});
