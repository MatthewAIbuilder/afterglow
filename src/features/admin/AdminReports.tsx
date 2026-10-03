import { router } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { FilterChips } from '../../components/FilterChips';
import { showAlert } from '../../lib/dialog';
import { haptic } from '../../lib/haptics';
import { useNow } from '../../lib/useNow';
import { useSocial } from '../../state/social';
import { color, radius, space, type } from '../../theme/tokens';
import { REPORT_REASONS, type ReportRecord } from '../social/models';
import { agoShort } from './admin';

/**
 * What people reported, newest first: a video, a comment or a profile, why,
 * and their note. Look at it, take a video or comment down (asked first),
 * or mark the report dealt with.
 */
export function AdminReports() {
  const { service } = useSocial();
  const [list, setList] = useState<ReportRecord[] | undefined>();
  const [failed, setFailed] = useState(false);
  const [filter, setFilter] = useState<'open' | 'resolved'>('open');
  const now = useNow().getTime();
  const load = useCallback(async () => {
    try {
      setList(await service.reports(300));
      setFailed(false);
    } catch {
      setFailed(true);
    }
  }, [service]);
  useEffect(() => {
    void Promise.resolve().then(load);
  }, [load]);

  if (!list) return failed ? <Text style={styles.empty}>Couldn’t load reports. Check the signal and try again.</Text> : <ActivityIndicator color={color.glow} style={{ marginTop: space.xxl }} />;
  const shown = list.filter((r) => r.status === filter);
  const resolve = async (r: ReportRecord) => {
    try {
      await service.resolveReport(r.id);
      haptic.select();
      void load();
    } catch {
      showAlert('Couldn’t update it', 'Check the signal and try again.');
    }
  };
  // A crew chat message: only the support account can read it, for the review.
  const readMessage = async (r: ReportRecord) => {
    try {
      const m = await service.reportedMessage(r.targetId);
      showAlert('The message', m ? `“${m.text}”` : 'It’s already gone.');
    } catch {
      showAlert('Couldn’t read it', 'Check the signal and try again.');
    }
  };
  const takeDown = (r: ReportRecord) => {
    if (r.kind === 'profile') return;
    showAlert(r.kind === 'memory' ? 'Take this video down?' : r.kind === 'chat' ? 'Remove this message?' : 'Remove this comment?', 'It’s removed for everyone, and the report is marked dealt with.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Take it down',
        style: 'destructive',
        onPress: async () => {
          try {
            await service.takeDown(r.kind as 'memory' | 'comment' | 'chat', r.targetId);
            await service.resolveReport(r.id);
            haptic.settle();
            void load();
          } catch {
            showAlert('Couldn’t take it down', 'It may already be gone, or the signal dropped.');
          }
        },
      },
    ]);
  };
  return (
    <View style={styles.wrap}>
      <FilterChips
        inset={space.lg}
        chips={(['open', 'resolved'] as const).map((f) => ({ key: f, label: f === 'open' ? 'To look at' : 'Dealt with', count: list.filter((r) => r.status === f).length, accessibilityLabel: `${f === 'open' ? 'Reports to look at' : 'Reports dealt with'}` }))}
        value={filter}
        onChange={(k) => setFilter((k as 'open' | 'resolved' | undefined) ?? 'open')}
      />
      {shown.length ? (
        shown.map((r) => (
          <View key={r.id} style={[styles.card, r.status === 'open' && styles.cardOpen]}>
            <View style={styles.head}>
              <Text style={styles.what}>{r.kind === 'memory' ? 'A video' : r.kind === 'comment' ? 'A comment' : r.kind === 'chat' ? 'A crew chat message' : 'A profile'}</Text>
              <Text style={styles.when}>{agoShort(r.createdAt, now)}</Text>
            </View>
            <Text style={styles.reason}>{REPORT_REASONS.find((x) => x.key === r.reason)?.label}</Text>
            {r.note ? <Text style={styles.note}>“{r.note}”</Text> : null}
            <View style={styles.actions}>
              {r.kind === 'memory' ? (
                <Pressable onPress={() => router.push({ pathname: '/shared/[id]', params: { id: r.targetId } })} accessibilityRole="button" hitSlop={6}>
                  <Text style={styles.link}>Look at it</Text>
                </Pressable>
              ) : null}
              {r.kind === 'chat' ? (
                <Pressable onPress={() => void readMessage(r)} accessibilityRole="button" accessibilityLabel="Read the message" hitSlop={6}>
                  <Text style={styles.link}>Read it</Text>
                </Pressable>
              ) : null}
              {r.kind !== 'profile' && r.status === 'open' ? (
                <Pressable onPress={() => takeDown(r)} accessibilityRole="button" accessibilityLabel={r.kind === 'memory' ? 'Take the video down' : r.kind === 'chat' ? 'Remove the message' : 'Remove the comment'} hitSlop={6}>
                  <Text style={styles.danger}>Take it down</Text>
                </Pressable>
              ) : null}
              {r.status === 'open' ? (
                <Pressable onPress={() => void resolve(r)} accessibilityRole="button" accessibilityLabel="Mark the report dealt with" hitSlop={6}>
                  <Text style={styles.linkDim}>Dealt with</Text>
                </Pressable>
              ) : null}
            </View>
          </View>
        ))
      ) : (
        <Text style={styles.empty}>{filter === 'open' ? 'Nothing reported. All clear.' : 'Nothing here yet.'}</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: space.md },
  empty: { ...type.body, color: color.moonDim, textAlign: 'center', marginTop: space.xl, paddingHorizontal: space.xl },
  card: { marginHorizontal: space.lg, padding: space.lg, gap: space.xs, borderRadius: radius.lg, backgroundColor: color.glass, borderWidth: StyleSheet.hairlineWidth, borderColor: color.hairline },
  cardOpen: { borderColor: 'rgba(255,140,140,0.5)', borderWidth: 1 },
  head: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' },
  what: { ...type.headline, color: color.moon },
  when: { ...type.caption, color: color.moonFaint },
  reason: { ...type.label, color: 'rgba(255,170,170,0.95)' },
  note: { ...type.body, color: color.moonDim },
  actions: { flexDirection: 'row', gap: space.xl, marginTop: space.sm },
  link: { ...type.label, color: color.glow },
  linkDim: { ...type.label, color: color.moonDim },
  danger: { ...type.label, color: 'rgba(255,150,150,0.95)' },
});
