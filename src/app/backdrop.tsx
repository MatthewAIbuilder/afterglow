import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { NightSky } from '../components/NightSky';
import { PageActions } from '../components/PageActions';
import { PageTitle } from '../components/PageTitle';
import { AnimatedBackdrop } from '../features/profile/AnimatedBackdrop';
import { type Backdrop, backdropChoices, backdropOf, type BackdropId, canUse, madeFor, NO_BACKDROP, shownBackdrop } from '../features/profile/backdrops';
import { useStanding } from '../features/standing/useStanding';
import { showAlert } from '../lib/dialog';
import { t } from '../i18n';
import { haptic } from '../lib/haptics';
import { useSocial } from '../state/social';
import { useSprouts } from '../state/sprouts';
import { color, radius, space, type, nightA, accentEdge } from '../theme/tokens';
import { BottomFade } from '../components/BottomFade';

/** The "cover photo" choice: no animated background. */
const PHOTO = 'photo';
type Choice = BackdropId | typeof PHOTO;

/**
 * Profile background: an animated scene across the top of your profile in
 * place of the cover photo. A big live preview of whichever you tap, then
 * every style as a tile. A few are free, the rest come with Afterglow Plus
 * (anyone can preview them); a background made for you comes first.
 */
export default function BackdropScreen() {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const social = useSocial();
  const me = social.profile;
  const plus = !!useStanding(me?.uid)?.plus;
  const current: Choice = (me ? shownBackdrop(me.backdrop, me.uid, plus) : undefined) ?? PHOTO;
  const [picked, setPicked] = useState<Choice>(current);
  const [saving, setSaving] = useState(false);
  const gifts = useSprouts().giftThemes.map((g) => g.theme);
  const choices = backdropChoices(me?.uid, gifts);
  const special = madeFor(me?.uid);

  const pageW = Math.min(width, 640);
  const previewW = pageW - space.xl * 2;
  const previewH = Math.round(previewW * 0.56);
  const cols = 2;
  const tileW = Math.floor((previewW - space.md * (cols - 1)) / cols);
  const tileH = Math.round(tileW * 0.62);

  const pickedBackdrop = picked === PHOTO ? undefined : backdropOf(picked);
  const locked = !!pickedBackdrop && !canUse(pickedBackdrop, me?.uid, plus, gifts);
  const changed = picked !== current;

  const save = async () => {
    if (!me || !changed || saving) return;
    if (locked) {
      showAlert(t('Part of Afterglow Plus'), t('{backdrop} comes with Afterglow Plus. You can preview every background here; Aurora, Starfield and Nebula are free.', { backdrop: `${pickedBackdrop?.name}` }));
      return;
    }
    setSaving(true);
    try {
      // Someone with a background made for them turns it off with "none"; for everyone else no choice means the photo.
      await social.setBackdrop(picked === PHOTO ? (special ? NO_BACKDROP : null) : picked);
      haptic.settle();
      if (router.canGoBack()) router.back();
    } catch {
      showAlert(t('Couldn’t save your background'), t('Check your connection and try again.'));
    } finally {
      setSaving(false);
    }
  };

  const pick = (c: Choice) => {
    haptic.select();
    setPicked(c);
  };

  return (
    <View style={styles.root}>
      <PageTitle title={t('Profile background')} />
      <NightSky />
      <PageActions />
      <ScrollView contentContainerStyle={[styles.content, { paddingTop: insets.top + 64, paddingBottom: insets.bottom + 120, width: pageW }]}>
        <Text style={styles.title} accessibilityRole="header">
          {t('Profile background')}
        </Text>
        <Text style={styles.body}>{t('A living scene across the top of your profile, for everyone who visits it.')}</Text>

        <View style={[styles.preview, { width: previewW, height: previewH }]} accessible accessibilityLabel={pickedBackdrop ? t('Preview: {backdrop}, {about}', { backdrop: pickedBackdrop.name, about: pickedBackdrop.about }) : t('Preview: cover photo')}>
          {pickedBackdrop ? (
            <AnimatedBackdrop key={pickedBackdrop.id} id={pickedBackdrop.id} width={previewW} height={previewH} />
          ) : me?.coverUrl ? (
            <Image source={{ uri: me.coverUrl }} style={StyleSheet.absoluteFill} contentFit="cover" />
          ) : null}
          <LinearGradient colors={[nightA(0), nightA(0.85)]} locations={[0.5, 1]} style={StyleSheet.absoluteFill} />
          <View style={styles.previewMe}>
            <View style={styles.previewAvatar}>
              {me?.avatarUrl ? <Image source={{ uri: me.avatarUrl }} style={StyleSheet.absoluteFill} contentFit="cover" /> : <Text style={styles.initial}>{(me?.displayName ?? '?').slice(0, 1).toUpperCase()}</Text>}
            </View>
            <View style={{ flexShrink: 1 }}>
              <Text style={styles.previewName} numberOfLines={1}>
                {pickedBackdrop?.name ?? t('Cover photo')}
              </Text>
              <Text style={styles.previewAbout} numberOfLines={2}>
                {pickedBackdrop?.about ?? (me?.coverUrl ? t('Your cover photo, as it is now') : t('A plain night sky. Add a cover photo in Edit profile.'))}
              </Text>
            </View>
          </View>
        </View>

        <Pressable onPress={() => router.push('/themes')} accessibilityRole="button" style={styles.themeLink}>
          <Text style={styles.themeLinkText}>{t('Want the whole app in a new look? App themes ›')}</Text>
        </Pressable>

        <View style={[styles.grid, { gap: space.md }]}>
          <Tile
            label={t('Cover photo')}
            detail={me?.coverUrl ? t('Your photo') : t('Plain night')}
            selected={picked === PHOTO}
            width={tileW}
            height={tileH}
            onPress={() => pick(PHOTO)}
          >
            {me?.coverUrl ? <Image source={{ uri: me.coverUrl }} style={StyleSheet.absoluteFill} contentFit="cover" /> : <View style={[StyleSheet.absoluteFill, styles.plain]} />}
          </Tile>
          {choices.map((b) => (
            <Tile
              key={b.id}
              label={b.name}
              detail={b.only ? t('Made for you') : b.gift ? t('Gift') : b.plus ? t('Plus') : t('Free')}
              tag={tagOf(b, me?.uid, plus, gifts)}
              selected={picked === b.id}
              current={current === b.id}
              width={tileW}
              height={tileH}
              onPress={() => pick(b.id)}
            >
              {/* Only the chosen tile moves; the big preview above shows it at full size. */}
              <AnimatedBackdrop id={b.id} width={tileW} height={tileH} still={picked !== b.id} />
            </Tile>
          ))}
        </View>
      </ScrollView>

      <View style={[styles.bar, { paddingBottom: insets.bottom + space.md }]}>
        <BottomFade />
        {locked ? <Text style={styles.lockNote}>{t('Part of Afterglow Plus. Preview it as much as you like.')}</Text> : null}
        <Pressable
          onPress={() => void save()}
          disabled={!changed || saving}
          accessibilityRole="button"
          accessibilityState={{ disabled: !changed || saving }}
          style={({ pressed }) => [styles.primary, locked && styles.primaryLocked, (!changed || saving) && styles.dim, pressed && styles.pressed]}
        >
          {saving ? (
            <ActivityIndicator color={color.moon} />
          ) : (
            <Text style={styles.primaryText}>{!changed ? t('This is your background') : locked ? t('Comes with Plus') : pickedBackdrop ? t('Use {backdrop}', { backdrop: pickedBackdrop.name }) : t('Use cover photo')}</Text>
          )}
        </Pressable>
      </View>
    </View>
  );
}

function tagOf(b: Backdrop, uid: string | undefined, plus: boolean, gifts: readonly string[]): { text: string; tone: 'special' | 'plus' | 'free' } | undefined {
  if (b.only) return { text: t('♥ Yours'), tone: 'special' };
  if (b.gift) return canUse(b, uid, plus, gifts) ? { text: t('♥ Gift'), tone: 'special' } : undefined;
  if (b.plus) return { text: canUse(b, uid, plus) ? 'PLUS' : 'PLUS 🔒', tone: 'plus' };
  return undefined;
}

function Tile({
  label,
  detail,
  tag,
  selected,
  current,
  width,
  height,
  onPress,
  children,
}: {
  label: string;
  detail: string;
  tag?: { text: string; tone: 'special' | 'plus' | 'free' };
  selected: boolean;
  current?: boolean;
  width: number;
  height: number;
  onPress: () => void;
  children: React.ReactNode;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      accessibilityLabel={current ? t('{label}. {detail}. Your background now', { label, detail }) : t('{label}. {detail}', { label, detail })}
      style={({ pressed }) => [{ width }, pressed && styles.pressed]}
    >
      <View style={[styles.tile, { height }, selected && styles.tileSelected]}>
        {children}
        {tag ? (
          <View style={[styles.tag, tag.tone === 'special' ? styles.tagSpecial : styles.tagPlus]}>
            <Text style={styles.tagText}>{tag.text}</Text>
          </View>
        ) : null}
        {selected ? (
          <View style={styles.check}>
            <Text style={styles.checkText}>✓</Text>
          </View>
        ) : null}
      </View>
      <Text style={[styles.tileLabel, selected && styles.tileLabelOn]} numberOfLines={1}>
        {label}
      </Text>
      <Text style={styles.tileDetail} numberOfLines={1}>
        {current ? t('Now') : detail}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: color.night },
  content: { alignSelf: 'center', paddingHorizontal: space.xl },
  title: { ...type.largeTitle, color: color.moon },
  body: { ...type.body, color: color.moonDim, marginTop: space.xs, marginBottom: space.lg },
  preview: { borderRadius: radius.lg, overflow: 'hidden', backgroundColor: color.nightRaised, borderWidth: StyleSheet.hairlineWidth, borderColor: color.hairline },
  previewMe: { position: 'absolute', left: space.md, right: space.md, bottom: space.md, flexDirection: 'row', alignItems: 'center', gap: space.md },
  previewAvatar: { width: 44, height: 44, borderRadius: 22, overflow: 'hidden', backgroundColor: color.haze, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: 'rgba(243,240,255,0.85)' },
  initial: { ...type.headline, color: color.moon },
  previewName: { ...type.headline, color: color.moon },
  previewAbout: { ...type.caption, color: color.moonDim },
  grid: { flexDirection: 'row', flexWrap: 'wrap', marginTop: space.lg },
  themeLink: { marginTop: space.lg, paddingVertical: space.xs },
  themeLinkText: { ...type.label, color: color.glow },
  tile: { borderRadius: radius.md, overflow: 'hidden', backgroundColor: color.nightRaised, borderWidth: 2, borderColor: 'transparent' },
  tileSelected: { borderColor: color.glow },
  plain: { backgroundColor: '#100d24' },
  tileLabel: { ...type.label, color: color.moonDim, marginTop: space.sm },
  tileLabelOn: { color: color.moon },
  tileDetail: { ...type.caption, color: color.moonFaint, marginBottom: space.sm },
  tag: { position: 'absolute', top: 6, left: 6, borderRadius: radius.pill, paddingHorizontal: 7, paddingVertical: 2 },
  tagPlus: { backgroundColor: 'rgba(255,214,107,0.92)' },
  tagSpecial: { backgroundColor: 'rgba(255,158,199,0.95)' },
  tagText: { fontSize: 10, fontWeight: '800', letterSpacing: 0.4, color: '#1B1230' },
  check: { position: 'absolute', top: 6, right: 6, width: 22, height: 22, borderRadius: 11, backgroundColor: color.glow, alignItems: 'center', justifyContent: 'center' },
  checkText: { color: '#FFFFFF', fontSize: 13, fontWeight: '800' },
  bar: { position: 'absolute', left: 0, right: 0, bottom: 0, paddingHorizontal: space.xl, paddingTop: space.md, alignItems: 'center' },
  lockNote: { ...type.caption, color: '#FFD66B', marginBottom: space.sm },
  primary: { alignSelf: 'stretch', maxWidth: 600, height: 50, borderRadius: radius.pill, backgroundColor: color.glowDeep, ...accentEdge, alignItems: 'center', justifyContent: 'center' },
  primaryLocked: { backgroundColor: 'rgba(255,214,107,0.25)' },
  primaryText: { ...type.headline, color: color.moon },
  dim: { opacity: 0.5 },
  pressed: { opacity: 0.75 },
});
