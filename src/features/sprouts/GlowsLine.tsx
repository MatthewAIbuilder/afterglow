import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { t, tn } from '../../i18n';
import { useSocial } from '../../state/social';
import { space, type } from '../../theme/tokens';
import type { GardenGlow } from './useGardenGlows';

/** Names shown before "and N more". */
const NAMED = 3;

/**
 * The glows visitors left on your garden: how many, and the latest few by
 * name. Nothing until someone leaves one.
 */
export function GlowsLine({ glows }: { glows: readonly GardenGlow[] }) {
  const { service } = useSocial();
  const [names, setNames] = useState<string[]>([]);
  const firstFew = glows.slice(0, NAMED).map((g) => g.from).join(',');
  useEffect(() => {
    if (!firstFew) return;
    let live = true;
    Promise.all(firstFew.split(',').map((uid) => service.profileOf(uid).catch(() => null)))
      .then((list) => live && setNames(list.flatMap((p) => (p?.handle ? [`@${p.handle}`] : []))))
      .catch(() => {});
    return () => {
      live = false;
    };
  }, [firstFew, service]);
  if (!glows.length) return null;
  const more = glows.length - names.length;
  const who = !names.length ? '' : more > 0 ? t('{names} and {n} more', { names: names.join(', '), n: more }) : names.join(t(' and '));
  return (
    <View style={styles.wrap} accessible accessibilityLabel={`${tn(glows.length, '{n} glow from visitors', '{n} glows from visitors')}${who ? `. ${who}` : ''}`}>
      <Text style={styles.count}>{`✦ ${tn(glows.length, '{n} glow from visitors', '{n} glows from visitors')}`}</Text>
      {who ? <Text style={styles.who}>{who}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', gap: 2, marginTop: space.xs },
  count: { ...type.label, color: '#FFE58A' },
  who: { ...type.caption, color: 'rgba(255,229,138,0.7)' },
});
