import { Pressable, StyleSheet, Text, View } from 'react-native';
import { BadgesGrid } from '../badges/BadgesGrid';
import { haptic } from '../../lib/haptics';
import { GlowLevelCard } from '../quests/GlowLevelCard';
import { useCatalog } from '../../state/catalog';
import { color, space, type } from '../../theme/tokens';
import { type Milestone, milestoneKey, pinKey, throwbackKey } from './milestones';
import { useMemoryPicker } from '../memories/useAddMemory';
import { MilestonesSection, NewTag } from './Milestones';
import type { ProfileBadges } from './useProfileBadges';

/** "You unlocked 2 badges · Claim": shown while anything earned is waiting to be claimed. */
export function ClaimBanner({ b }: { b: ProfileBadges }) {
  const n = b.unclaimedKeys.length;
  if (!n) return null;
  const what = n === 1 ? 'a badge' : `${n} badges`;
  return (
    <Pressable
      onPress={() => {
        haptic.tap();
        b.claimNext();
      }}
      accessibilityRole="button"
      accessibilityLabel={`You unlocked ${what}. Claim`}
      style={({ pressed }) => [styles.unlocked, pressed && { opacity: 0.85, transform: [{ scale: 0.98 }] }]}
    >
      <NewTag inline />
      <Text style={styles.unlockedText}>You unlocked {what}</Text>
      <Text style={styles.unlockedClaim}>Claim</Text>
    </Pressable>
  );
}

/**
 * Your badges: festival pins, side quests and milestones, each tappable for
 * what it is, with New on the ones to claim. At a festival (`questsFirst`)
 * side quests lead, since that's where they're earned.
 */
export function BadgesPanel({ b, uid, width, questsFirst = false }: { b: ProfileBadges; uid?: string; width: number; questsFirst?: boolean }) {
  const catalog = useCatalog();
  const pick = useMemoryPicker();
  const isNewMark = (id: Milestone['id']) => b.unclaimedKeys.includes(milestoneKey(id));
  const quests = (
    <View style={styles.section}>
      <MilestonesSection
        title="Side quests"
        intro="Meet people, look out for your crew, catch the sunrise. Done at your festivals, on their nights."
        showNext={false}
        list={b.questList}
        isNew={(m) => isNewMark(m.id)}
        onClaim={(m) => b.setUnlock({ kind: 'milestone', milestone: m })}
      />
    </View>
  );
  return (
    <>
      <GlowLevelCard />
      {questsFirst ? quests : null}
      <Text style={styles.pinsHead}>Festival pins</Text>
      <BadgesGrid
        badges={b.badges}
        toCollect={b.collect}
        festivalOf={catalog.festival}
        uid={uid}
        width={width}
        mine
        isNew={(id) => b.unclaimedKeys.includes(pinKey(id))}
        onClaim={(f) => b.setUnlock({ kind: 'pin', festival: f })}
        throwbacks={b.throwbacks}
        isNewThrowback={(key) => b.unclaimedKeys.includes(throwbackKey(key))}
        onClaimThrowback={(past) => b.setUnlock({ kind: 'throwback', past })}
        onAddPast={() => void pick('library')}
      />
      {questsFirst ? null : quests}
      <View style={styles.section}>
        <MilestonesSection list={b.marks} isNew={(m) => isNewMark(m.id)} onClaim={(m) => b.setUnlock({ kind: 'milestone', milestone: m })} />
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  section: { marginTop: space.xl },
  unlocked: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    marginHorizontal: space.xl,
    marginTop: space.lg,
    paddingHorizontal: space.lg,
    paddingVertical: space.md,
    borderRadius: 999,
    backgroundColor: 'rgba(255,227,138,0.10)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,227,138,0.55)',
  },
  unlockedText: { ...type.label, color: color.moon, flex: 1 },
  unlockedClaim: { ...type.headline, color: '#FFE38A' },
  pinsHead: { ...type.label, color: color.moonFaint, textTransform: 'uppercase', letterSpacing: 0.8, marginTop: space.lg, marginHorizontal: space.lg + space.xs },
});
