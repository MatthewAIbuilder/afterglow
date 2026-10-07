import { router } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';
import { showAlert } from '../../../lib/dialog';
import { haptic } from '../../../lib/haptics';
import { cleanInstagram, httpsLink, type Org, ORG_ABOUT_MAX, ORG_NAME_MAX, ORG_TAGLINE_MAX } from '../organizers';
import { OrgDot, OrgLogo } from '../OrgMark';
import * as ImagePicker from 'expo-image-picker';
import { useSocial } from '../../../state/social';
import { rememberOrg } from '../../../state/orgs';
import { refreshOrgs } from '../OrgSync';
import { socialErrorKind, SOCIAL_ERROR_COPY } from '../../social/service';
import { space } from '../../../theme/tokens';
import { Button, Card, Field, studio } from './ui';

/** The studio's Page tab: the organizer's name, line, words and links, as their page shows them. */
export function StudioPage({ org, save }: { org: Org; save: (next: Org) => Promise<boolean> }) {
  const [p, setP] = useState({ name: org.name, tagline: org.tagline ?? '', about: org.about ?? '', website: org.website ?? '', instagram: org.instagram ?? '' });
  const [busy, setBusy] = useState(false);
  const social = useSocial();
  const [busyImage, setBusyImage] = useState<'logo' | 'icon' | undefined>();
  // A picture from the phone (or computer): the logo whole, the icon cropped square.
  const change = async (kind: 'logo' | 'icon') => {
    if (busyImage) return;
    const r = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsEditing: kind === 'icon', ...(kind === 'icon' ? { aspect: [1, 1] as [number, number] } : {}), quality: 1 }).catch(() => undefined);
    const uri = r && !r.canceled ? r.assets?.[0]?.uri : undefined;
    if (!uri) return;
    setBusyImage(kind);
    try {
      const url = await social.service.setOrgImage(org.id, kind, uri);
      rememberOrg({ ...org, ...(kind === 'logo' ? { logoUrl: url } : { iconUrl: url }) });
      refreshOrgs();
      haptic.settle();
    } catch (e) {
      showAlert('Couldn’t upload that', SOCIAL_ERROR_COPY[socialErrorKind(e)]);
    } finally {
      setBusyImage(undefined);
    }
  };
  const reset = () =>
    showAlert('Go back to the original logo and icon?', 'Your uploaded ones stop showing.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Go back',
        onPress: () =>
          void Promise.all([org.logoUrl ? social.service.setOrgImage(org.id, 'logo', null) : undefined, org.iconUrl ? social.service.setOrgImage(org.id, 'icon', null) : undefined])
            .then(() => {
              const { logoUrl: _l, iconUrl: _i, ...rest } = org;
              rememberOrg(rest as Org);
              refreshOrgs();
            })
            .catch((e) => showAlert('Couldn’t change that', SOCIAL_ERROR_COPY[socialErrorKind(e)])),
      },
    ]);
  const set = (k: keyof typeof p, v: string) => setP((x) => ({ ...x, [k]: v }));
  const commit = async () => {
    if (!p.name.trim()) return showAlert('Your page needs a name', '');
    if (p.website.trim() && !httpsLink(p.website)) return showAlert('Check the website', 'It needs to start with https://');
    if (p.instagram.trim() && !cleanInstagram(p.instagram)) return showAlert('Check the Instagram name', 'Just the username, like underground.alchemy');
    setBusy(true);
    const ok = await save({
      ...org,
      name: p.name.trim(),
      tagline: p.tagline.trim() || undefined,
      about: p.about.trim() || undefined,
      website: httpsLink(p.website),
      instagram: cleanInstagram(p.instagram),
    });
    setBusy(false);
    if (ok) haptic.settle();
  };
  return (
    <View style={studio.wrap}>
      <Card title="Logo and icon" sub="Your logo shows on your page, your profile and your events; your icon (square) in the small round places. Best: white or light on a clear background, as a PNG.">
        <View style={{ alignItems: 'center', gap: space.md, paddingVertical: space.sm }}>
          <OrgLogo org={org} width={240} />
          <OrgDot org={org} size={72} />
        </View>
        <Button kind="secondary" label={busyImage === 'logo' ? 'Uploading…' : 'Change logo'} onPress={() => void change('logo')} />
        <Button kind="secondary" label={busyImage === 'icon' ? 'Uploading…' : 'Change icon'} onPress={() => void change('icon')} />
        {org.logoUrl || org.iconUrl ? <Button kind="danger" label="Go back to the original logo and icon" onPress={reset} /> : null}
      </Card>
      <Card title="Your page" sub="What people see when they open you on Afterglow.">
        <Field label="Name" value={p.name} onChangeText={(v) => set('name', v)} maxLength={ORG_NAME_MAX} />
        <Field label="Line under your name" value={p.tagline} onChangeText={(v) => set('tagline', v)} placeholder="Like After parties" maxLength={ORG_TAGLINE_MAX} />
        <Field label="About" value={p.about} onChangeText={(v) => set('about', v)} placeholder="Who you are and what your nights are like" multiline maxLength={ORG_ABOUT_MAX} />
        <Field label="Website" value={p.website} onChangeText={(v) => set('website', v)} placeholder="https://" autoCapitalize="none" keyboardType="url" />
        <Field label="Instagram" value={p.instagram} onChangeText={(v) => set('instagram', v)} placeholder="username" autoCapitalize="none" />
      </Card>
      <Button label="Save" busy={busy} onPress={() => void commit()} />
      <Button kind="secondary" label="See your page" onPress={() => router.push({ pathname: '/org/[id]', params: { id: org.id } })} />
    </View>
  );
}
