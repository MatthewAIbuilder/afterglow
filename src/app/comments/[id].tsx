import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { PageTitle } from '../../components/PageTitle';
import { ago } from '../../features/crews/updates';
import { commentsLabel } from '../../features/social/copy';
import { COMMENT_MAX, type Comment, type SharedMemory } from '../../features/social/models';
import { askBlock, askReport } from '../../features/social/moderation';
import { SOCIAL_ERROR_COPY, socialErrorKind } from '../../features/social/service';
import { commentProblem } from '../../features/social/validate';
import { showActionSheet, showAlert } from '../../lib/dialog';
import { haptic } from '../../lib/haptics';
import { useNow } from '../../lib/useNow';
import { useSocial } from '../../state/social';
import { color, radius, space, type } from '../../theme/tokens';
import { goBack } from '../../lib/nav';
import { t } from '../../i18n';

/** At most this many comments are read. */
const COMMENTS_SHOWN = 200;

/**
 * Comments on a shared video, oldest first. Write one with your profile;
 * remove your own, or any on your own video; report or block anyone else.
 * People you've blocked don't show.
 */
export default function CommentsScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
  const social = useSocial();
  const me = social.user?.uid;
  const now = useNow().getTime();
  const [video, setVideo] = useState<SharedMemory | null | undefined>();
  const [list, setList] = useState<Comment[] | undefined>();
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  // Couldn't be read (no signal): not the same as a video that's gone.
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (!id || !social.availability.ok || !social.user) return;
    let live = true;
    Promise.all([social.service.sharedMemory(id), social.service.comments(id, COMMENTS_SHOWN)]).then(
      ([v, c]) => {
        if (!live) return;
        setFailed(false);
        setVideo(v);
        setList(c);
      },
      () => live && setFailed(true),
    );
    return () => {
      live = false;
    };
  }, [id, social.availability.ok, social.user, social.service, attempt]);

  const shown = (list ?? []).filter((c) => !social.blocked.has(c.uid));
  const problem = text.trim() ? commentProblem(text) : undefined;

  const send = async () => {
    if (!video || sending || !text.trim()) return;
    if (problem) {
      showAlert(t('Can’t post that'), problem);
      return;
    }
    setSending(true);
    try {
      const c = await social.service.comment(video.id, video.uid, text);
      haptic.settle();
      setList((l) => [...(l ?? []), c]);
      setText('');
    } catch (e) {
      showAlert(t('Couldn’t post your comment'), SOCIAL_ERROR_COPY[socialErrorKind(e)]);
    } finally {
      setSending(false);
    }
  };

  const more = (c: Comment) => {
    const yours = c.uid === me;
    const canRemove = yours || video?.uid === me;
    // On your own video you can take down someone's comment and still report or block them.
    const del = t('Delete comment');
    const report = t('Report comment');
    const options = [...(canRemove ? [del] : []), ...(yours ? [] : [report, t('Block @{handle}', { handle: c.handle })])];
    showActionSheet(
      { title: `@${c.handle}`, options: [...options, t('Cancel')], cancelButtonIndex: options.length, destructiveButtonIndex: 0 },
      (i) => {
        const choice = options[i];
        if (!choice) return;
        if (choice === del) {
          social.service
            .deleteComment(c.id)
            .then(() => {
              haptic.select();
              setList((l) => (l ?? []).filter((x) => x.id !== c.id));
            })
            .catch((e) => showAlert(t('Couldn’t delete it'), SOCIAL_ERROR_COPY[socialErrorKind(e)]));
        } else if (choice === report) askReport({ kind: 'comment', id: c.id, ownerUid: c.uid }, social.report);
        else askBlock(c.handle, false, (on) => social.setBlocked(c.uid, on));
      },
    );
  };

  return (
    <KeyboardAvoidingView style={styles.root} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <PageTitle title={t('Comments')} />
      <View style={styles.head}>
        <Text style={styles.title} accessibilityRole="header">
          {list ? commentsLabel(shown.length) : t('Comments')}
        </Text>
        <Pressable onPress={() => goBack()} accessibilityRole="button" hitSlop={8}>
          <Text style={styles.done}>{t('Done')}</Text>
        </Pressable>
      </View>
      <ScrollView contentContainerStyle={styles.list} keyboardShouldPersistTaps="handled">
        {!social.user ? <Text style={styles.quiet}>{t('Sign in to read and write comments.')}</Text> : null}
        {social.user && list === undefined ? <ActivityIndicator color={color.glow} /> : null}
        {video === null ? <Text style={styles.quiet}>{t('This video isn’t available any more.')}</Text> : null}
        {failed && video === undefined ? (
          <Pressable onPress={() => setAttempt((n) => n + 1)} accessibilityRole="button" accessibilityLabel={t('Couldn’t load the comments. Try again')} hitSlop={8}>
            <Text style={styles.quiet}>{t('Couldn’t load the comments. Check the signal and tap to try again.')}</Text>
          </Pressable>
        ) : null}
        {list && !shown.length && video ? <Text style={styles.quiet}>{t('No comments yet. Say something nice.')}</Text> : null}
        {shown.map((c) => (
          <Pressable
            key={c.id}
            onLongPress={() => more(c)}
            accessibilityRole="text"
            accessibilityLabel={`${c.uid === video?.uid ? t('@{handle}, who filmed it', { handle: c.handle }) : `@${c.handle}`}: ${c.text}. ${ago(c.createdAt.split('#')[0], now)}`}
            accessibilityActions={[{ name: 'more', label: c.uid === me ? t('Delete') : video?.uid === me ? t('Delete, report or block') : t('Report or block') }]}
            onAccessibilityAction={() => more(c)}
            style={styles.comment}
          >
            <View style={{ flex: 1 }}>
              <Text style={styles.who}>
                <Text onPress={() => router.push({ pathname: '/u/[handle]', params: { handle: c.handle } })}>@{c.handle}</Text>
                {c.uid === video?.uid ? <Text style={styles.author}> · {t('filmed it')}</Text> : null}
                <Text style={styles.ago}> · {ago(c.createdAt.split('#')[0], now)}</Text>
              </Text>
              <Text style={styles.text}>{c.text}</Text>
            </View>
            <Pressable onPress={() => more(c)} accessibilityElementsHidden importantForAccessibility="no" hitSlop={10}>
              <Text style={styles.more}>•••</Text>
            </Pressable>
          </Pressable>
        ))}
      </ScrollView>
      {video ? (
        social.profile ? (
          <View style={[styles.compose, { paddingBottom: insets.bottom + space.sm }]}>
            <TextInput
              value={text}
              onChangeText={(typed) => setText(typed.slice(0, COMMENT_MAX + 20))}
              placeholder={video.uid === me ? t('Reply to your comments…') : t('Add a comment for @{handle}…', { handle: video.handle })}
              placeholderTextColor={color.moonFaint}
              style={styles.input}
              multiline
              accessibilityLabel={t('Write a comment')}
            />
            <Pressable
              onPress={() => void send()}
              disabled={!text.trim() || sending}
              accessibilityRole="button"
              accessibilityLabel={t('Post comment')}
              style={({ pressed }) => [styles.send, (!text.trim() || sending) && styles.dim, pressed && { opacity: 0.8 }]}
            >
              <Text style={styles.sendText}>{t('Post')}</Text>
            </Pressable>
          </View>
        ) : (
          <Pressable
            onPress={() => router.push(social.user ? '/profile-edit' : '/account')}
            accessibilityRole="button"
            style={[styles.compose, { paddingBottom: insets.bottom + space.md }]}
          >
            <Text style={styles.quiet}>{t('Create a profile to comment.')}</Text>
          </Pressable>
        )
      ) : null}
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: color.nightRaised },
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: space.xl, paddingTop: space.xl, paddingBottom: space.md },
  title: { ...type.title, color: color.moon },
  done: { ...type.headline, color: color.glow },
  list: { paddingHorizontal: space.xl, paddingBottom: space.xl, gap: space.md },
  quiet: { ...type.body, color: color.moonDim },
  comment: { flexDirection: 'row', alignItems: 'flex-start', gap: space.md },
  who: { ...type.label, color: color.moon },
  author: { color: color.glow },
  ago: { color: color.moonFaint, fontWeight: '400' },
  text: { ...type.body, color: color.moon, marginTop: 2 },
  more: { ...type.label, color: color.moonFaint, letterSpacing: 1 },
  compose: { flexDirection: 'row', alignItems: 'flex-end', gap: space.sm, paddingHorizontal: space.lg, paddingTop: space.sm, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: color.hairline },
  input: { flex: 1, ...type.body, color: color.moon, maxHeight: 120, paddingHorizontal: space.md, paddingVertical: space.sm, borderRadius: radius.md, backgroundColor: color.glass },
  send: { paddingHorizontal: space.lg, paddingVertical: space.sm, borderRadius: radius.pill, backgroundColor: color.glowDeep },
  sendText: { ...type.headline, color: color.moon },
  dim: { opacity: 0.4 },
});
