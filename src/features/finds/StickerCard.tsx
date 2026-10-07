import { StyleSheet, Text, View } from 'react-native';
import { type as typeScale } from '../../theme/tokens';
import { FriendQR } from '../friends/FriendQR';
import { Collectible } from '../sprouts/Collectible';
import { findLink, lookOf, type Sticker } from './finds';

/** A printed sticker's size in CSS pixels (96 to the inch): 3 by 3.75 inches. */
export const STICKER_W = 288;
export const STICKER_H = 360;

/** What a printed sticker says, for the places some of them go (printed stickers are in English, like HQ). */
const INVITE: Record<string, string> = {
  portapotty: 'Scan to open the portal',
  refill: 'Scan while you fill up',
  charger: 'Scan while you charge',
  fan: 'Scan it, then clack',
  campfire: 'Scan by the fire',
  mainstage: 'Scan before the drop',
  silentdisco: 'Scan between songs',
  shuttle: 'Scan while you wait for the bus',
  hammock: 'Scan and take five',
  foodtruck: 'Scan while you wait for food',
  caretent: 'Scan, and look after each other',
  lostfound: 'Scan, then check your pockets',
  pickup: 'Scan while your ride pulls up',
  merch: 'Scan while you queue for merch',
  gates: 'Scan on your way in',
  shower: 'Scan while you wait your turn',
};
export const stickerInvite = (creature: string) => INVITE[creature] ?? 'Scan to collect';

/**
 * One printed sticker: the creature on its night tile, its name, and its
 * code on a white square (with the creature in the middle) so any phone
 * camera reads it.
 */
export function StickerCard({ sticker }: { sticker: Pick<Sticker, 'code' | 'name' | 'creature'> }) {
  const look = lookOf(sticker.creature);
  return (
    <View style={styles.sticker} accessible accessibilityLabel={`${sticker.name} sticker`}>
      <Collectible look={look} size={132} still />
      <Text style={[styles.name, { color: look.accent }]} numberOfLines={2}>
        {sticker.name}
      </Text>
      <View style={styles.qr}>
        <FriendQR value={findLink(sticker)} size={140} theme="glow" centre={(s) => <Collectible look={look} size={s} still />} />
      </View>
      <View style={styles.foot}>
        <Text style={[styles.invite, { color: look.accent }]}>{stickerInvite(sticker.creature)}</Text>
        <Text style={styles.scan}>afterglowmusic.app</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  sticker: { width: STICKER_W, height: STICKER_H, borderRadius: 28, backgroundColor: '#0A0918', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 16, paddingHorizontal: 14, borderWidth: 2, borderColor: 'rgba(169,124,255,0.45)' },
  name: { ...typeScale.headline, textAlign: 'center' },
  qr: { padding: 6, borderRadius: 14, backgroundColor: '#FBF9FF' },
  foot: { alignItems: 'center' },
  invite: { ...typeScale.caption, fontSize: 12, lineHeight: 15, fontWeight: '700', textAlign: 'center' },
  scan: { ...typeScale.caption, fontSize: 10, lineHeight: 13, color: 'rgba(243,240,255,0.7)', letterSpacing: 0.6 },
});
