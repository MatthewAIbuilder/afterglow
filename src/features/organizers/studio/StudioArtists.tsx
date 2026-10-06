import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { ArtistAvatar } from '../../../components/ArtistAvatar';
import { SOUND_LABEL, SOUND_TAGS, type SoundTag } from '../../../data/models';
import { showAlert } from '../../../lib/dialog';
import { haptic } from '../../../lib/haptics';
import { useCatalog } from '../../../state/catalog';
import { ARTIST_BIO_MAX, artistIndex, cleanInstagram, cleanOrgArtist, cleanSoundcloud, httpsLink, type Org, type OrgArtist, orgActs } from '../organizers';
import { Action, Button, Card, Chip, Field, studio } from './ui';

/**
 * The studio's Artists tab: everyone on the organizer's lineups, and for
 * each a few words (a bio, their Instagram) shown on their page credited to
 * the organizer. For artists new to Afterglow the organizer also gives the
 * photo, SoundCloud and sound; for artists already on Afterglow, what
 * Afterglow has stays and fills only what's missing.
 */
export function StudioArtists({ org, save }: { org: Org; save: (next: Org) => Promise<boolean> }) {
  const catalog = useCatalog();
  const index = useMemo(() => artistIndex(catalog.artists), [catalog.artists]);
  const acts = useMemo(() => orgActs(org, index), [org, index]);
  const [editing, setEditing] = useState<{ id: string; name: string; isNew: boolean } | undefined>();

  if (editing) return <ArtistEditor org={org} who={editing} save={save} done={() => setEditing(undefined)} />;

  return (
    <View style={studio.wrap}>
      <Text style={studio.lead}>The artists on your lineups. Tap one to add a bio and links: they show on the artist’s page, credited to you, once they’re on a published event.</Text>
      {!acts.length ? <Text style={studio.muted}>Add artists to an event’s lineup and they show here.</Text> : null}
      {acts.map((a) => {
        const artist = catalog.artist(a.id);
        const words = org.artists[a.id];
        return (
          <Pressable key={a.id} onPress={() => setEditing(a)} accessibilityRole="button" accessibilityLabel={`Edit ${a.name}`} style={({ pressed }) => [studio.row, pressed && { opacity: 0.8 }]}>
            {artist ? <ArtistAvatar artist={artist} size={40} /> : <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.08)' }} />}
            <View style={{ flex: 1 }}>
              <Text style={studio.rowTitle}>{a.name}</Text>
              <Text style={studio.rowSub} numberOfLines={1}>
                {a.isNew ? 'New to Afterglow' : 'On Afterglow'} · {a.events.join(', ')}
              </Text>
            </View>
            <Text style={[studio.status, words && studio.live]}>{words ? 'Edited' : 'Add words'}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

function ArtistEditor({ org, who, save, done }: { org: Org; who: { id: string; name: string; isNew: boolean }; save: (next: Org) => Promise<boolean>; done: () => void }) {
  const catalog = useCatalog();
  const artist = catalog.artist(who.id);
  const had = org.artists[who.id];
  const [w, setW] = useState<OrgArtist>(had ?? { name: who.name });
  const [busy, setBusy] = useState(false);
  const set = <K extends keyof OrgArtist>(k: K, v: OrgArtist[K]) => setW((x) => ({ ...x, [k]: v }));
  const toggleSound = (s: SoundTag) => {
    const now = w.sounds ?? [];
    set('sounds', now.includes(s) ? now.filter((x) => x !== s) : [...now, s].slice(-3));
  };

  const commit = async () => {
    if (w.photo && !httpsLink(w.photo)) return showAlert('Check the photo link', 'It needs to start with https:// and be a picture you have the rights to.');
    if (w.soundcloud && !cleanSoundcloud(w.soundcloud)) return showAlert('Check the SoundCloud link', 'Like https://soundcloud.com/their-name');
    if (w.instagram && !cleanInstagram(w.instagram)) return showAlert('Check the Instagram name', 'Just their username, like underground.alchemy');
    const clean = cleanOrgArtist({ ...w, name: who.name });
    if (!clean) return;
    const empty = !clean.bio && !clean.photo && !clean.soundcloud && !clean.instagram && !clean.sounds?.length;
    const artists = { ...org.artists };
    if (empty) delete artists[who.id];
    else artists[who.id] = clean;
    setBusy(true);
    const ok = await save({ ...org, artists });
    setBusy(false);
    if (ok) {
      haptic.settle();
      done();
    }
  };

  return (
    <View style={studio.wrap}>
      <Action label="‹ All artists" onPress={done} a11y="Back to all artists" />
      <Card title={who.name} sub={who.isNew ? 'New to Afterglow: what you add here is their page.' : 'Already on Afterglow: your words show on their page, credited to you. A photo or SoundCloud link Afterglow already has stays.'}>
        {artist ? (
          <View style={{ alignItems: 'center', paddingVertical: 4 }}>
            <ArtistAvatar artist={artist} size={72} />
          </View>
        ) : null}
        <Field label="Bio" value={w.bio ?? ''} onChangeText={(v) => set('bio', v || undefined)} placeholder="A few lines about them" multiline maxLength={ARTIST_BIO_MAX} hint={`${(w.bio ?? '').length} of ${ARTIST_BIO_MAX}`} />
        <Field label="Instagram" value={w.instagram ?? ''} onChangeText={(v) => set('instagram', v.trim() || undefined)} placeholder="username" autoCapitalize="none" />
        {who.isNew || !artist?.imageUrl ? <Field label="Photo link" value={w.photo ?? ''} onChangeText={(v) => set('photo', v.trim() || undefined)} placeholder="https:// (a photo you have the rights to)" autoCapitalize="none" keyboardType="url" /> : null}
        {who.isNew || !catalog.soundcloudOf(who.id) ? <Field label="SoundCloud" value={w.soundcloud ?? ''} onChangeText={(v) => set('soundcloud', v.trim() || undefined)} placeholder="https://soundcloud.com/…" autoCapitalize="none" keyboardType="url" /> : null}
        {who.isNew || artist?.soundGuessed || !Object.keys(artist?.sound ?? {}).length ? (
          <>
            <Text style={studio.muted}>Their sound (up to three, the main one first)</Text>
            <View style={studio.chips}>
              {SOUND_TAGS.map((s) => (
                <Chip key={s} label={SOUND_LABEL[s]} on={w.sounds?.includes(s)} onPress={() => toggleSound(s)} />
              ))}
            </View>
          </>
        ) : null}
      </Card>
      <Button label="Save" busy={busy} onPress={() => void commit()} />
      {artist ? <Button kind="secondary" label="See their page" onPress={() => router.push({ pathname: '/artist/[id]', params: { id: who.id } })} /> : null}
    </View>
  );
}
