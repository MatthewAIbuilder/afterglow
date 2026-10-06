import { router } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';
import { showAlert } from '../../../lib/dialog';
import { haptic } from '../../../lib/haptics';
import { cleanInstagram, httpsLink, type Org, ORG_ABOUT_MAX, ORG_NAME_MAX, ORG_TAGLINE_MAX } from '../organizers';
import { OrgLogo } from '../OrgMark';
import { space } from '../../../theme/tokens';
import { Button, Card, Field, studio } from './ui';

/** The studio's Page tab: the organizer's name, line, words and links, as their page shows them. */
export function StudioPage({ org, save }: { org: Org; save: (next: Org) => Promise<boolean> }) {
  const [p, setP] = useState({ name: org.name, tagline: org.tagline ?? '', about: org.about ?? '', website: org.website ?? '', instagram: org.instagram ?? '' });
  const [busy, setBusy] = useState(false);
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
      <Card title="Your page" sub="What people see when they open you on Afterglow. Your logo is drawn by Afterglow; to change it, request a design.">
        <View style={{ alignItems: 'center', paddingVertical: space.sm }}>
          <OrgLogo org={org} width={220} />
        </View>
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
