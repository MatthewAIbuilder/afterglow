import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { useRef } from 'react';
import { Platform, Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { GlassCircleButton } from '../components/GlassCircleButton';
import { PageTitle } from '../components/PageTitle';
import { CloseIcon, ScanIcon, ShareIcon } from '../components/TabIcons';
import { FriendQR } from '../features/friends/FriendQR';
import { CODE_THEMES, friendLink, THEME_ORDER } from '../features/friends/qr';
import { triedAll } from '../features/secrets/secrets';
import { revealSecret } from '../state/secrets';
import { showAlert } from '../lib/dialog';
import { haptic } from '../lib/haptics';
import { shareMessage } from '../lib/share';
import { useFriendAdds } from '../state/friendAdds';
import { useSocial } from '../state/social';
import { accountsOff } from '../features/social/unavailable';
import { color, radius, space, type, accentEdge } from '../theme/tokens';
import { goBack } from '../lib/nav';
import { t } from '../i18n';

/**
 * Your friend code: a QR code a friend scans to become friends both ways,
 * in your choice of colours. It works with no signal on either phone: the
 * scan is kept and goes through once there's signal.
 */
export default function MyCodeScreen() {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const social = useSocial();
  const { myCard, codeSaved, theme, setTheme, newCode } = useFriendAdds();
  const size = Math.min(width - space.xl * 2 - 48, 300);
  const glow = CODE_THEMES[theme].glow;
  // Trying every colour in one visit (the one showing when you start tapping counts) is a secret.
  const tried = useRef(new Set<string>());

  return (
    <View style={styles.root}>
      <PageTitle title={t('My code')} />
      <View style={[styles.top, { paddingTop: Platform.OS === 'ios' ? space.lg : insets.top + space.md }]}>
        <Text style={styles.title} accessibilityRole="header">
          {t('My code')}
        </Text>
        <GlassCircleButton label={t('Close')} onPress={() => goBack()}>
          <CloseIcon color={color.moon} size={18} />
        </GlassCircleButton>
      </View>
      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + space.xxl }]}>
        {!myCard ? (
          <View style={styles.empty}>
            <Text style={styles.emptyTitle}>{social.availability.ok ? t('Make a profile to get your code') : accountsOff(Platform.OS === 'web', 'Friend codes').title}</Text>
            <Text style={styles.body}>{social.availability.ok ? t('Friends scan it to add you, even when the signal is bad.') : accountsOff(Platform.OS === 'web', 'Friend codes').body}</Text>
            {social.availability.ok ? (
              <Pressable
                onPress={() => router.push(social.user ? '/profile-edit' : '/account')}
                accessibilityRole="button"
                style={({ pressed }) => [styles.primary, pressed && styles.pressed]}
              >
                <Text style={styles.primaryText}>{social.user ? t('Finish your profile') : t('Create your profile')}</Text>
              </Pressable>
            ) : null}
          </View>
        ) : (
          <>
            <LinearGradient colors={[glow[0], glow[1]]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.ring}>
              <View
                style={styles.card}
                accessible
                accessibilityRole="image"
                accessibilityLabel={t('Your friend code, @{handle}. A friend scans it with Afterglow to become friends.', { handle: myCard.handle })}
              >
                <FriendQR value={friendLink(myCard)} size={size} theme={theme} name={myCard.name} avatarUrl={social.profile?.avatarUrl} />
                <Text style={styles.name} numberOfLines={1}>
                  {myCard.name}
                </Text>
                <Text style={styles.handle}>@{myCard.handle}</Text>
              </View>
            </LinearGradient>
            <Text style={styles.body}>{t('Scan to be friends on Afterglow. You’ll follow each other straight away.')}</Text>
            {!codeSaved ? (
              <Text style={styles.waiting}>
                {t('Your code reaches Afterglow once there’s signal. Friends can scan it now: their add goes through when you’ve both had signal.')}
              </Text>
            ) : null}

            <View style={styles.themes} accessibilityRole="radiogroup">
              {THEME_ORDER.map((th) => (
                <Pressable
                  key={th}
                  onPress={() => {
                    haptic.select();
                    setTheme(th);
                    tried.current.add(theme);
                    tried.current.add(th);
                    if (triedAll(tried.current, THEME_ORDER)) {
                      tried.current.clear();
                      revealSecret('colours');
                    }
                  }}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: th === theme }}
                  accessibilityLabel={t('{theme} colours', { theme: CODE_THEMES[th].label })}
                  hitSlop={6}
                  style={[styles.swatchRing, th === theme && styles.swatchOn]}
                >
                  <LinearGradient colors={[CODE_THEMES[th].glow[0], CODE_THEMES[th].glow[1]]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.swatch} />
                </Pressable>
              ))}
            </View>

            <View style={styles.actions}>
              {Platform.OS !== 'web' ? (
                <Pressable
                  onPress={() => {
                    haptic.tap();
                    router.replace('/scan');
                  }}
                  accessibilityRole="button"
                  accessibilityLabel={t("Scan a friend's code")}
                  style={({ pressed }) => [styles.primary, styles.row, pressed && styles.pressed]}
                >
                  <ScanIcon color={color.moon} size={18} />
                  <Text style={styles.primaryText}>{t('Scan a code')}</Text>
                </Pressable>
              ) : null}
              <Pressable
                onPress={() => {
                  haptic.select();
                  void shareMessage(t('Be my friend on Afterglow: {link}', { link: friendLink(myCard) }), t('My Afterglow code'));
                }}
                accessibilityRole="button"
                accessibilityLabel={t('Share my friend link')}
                style={({ pressed }) => [styles.secondary, styles.row, pressed && styles.pressed]}
              >
                <ShareIcon color={color.moon} size={16} />
                <Text style={styles.secondaryText}>{t('Share my link')}</Text>
              </Pressable>
            </View>
            <Pressable
              onPress={() =>
                showAlert(t('Make a new code?'), t('Screenshots or shares of your old code stop working. Friends you already have stay friends.'), [
                  { text: t('Cancel'), style: 'cancel' },
                  { text: t('New code'), onPress: () => newCode() },
                ])
              }
              accessibilityRole="button"
              hitSlop={8}
            >
              <Text style={styles.link}>{t('Make a new code')}</Text>
            </Pressable>
          </>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: color.nightRaised },
  top: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: space.xl, paddingBottom: space.md },
  title: { ...type.title, color: color.moon },
  content: { paddingHorizontal: space.xl, alignItems: 'center', gap: space.lg, alignSelf: 'center', width: '100%', maxWidth: 520 },
  ring: { padding: 3, borderRadius: radius.lg + 3 },
  card: { padding: space.lg, borderRadius: radius.lg, backgroundColor: '#FBF9FF', alignItems: 'center' },
  name: { ...type.title, color: '#1A1238', marginTop: space.md },
  handle: { ...type.body, color: '#5B4F7A' },
  body: { ...type.body, color: color.moonDim, textAlign: 'center' },
  waiting: { ...type.caption, color: '#FFB86B', textAlign: 'center' },
  themes: { flexDirection: 'row', gap: space.md },
  swatchRing: { padding: 3, borderRadius: 22, borderWidth: 2, borderColor: 'transparent' },
  swatchOn: { borderColor: color.moon },
  swatch: { width: 30, height: 30, borderRadius: 15 },
  actions: { alignSelf: 'stretch', gap: space.sm },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: space.sm },
  primary: { alignSelf: 'stretch', alignItems: 'center', paddingVertical: space.md, borderRadius: radius.pill, backgroundColor: color.glowDeep, ...accentEdge },
  primaryText: { ...type.headline, color: color.moon },
  secondary: { alignSelf: 'stretch', paddingVertical: space.md, borderRadius: radius.pill, backgroundColor: color.glass, borderWidth: StyleSheet.hairlineWidth, borderColor: color.hairline, borderTopColor: color.rim },
  secondaryText: { ...type.headline, color: color.moon },
  link: { ...type.label, color: color.moonFaint },
  pressed: { opacity: 0.8, transform: [{ scale: 0.98 }] },
  empty: { alignItems: 'center', gap: space.md, marginTop: space.xl, alignSelf: 'stretch' },
  emptyTitle: { ...type.title, color: color.moon, textAlign: 'center' },
});
