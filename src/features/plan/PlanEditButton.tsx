import { Pressable, StyleSheet } from 'react-native';
import { MoreIcon } from '../../components/TabIcons';
import type { Artist } from '../../data/types';
import { showActionSheet } from '../../lib/dialog';
import { haptic } from '../../lib/haptics';
import { usePlan } from '../../state/plan';
import { color } from '../../theme/tokens';
import { t } from '../../i18n';

/**
 * ••• beside a set or pick in your plan: make it yours. "Go with this one"
 * (when it's up against something) makes it your first choice; "Not this one"
 * takes it out of your plan here. Planning only: their match stays as it is.
 */
export function PlanEditButton({
  artist,
  festivalId,
  over,
  size = 16,
}: {
  artist: Artist;
  festivalId: string;
  /** What it's up against at the same time (artist ids), when anything is. */
  over?: readonly string[];
  size?: number;
}) {
  const { editsAt, goWith, takeOut } = usePlan();
  const isFirst = editsAt(festivalId).first.has(artist.id);
  const canGo = !!over?.length && !isFirst;
  return (
    <Pressable
      onPress={() => {
        haptic.select();
        const options = [...(canGo ? [t('Go with this one')] : []), t('Not this one'), t('Cancel')];
        const outAt = canGo ? 1 : 0;
        showActionSheet(
          {
            title: artist.name,
            message: canGo ? t('Make this your pick when sets clash, or take it out of your plan.') : t('Take it out of your plan here. Their match stays as it is.'),
            options,
            cancelButtonIndex: options.length - 1,
            destructiveButtonIndex: outAt,
          },
          (i) => {
            if (canGo && i === 0) {
              haptic.tap();
              goWith(festivalId, artist.id, over);
            } else if (i === outAt) {
              haptic.tap();
              takeOut(festivalId, artist.id);
            }
          },
        );
      }}
      hitSlop={8}
      accessibilityRole="button"
      accessibilityLabel={t('Change {artist} in your plan', { artist: artist.name })}
      style={({ pressed }) => [styles.hit, pressed && { opacity: 0.6 }]}
    >
      <MoreIcon color={color.moonFaint} size={size} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  hit: { width: 32, height: 28, alignItems: 'center', justifyContent: 'center' },
});
