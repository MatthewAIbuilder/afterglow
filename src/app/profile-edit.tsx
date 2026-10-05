import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { router } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Image as RNImage, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Switch, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { GlassCircleButton } from '../components/GlassCircleButton';
import { PageActions } from '../components/PageActions';
import { NightSky } from '../components/NightSky';
import { ChevronIcon } from '../components/TabIcons';
import { SOUND_LABEL } from '../data/models';
import { goingLine } from '../features/social/copy';
import { SOCIAL_ERROR_COPY, socialErrorKind } from '../features/social/service';
import { BIO_MAX, normalizeHandle, profileProblems, suggestHandle } from '../features/social/validate';
import { SOCIALS, readSocial, socialUrl, type SocialKey } from '../features/social/socials';
import { SocialIcon } from '../components/SocialIcons';
import { tasteMix } from '../features/taste/lean';
import { haptic } from '../lib/haptics';
import { forgetAccount } from '../state/savedAccounts';
import { useCatalog } from '../state/catalog';
import { useGoing } from '../state/going';
import { useSocial } from '../state/social';
import { useTaste } from '../state/taste';
import { color, radius, space, type, glowA, nightA } from '../theme/tokens';
import { showAlert } from '../lib/dialog';
import type { CropShape } from '../features/profile/crop';
import { useShowLevel, setShowLevel } from '../state/showLevel';
import { useDailyQuests } from '../features/quests/useDailyQuests';
import { LEVEL_SHOWN_FROM } from '../features/quests/daily';
import { type CropSource, PhotoCropper } from '../features/profile/PhotoCropper';
import { goBack } from '../lib/nav';
import { CoverLayers } from '../components/ProfileCover';
import { backdropOf, shownBackdrop } from '../features/profile/backdrops';
import { useStanding } from '../features/standing/useStanding';

/**
 * Your profile, as others will see it: photo, name, @handle, a short bio,
 * an animated background, and switches for what else to show (favourite
 * artists, festivals you're going to, your top sounds). Also where you sign out or delete your account.
 */
export default function ProfileEditScreen() {
  const insets = useSafeAreaInsets();
  const social = useSocial();
  const catalog = useCatalog();
  const { going } = useGoing();
  const { taste, informed } = useTaste();
  const p = social.profile;

  const [displayName, setDisplayName] = useState(p?.displayName ?? '');
  const [handle, setHandle] = useState(p?.handle ?? suggestHandle(social.user?.email ?? ''));
  const [bio, setBio] = useState(p?.bio ?? '');
  const [showFestivals, setShowFestivals] = useState(p?.showFestivals ?? false);
  const [showSound, setShowSound] = useState(p?.showSound ?? false);
  const [showArtists, setShowArtists] = useState(p?.showArtists ?? true);
  const standing = useStanding(p?.uid);
  const backdrop = backdropOf(p ? shownBackdrop(p.backdrop, p.uid, !!standing?.plus) : undefined);
  const [socials, setSocials] = useState<Record<SocialKey, string>>({ instagram: p?.socials?.instagram ?? '', snapchat: p?.socials?.snapchat ?? '', tiktok: p?.socials?.tiktok ?? '' });
  // Your profile arriving after the screen opened (right after launch, a switch of account): fill the form from it, once.
  const [seededFor, setSeededFor] = useState(p?.uid);
  if (p && seededFor !== p.uid) {
    setSeededFor(p.uid);
    setDisplayName(p.displayName);
    setHandle(p.handle);
    setBio(p.bio);
    setShowFestivals(p.showFestivals);
    setShowSound(p.showSound);
    setSocials({ instagram: p.socials?.instagram ?? '', snapchat: p.socials?.snapchat ?? '', tiktok: p.socials?.tiktok ?? '' });
    setShowArtists(p.showArtists ?? true);
  }
  // Applies at once (it isn't part of the saved profile): LevelSync sends or removes it.
  const showLevel = useShowLevel();
  const daily = useDailyQuests();
  const [saving, setSaving] = useState(false);
  const [problem, setProblem] = useState<string | undefined>();
  const [checked, setChecked] = useState<{ handle: string; ok: boolean }>();
  const [deleting, setDeleting] = useState(false);
  // A picked photo waiting to be framed, then the one being uploaded.
  const [cropping, setCropping] = useState<{ shape: CropShape; source: CropSource }>();
  const [uploading, setUploading] = useState<CropShape>();
  const [password, setPassword] = useState('');

  const input = { handle, displayName, bio, showFestivals, showSound, showArtists, socials };
  const problems = profileProblems(input);
  const h = normalizeHandle(handle);

  // Is the handle free? Checked a moment after you stop typing; the answer only counts for the handle it was about.
  const available = checked?.handle === h ? checked.ok : undefined;
  useEffect(() => {
    if (problems.handle || h === p?.handle) return;
    let live = true;
    const t = setTimeout(() => {
      social.service
        .handleAvailable(h)
        .then((ok) => live && setChecked({ handle: h, ok }))
        .catch(() => {});
    }, 450);
    return () => {
      live = false;
      clearTimeout(t);
    };
  }, [h, problems.handle, p?.handle, social.service]);

  const goingNames = going.map((id) => catalog.festival(id)?.name).filter((n): n is string => !!n);
  const sounds = useMemo(() => tasteMix(catalog.artists, taste, informed).slice(0, 3).map((s) => SOUND_LABEL[s.tag]), [catalog.artists, taste, informed]);

  if (!social.user) {
    return (
      <View style={[styles.root, { paddingTop: insets.top + 80, paddingHorizontal: space.xl }]}>
        <NightSky />
        <Text style={styles.body}>Sign in to edit your profile.</Text>
      </View>
    );
  }

  // Until your profile has been read, the form waits: saving a blank one would replace the real one.
  if (social.profileStatus !== 'ready') {
    const failed = social.profileStatus === 'failed';
    return (
      <View style={[styles.root, { paddingTop: insets.top + 80, paddingHorizontal: space.xl, gap: space.lg }]}>
        <NightSky />
        <Text style={styles.body}>{failed ? 'Your profile couldn’t be loaded. Check the signal and try again.' : 'Loading your profile…'}</Text>
        {failed ? (
          <Pressable onPress={social.reloadProfile} accessibilityRole="button" accessibilityLabel="Try loading your profile again" hitSlop={8}>
            <Text style={styles.retry}>Try again</Text>
          </Pressable>
        ) : null}
        <PageActions />
      </View>
    );
  }

  const save = async () => {
    if (Object.keys(problems).length || available === false) {
      setProblem(problems.displayName ?? problems.handle ?? problems.bio ?? problems.instagram ?? problems.snapchat ?? problems.tiktok ?? SOCIAL_ERROR_COPY['handle-taken']);
      return;
    }
    haptic.tap();
    setSaving(true);
    setProblem(undefined);
    try {
      const saved = await social.saveProfile(input);
      haptic.settle();
      // Saved, but the database isn't ready for socials yet (its rules need updating): say so rather than drop them quietly.
      const wanted = SOCIALS.some((s) => readSocial(s.key, socials[s.key]));
      if (wanted && !Object.keys(saved.socials ?? {}).length)
        showAlert('Saved, without your socials', 'Your profile is saved, but Instagram, Snapchat and TikTok can’t be added just yet: Afterglow’s database needs an update first. Try again later.');
      goBack();
    } catch (e) {
      setProblem(SOCIAL_ERROR_COPY[socialErrorKind(e)]);
    } finally {
      setSaving(false);
    }
  };

  const applyCrop = async (uri: string) => {
    const shape = cropping?.shape;
    setCropping(undefined);
    if (!shape) return;
    setUploading(shape);
    try {
      if (shape === 'avatar') await social.setAvatar(uri);
      else await social.setCover(uri);
      haptic.settle();
    } catch (e) {
      showAlert(shape === 'avatar' ? 'Couldn’t update your photo' : 'Couldn’t update your cover', SOCIAL_ERROR_COPY[socialErrorKind(e)]);
    } finally {
      setUploading(undefined);
    }
  };

  const changePhoto = () => {
    if (!p) {
      showAlert('Save your profile first', 'Then you can add a photo.');
      return;
    }
    const pick = async () => {
      const picked = await pickToCrop();
      if (picked) setCropping({ shape: 'avatar', source: picked });
    };
    showAlert('Profile photo', undefined, [
      { text: 'Choose a photo', onPress: () => void pick() },
      ...(p.avatarUrl ? [{ text: 'Remove photo', style: 'destructive' as const, onPress: () => void social.setAvatar(null).catch(() => {}) }] : []),
      { text: 'Cancel', style: 'cancel' },
    ]);
  };

  const changeCover = () => {
    if (!p) {
      showAlert('Save your profile first', 'Then you can add a cover photo.');
      return;
    }
    const pick = async () => {
      const picked = await pickToCrop();
      if (picked) setCropping({ shape: 'cover', source: picked });
    };
    showAlert('Cover photo', 'A wide photo across the top of your profile: a crowd, a stage, a sunset.', [
      { text: 'Choose a photo', onPress: () => void pick() },
      ...(p.coverUrl ? [{ text: 'Remove cover', style: 'destructive' as const, onPress: () => void social.setCover(null).catch(() => {}) }] : []),
      { text: 'Cancel', style: 'cancel' },
    ]);
  };

  const signOut = () => {
    showAlert('Sign out?', 'Your memories stay on this phone. Shared ones stay on your profile.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Sign out',
        onPress: () =>
          void social.signOut().then(() => {
            if (router.canGoBack()) goBack();
          }),
      },
    ]);
  };

  const deleteAccount = async () => {
    try {
      const uid = social.user?.uid;
      await social.deleteAccount(password);
      if (uid) void forgetAccount(uid);
      haptic.settle();
      showAlert('Account deleted', 'Your profile and everything you shared are gone. Your memories are still on this phone.');
      if (router.canGoBack()) goBack();
    } catch (e) {
      setProblem(SOCIAL_ERROR_COPY[socialErrorKind(e)]);
    }
  };

  const handleNote = problems.handle ?? (h === p?.handle ? undefined : available === false ? SOCIAL_ERROR_COPY['handle-taken'] : available ? 'Available' : undefined);

  return (
    <KeyboardAvoidingView style={styles.root} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <NightSky />
      <ScrollView contentContainerStyle={{ paddingTop: insets.top + 64, paddingBottom: insets.bottom + space.xxxl }} keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag">
        <View style={styles.pad}>
          <Text style={styles.title} accessibilityRole="header">
            {p ? 'Your profile' : 'Create your profile'}
          </Text>
          <Text style={styles.body}>Anyone on Afterglow can see what’s here. Your taste, ratings and unshared memories never are.</Text>

          <Pressable onPress={changePhoto} accessibilityRole="button" accessibilityLabel={p?.avatarUrl ? 'Change profile photo' : 'Add a profile photo'} style={styles.avatarRow}>
            <View style={styles.avatar}>
              {p?.avatarUrl ? <Image source={{ uri: p.avatarUrl }} style={StyleSheet.absoluteFill} contentFit="cover" /> : <Text style={styles.initial}>{(displayName || handle || '?').slice(0, 1).toUpperCase()}</Text>}
              {uploading === 'avatar' ? <View style={styles.uploading}><ActivityIndicator color={color.moon} /></View> : null}
            </View>
            <Text style={styles.link}>{uploading === 'avatar' ? 'Uploading…' : p?.avatarUrl ? 'Change photo' : 'Add photo'}</Text>
          </Pressable>

          <Pressable onPress={changeCover} accessibilityRole="button" accessibilityLabel={p?.coverUrl ? 'Change cover photo' : 'Add a cover photo'} style={styles.coverRow}>
            <View style={styles.cover}>
              {p?.coverUrl ? <Image source={{ uri: p.coverUrl }} style={StyleSheet.absoluteFill} contentFit="cover" /> : <Text style={styles.coverHint}>Cover photo</Text>}
              {uploading === 'cover' ? <View style={styles.uploading}><ActivityIndicator color={color.moon} /></View> : null}
            </View>
            <Text style={styles.link}>{uploading === 'cover' ? 'Uploading…' : p?.coverUrl ? 'Change cover' : 'Add cover'}</Text>
          </Pressable>
          <Pressable
            onPress={() => (p ? router.push('/backdrop') : showAlert('Save your profile first', 'Then you can choose a background.'))}
            accessibilityRole="button"
            accessibilityLabel={`Profile background: ${backdrop?.name ?? 'cover photo'}. Change it`}
            style={styles.coverRow}
          >
            <View style={styles.cover}>
              {backdrop ? <CoverLayers url={p?.coverUrl} backdrop={backdrop.id} width={112} height={63} still /> : <Text style={styles.coverHint}>Animated</Text>}
            </View>
            <View style={{ flexShrink: 1 }}>
              <Text style={styles.link}>{backdrop ? `Background · ${backdrop.name}` : 'Animated background'}</Text>
              <Text style={styles.rowNote}>{backdrop ? (p?.coverUrl ? 'Blended with your cover photo' : 'Across the top of your profile') : 'Aurora, lasers, a sunset grid and more'}</Text>
            </View>
          </Pressable>
          <PhotoCropper source={cropping?.source} shape={cropping?.shape ?? 'avatar'} onDone={(uri) => void applyCrop(uri)} onCancel={() => setCropping(undefined)} />

          <Field label="Name">
            <TextInput value={displayName} onChangeText={setDisplayName} placeholder="Your name" placeholderTextColor={color.moonFaint} maxLength={60} accessibilityLabel="Name" style={styles.input} />
          </Field>
          <Field label="Handle" note={handleNote} good={!problems.handle && available === true}>
            <View style={styles.handleRow}>
              <Text style={styles.at}>@</Text>
              <TextInput
                value={handle}
                onChangeText={(t) => setHandle(t.replace(/\s/g, ''))}
                placeholder="handle"
                placeholderTextColor={color.moonFaint}
                autoCapitalize="none"
                autoCorrect={false}
                maxLength={24}
                accessibilityLabel="Handle"
                style={[styles.input, styles.handleInput]}
              />
            </View>
          </Field>
          <Field label="Bio" note={problems.bio ?? `${bio.trim().length}/${BIO_MAX}`}>
            <TextInput
              value={bio}
              onChangeText={setBio}
              placeholder="Bass head, sunrise sets, always at the rail."
              placeholderTextColor={color.moonFaint}
              multiline
              maxLength={BIO_MAX + 20}
              accessibilityLabel="Bio"
              style={[styles.input, styles.bio]}
            />
          </Field>

          <Text style={styles.section}>Your socials</Text>
          <Text style={styles.note}>Add your usernames and they show as little icons on your profile. Paste a link or type the name.</Text>
          {SOCIALS.map((s) => {
            const name = readSocial(s.key, socials[s.key]);
            const bad = problems[s.key];
            return (
              <View key={s.key} style={{ gap: 4 }}>
                <View style={styles.socialRow}>
                  <SocialIcon kind={s.key} color={color.moon} size={20} />
                  <TextInput
                    value={socials[s.key]}
                    onChangeText={(v) => setSocials((x) => ({ ...x, [s.key]: v }))}
                    placeholder={`${s.label} username`}
                    placeholderTextColor={color.moonFaint}
                    autoCapitalize="none"
                    autoCorrect={false}
                    maxLength={120}
                    accessibilityLabel={`${s.label} username`}
                    style={[styles.input, styles.socialInput]}
                  />
                </View>
                {bad ? <Text style={styles.problemNote}>{bad}</Text> : name ? <Text style={styles.note}>{socialUrl(s.key, name).replace('https://', '')}</Text> : null}
              </View>
            );
          })}

          <View style={styles.switches}>
            <SwitchRow label="Show festivals I’m going to" detail={showFestivals ? (goingLine(goingNames) ?? 'None yet. Tap I’m going on a festival.') : 'Hidden'} value={showFestivals} onChange={setShowFestivals} />
            <SwitchRow
              label="Show my glow level"
              detail={showLevel === false ? 'Hidden' : daily.level.level >= LEVEL_SHOWN_FROM ? `Level ${daily.level.level} · ${daily.level.name}` : 'Shows once you reach level 2 in your quests'}
              value={showLevel !== false}
              onChange={setShowLevel}
            />
            <SwitchRow
              label="Show my favourite artists"
              detail={showArtists ? 'Round your photo on your profile' : 'Hidden'}
              value={showArtists}
              onChange={setShowArtists}
            />
            <SwitchRow
              label="Show my favourite artists"
              detail={showArtists ? 'They drift round your photo on your profile' : 'Hidden'}
              value={showArtists}
              onChange={setShowArtists}
            />
            <SwitchRow label="Show my sound" detail={showSound ? (sounds.length ? sounds.join(', ') : 'Your top sounds, once you’ve reacted to some clips') : 'Hidden'} value={showSound} onChange={setShowSound} />
          </View>

          {problem ? (
            <Text style={styles.problem} accessibilityLiveRegion="assertive">
              {problem}
            </Text>
          ) : null}

          <Pressable onPress={() => void save()} accessibilityRole="button" style={({ pressed }) => [styles.primary, pressed && styles.pressed]}>
            {saving ? <ActivityIndicator color={color.moon} /> : <Text style={styles.primaryText}>{p ? 'Save' : 'Create profile'}</Text>}
          </Pressable>

          {p ? (
            <Pressable onPress={() => router.push({ pathname: '/u/[handle]', params: { handle: p.handle } })} accessibilityRole="button" style={styles.rowLink}>
              <Text style={styles.link}>See your profile as others do</Text>
            </Pressable>
          ) : null}

          <View style={styles.account}>
            <Text style={styles.section}>Account</Text>
            <Text style={styles.body}>{social.user.email}</Text>
            <Pressable onPress={signOut} accessibilityRole="button" style={styles.rowLink}>
              <Text style={styles.link}>Sign out</Text>
            </Pressable>
            {!deleting ? (
              <Pressable onPress={() => setDeleting(true)} accessibilityRole="button" style={styles.rowLink}>
                <Text style={styles.danger}>Delete account</Text>
              </Pressable>
            ) : (
              <View style={styles.deleteBox}>
                <Text style={styles.body}>This deletes your profile, everything you shared and your account, for good. Memories on this phone stay. Type your password to confirm.</Text>
                <TextInput value={password} onChangeText={setPassword} secureTextEntry placeholder="Password" placeholderTextColor={color.moonFaint} accessibilityLabel="Password to delete your account" style={styles.input} />
                <Pressable onPress={() => void deleteAccount()} disabled={!password} accessibilityRole="button" style={({ pressed }) => [styles.dangerButton, !password && styles.dim, pressed && styles.pressed]}>
                  <Text style={styles.dangerText}>Delete account forever</Text>
                </Pressable>
              </View>
            )}
          </View>
        </View>
      </ScrollView>
      <View style={[styles.back, { top: insets.top + space.sm }]}>
        <GlassCircleButton label="Back" onPress={() => goBack()}>
          <ChevronIcon color={color.moon} direction="left" size={18} />
        </GlassCircleButton>
      </View>
    </KeyboardAvoidingView>
  );
}

function Field({ label, note, good, children }: { label: string; note?: string; good?: boolean; children: React.ReactNode }) {
  return (
    <View style={styles.field}>
      <Text style={styles.section}>{label}</Text>
      {children}
      {note ? <Text style={[styles.note, good && styles.good]}>{note}</Text> : null}
    </View>
  );
}

function SwitchRow({ label, detail, value, onChange }: { label: string; detail: string; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <View style={styles.switchRow}>
      <View style={{ flex: 1, gap: 2 }}>
        <Text style={styles.switchLabel}>{label}</Text>
        <Text style={styles.note}>{detail}</Text>
      </View>
      <Switch
        value={value}
        onValueChange={(v) => {
          haptic.select();
          onChange(v);
        }}
        trackColor={{ true: color.glowDeep, false: 'rgba(255,255,255,0.15)' }}
        accessibilityLabel={label}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: color.night },
  pad: { paddingHorizontal: space.xl, gap: space.md },
  back: { position: 'absolute', left: space.lg },
  title: { ...type.largeTitle, color: color.moon },
  body: { ...type.body, color: color.moonDim },
  retry: { ...type.headline, color: color.glow },
  uploading: { ...StyleSheet.absoluteFill, backgroundColor: nightA(0.55), alignItems: 'center', justifyContent: 'center' },
  coverRow: { flexDirection: 'row', alignItems: 'center', gap: space.lg, marginTop: space.md },
  cover: { width: 112, height: 63, borderRadius: radius.md, overflow: 'hidden', backgroundColor: color.glass, borderWidth: StyleSheet.hairlineWidth, borderColor: color.hairline, alignItems: 'center', justifyContent: 'center' },
  coverHint: { ...type.caption, color: color.moonFaint },
  rowNote: { ...type.caption, color: color.moonFaint, marginTop: 2 },
  avatarRow: { flexDirection: 'row', alignItems: 'center', gap: space.lg, marginTop: space.md },
  avatar: { width: 72, height: 72, borderRadius: 36, overflow: 'hidden', backgroundColor: color.haze, alignItems: 'center', justifyContent: 'center' },
  initial: { ...type.title, color: color.moon },
  field: { gap: space.xs },
  section: { ...type.label, color: color.moonFaint, textTransform: 'uppercase', letterSpacing: 1, marginTop: space.sm },
  input: {
    ...type.body,
    color: color.moon,
    paddingHorizontal: space.lg,
    paddingVertical: space.md,
    borderRadius: radius.md,
    backgroundColor: color.glass,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: color.hairline,
  },
  handleRow: { flexDirection: 'row', alignItems: 'center' },
  at: { ...type.headline, color: color.moonDim, position: 'absolute', left: space.lg, zIndex: 1 },
  handleInput: { flex: 1, paddingLeft: space.lg + 16 },
  bio: { minHeight: 84, textAlignVertical: 'top' },
  socialRow: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  socialInput: { flex: 1 },
  problemNote: { ...type.caption, color: '#FF8A8A' },
  note: { ...type.caption, color: color.moonDim },
  good: { color: color.glow },
  switches: { gap: space.md, marginTop: space.md, padding: space.lg, borderRadius: radius.lg, backgroundColor: color.glass },
  switchRow: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  switchLabel: { ...type.headline, color: color.moon },
  problem: { ...type.label, color: color.moon },
  primary: {
    alignItems: 'center',
    paddingVertical: space.md,
    borderRadius: radius.pill,
    backgroundColor: glowA(0.3),
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: glowA(0.6),
    marginTop: space.sm,
  },
  primaryText: { ...type.headline, color: color.moon },
  rowLink: { paddingVertical: space.xs },
  link: { ...type.label, color: color.glow },
  account: { marginTop: space.xxl, gap: space.sm },
  danger: { ...type.label, color: color.stage },
  deleteBox: { gap: space.md, padding: space.lg, borderRadius: radius.lg, backgroundColor: 'rgba(255,122,198,0.08)', borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(255,122,198,0.35)' },
  dangerButton: { alignItems: 'center', paddingVertical: space.md, borderRadius: radius.pill, backgroundColor: 'rgba(255,122,198,0.25)' },
  dangerText: { ...type.headline, color: color.moon },
  dim: { opacity: 0.5 },
  pressed: { opacity: 0.8, transform: [{ scale: 0.98 }] },
});

/** A photo from the library at full size, to be framed in the app (the system's own editor crops covers square on iPhone). */
async function pickToCrop(): Promise<CropSource | undefined> {
  const r = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsEditing: false, quality: 1 });
  const a = r.canceled ? undefined : r.assets?.[0];
  if (!a) return undefined;
  if (a.width > 0 && a.height > 0) return { uri: a.uri, width: a.width, height: a.height };
  // Some browsers don't say how big the photo is: measure it.
  return new Promise((resolve) =>
    RNImage.getSize(
      a.uri,
      (width, height) => resolve({ uri: a.uri, width, height }),
      () => resolve(undefined),
    ),
  );
}
