import * as AppleAuthentication from 'expo-apple-authentication';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { haptic } from '../../lib/haptics';
import { color, radius, space, type } from '../../theme/tokens';
import { t } from '../../i18n';
import type { ProviderProof, SignInProvider } from './providerAuth';
import { availableProviders, signInWithProvider } from './providerSignIn';

const HEIGHT = 50;

/**
 * "Continue with Apple" and "Continue with Google", each shown only where it
 * works (Apple on iPhone, both on the website once set up; see
 * config/social.ts). Apple's is Apple's own button; Google's follows Google's
 * look (white, its four-colour G). Hands the proof to `onProof`, which signs
 * in; a cancelled sheet says nothing. Renders nothing when neither is on.
 */
export function ProviderButtons({
  onProof,
  busy,
  label = 'continue',
  after,
  only,
  none = null,
}: {
  onProof: (proof: ProviderProof, name?: string) => Promise<void>;
  busy?: boolean;
  /** "Continue with" to sign in; "Confirm with" to delete the account. */
  label?: 'continue' | 'confirm';
  /** Drawn under the buttons when there are any (the "or with email" line). */
  after?: React.ReactNode;
  /** Only this one (the account's own, to confirm deleting it). */
  only?: SignInProvider;
  /** Drawn instead when neither can be used here. */
  none?: React.ReactNode;
}) {
  // Undefined until it's known which can be used here.
  const [shown, setShown] = useState<Record<SignInProvider, boolean> | undefined>();
  const [working, setWorking] = useState<SignInProvider | undefined>();
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    let live = true;
    void availableProviders().then((a) => live && setShown(only ? { apple: a.apple && only === 'apple', google: a.google && only === 'google' } : a));
    return () => {
      live = false;
    };
  }, [only]);
  if (!shown) return null;
  if (!shown.apple && !shown.google) return <>{none}</>;

  const go = async (p: SignInProvider) => {
    if (busy || working) return;
    haptic.tap();
    setFailed(false);
    setWorking(p);
    try {
      const r = await signInWithProvider(p);
      if (r.type === 'proof') await onProof(r.proof, r.name);
      else if (r.type === 'error') setFailed(true);
    } finally {
      setWorking(undefined);
    }
  };

  const confirm = label === 'confirm';
  return (
    <View style={styles.root}>
      {shown.apple ? (
        Platform.OS === 'ios' ? (
          <View style={[styles.native, working === 'apple' && styles.dim]} pointerEvents={working ? 'none' : 'auto'}>
            <AppleAuthentication.AppleAuthenticationButton
              buttonType={AppleAuthentication.AppleAuthenticationButtonType.CONTINUE}
              buttonStyle={AppleAuthentication.AppleAuthenticationButtonStyle.WHITE}
              cornerRadius={HEIGHT / 2}
              style={styles.apple}
              onPress={() => void go('apple')}
            />
          </View>
        ) : (
          <Pressable
            onPress={() => void go('apple')}
            accessibilityRole="button"
            accessibilityLabel={confirm ? t('Confirm with Apple') : t('Continue with Apple')}
            style={({ pressed }) => [styles.button, pressed && styles.pressed]}
          >
            {working === 'apple' ? <ActivityIndicator color="#000" /> : <AppleMark />}
            <Text style={styles.text}>{confirm ? t('Confirm with Apple') : t('Continue with Apple')}</Text>
          </Pressable>
        )
      ) : null}
      {shown.google ? (
        <Pressable
          onPress={() => void go('google')}
          accessibilityRole="button"
          accessibilityLabel={confirm ? t('Confirm with Google') : t('Continue with Google')}
          style={({ pressed }) => [styles.button, pressed && styles.pressed]}
        >
          {working === 'google' ? <ActivityIndicator color="#1F1F1F" /> : <GoogleMark />}
          <Text style={styles.text}>{confirm ? t('Confirm with Google') : t('Continue with Google')}</Text>
        </Pressable>
      ) : null}
      {failed ? (
        <Text style={styles.problem} accessibilityLiveRegion="assertive">
          {t('Couldn’t open the sign-in. Check your connection and try again.')}
        </Text>
      ) : null}
      {after}
    </View>
  );
}

/** Google's G, in its four colours. */
function GoogleMark() {
  return (
    <Svg width={18} height={18} viewBox="0 0 48 48" accessibilityElementsHidden importantForAccessibility="no">
      <Path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
      <Path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
      <Path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
      <Path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
    </Svg>
  );
}

/** Apple's logo, for the website's button (the phone uses Apple's own). */
function AppleMark() {
  return (
    <Svg width={16} height={18} viewBox="0 0 384 512" accessibilityElementsHidden importantForAccessibility="no">
      <Path
        fill="#000"
        d="M318.7 268.7c-.2-36.7 16.4-64.4 50-84.8-18.8-26.9-47.2-41.7-84.7-44.6-35.5-2.8-74.3 20.7-88.5 20.7-15 0-49.4-19.7-76.4-19.7C63.3 141.2 4 184.8 4 273.5q0 39.3 14.4 81.2c12.8 36.7 59 126.7 107.2 125.2 25.2-.6 43-17.9 75.8-17.9 31.8 0 48.3 17.9 76.4 17.9 48.6-.7 90.4-82.5 102.6-119.3-65.2-30.7-61.7-90-61.7-91.9zm-56.6-164.2c27.3-32.4 24.8-61.9 24-72.5-24.1 1.4-52 16.4-67.9 34.9-17.5 19.8-27.8 44.3-25.6 71.9 26.1 2 49.9-11.4 69.5-34.3z"
      />
    </Svg>
  );
}

const styles = StyleSheet.create({
  root: { gap: space.sm },
  native: { height: HEIGHT },
  apple: { height: HEIGHT, width: '100%' },
  // White, as Apple's and Google's own guidelines ask for on a dark page (their colours, not the app's).
  button: {
    height: HEIGHT,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: space.sm,
    borderRadius: radius.pill,
    backgroundColor: '#FFFFFF',
  },
  // Google's button text colour, on white.
  text: { ...type.headline, color: '#1F1F1F' },
  pressed: { opacity: 0.85, transform: [{ scale: 0.98 }] },
  dim: { opacity: 0.6 },
  problem: { ...type.label, color: color.moon },
});
