import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { PageTitle } from '../../components/PageTitle';
import { SheetClose } from '../../components/SheetClose';
import { SOUNDCLOUD_PREFIX } from '../../data/catalog';
import { ago } from '../../features/crews/updates';
import { bumpCommentCount, type CommentTarget, rememberCommentCount } from '../../features/social/commentCounts';
import { useCommentCount } from '../../features/social/useCommentCount';
import { commentsLabel } from '../../features/social/copy';
import { CLIP_COMMENTS_PAGE, COMMENT_MAX, type ClipComment, type SharedMemory } from '../../features/social/models';
import { askBlock, askReport } from '../../features/social/moderation';
import { SOCIAL_ERROR_COPY, socialErrorKind } from '../../features/social/service';
import { commentProblem } from '../../features/social/validate';
import { showActionSheet, showAlert } from '../../lib/dialog';
import { haptic } from '../../lib/haptics';
import { useKeyboardInset } from '../../lib/useKeyboardInset';
import { useNow } from '../../lib/useNow';
import { useCatalog } from '../../state/catalog';
import { useClipPool } from '../../state/community';
import { useSocial } from '../../state/social';
import { color, radius, space, type, accentEdge, pageColumn } from '../../theme/tokens';
import { t } from '../../i18n';
import { SHEET_BACKGROUND } from '../../components/LiquidGlass';

/** At most this many comments on a shared video are read. */
const COMMENTS_SHOWN = 200;

/** One comment as the list shows it: on a shared video, or on a clip in Discover. */
type Row = { id: string; uid: string; handle: string; text: string; createdAt: string };

/**
 * Comments, oldest first: on a shared video (`/comments/<shared id>`), or on
 * any other clip in Discover (`/comments/<clip id>?kind=clip`: a YouTube
 * video, a SoundCloud card, a drawn stage). Write one with your profile;
 * remove your own (or any on your own video); report or block anyone else.
 * People you've blocked don't show. Online only: no signal says so.
 */
export default function CommentsScreen() {
  const { id, kind } = useLocalSearchParams<{ id: string; kind?: string }>();
  const onClip = kind === 'clip';
  const insets = useSafeAreaInsets();
  // A form sheet: the field stays just above the keyboard.
  const page = useRef<View>(null);
  const keyboard = useKeyboardInset(page);
  const social = useSocial();
  const catalog = useCatalog();
  const pool = useClipPool();
  const me = social.user?.uid;
  const now = useNow().getTime();
  const target = useMemo<CommentTarget | undefined>(() => (id ? { kind: onClip ? 'clip' : 'video', id } : undefined), [id, onClip]);
  const known = useCommentCount(target, false);
  const [video, setVideo] = useState<SharedMemory | null | undefined>();
  const [list, setList] = useState<Row[] | undefined>();
  // A clip's comments come a page at a time: there may be more after these.
  const [more, setMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  // Couldn't be read (no signal): not the same as a video that's gone.
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);

  // The clip at the top: its artist and title (a SoundCloud card is found by its artist).
  const clip = onClip && id ? pool.find(id) : undefined;
  const cardArtist = id?.startsWith(SOUNDCLOUD_PREFIX) ? id.slice(SOUNDCLOUD_PREFIX.length) : undefined;
  const clipArtist = onClip ? catalog.artist(clip?.artistId ?? cardArtist ?? '') : undefined;
  const clipTitle = clip?.title ?? (cardArtist ? t('On SoundCloud') : undefined);

  useEffect(() => {
    if (!id || !social.availability.ok || !social.user) return;
    let live = true;
    const read: Promise<{ v: SharedMemory | null; c: Row[]; full: boolean }> = onClip
      ? social.service.clipComments(id, CLIP_COMMENTS_PAGE).then((c) => ({ v: null, c, full: c.length >= CLIP_COMMENTS_PAGE }))
      : Promise.all([social.service.sharedMemory(id), social.service.comments(id, COMMENTS_SHOWN)]).then(([v, c]) => ({ v, c, full: c.length >= COMMENTS_SHOWN }));
    read.then(
      ({ v, c, full }) => {
        if (!live) return;
        setFailed(false);
        setVideo(v);
        setList(c);
        setMore(onClip && full);
        // Every one read: the count under the bubble in Discover is exactly this.
        if (!full) rememberCommentCount({ kind: onClip ? 'clip' : 'video', id }, c.length);
      },
      () => live && setFailed(true),
    );
    return () => {
      live = false;
    };
  }, [id, onClip, social.availability.ok, social.user, social.service, attempt]);

  // Where comments can be written: a clip always; a shared video once it's found.
  const open = onClip || !!video;
  const shown = (list ?? []).filter((c) => !social.blocked.has(c.uid));
  const problem = text.trim() ? commentProblem(text) : undefined;
  const total = more && known !== undefined ? Math.max(known, shown.length) : shown.length;

  const loadMore = async () => {
    const last = list?.[list.length - 1];
    if (!id || !last || loadingMore) return;
    setLoadingMore(true);
    try {
      const next = await social.service.clipComments(id, CLIP_COMMENTS_PAGE, { ...last, clipId: id } satisfies ClipComment);
      setList((l) => {
        const seen = new Set((l ?? []).map((c) => c.id));
        return [...(l ?? []), ...next.filter((c) => !seen.has(c.id))];
      });
      setMore(next.length >= CLIP_COMMENTS_PAGE);
    } catch (e) {
      showAlert(t('Couldn’t load more comments'), SOCIAL_ERROR_COPY[socialErrorKind(e)]);
    } finally {
      setLoadingMore(false);
    }
  };

  const send = async () => {
    if (!id || !open || sending || !text.trim()) return;
    if (problem) {
      showAlert(t('Can’t post that'), problem);
      return;
    }
    setSending(true);
    try {
      const c: Row = onClip || !video ? await social.service.clipComment(id, text) : await social.service.comment(video.id, video.uid, text);
      haptic.settle();
      // While older pages wait, a new one would come again with them: it shows once every earlier one is here.
      if (!more) setList((l) => [...(l ?? []), c]);
      if (target) bumpCommentCount(target, 1);
      setText('');
    } catch (e) {
      showAlert(t('Couldn’t post your comment'), SOCIAL_ERROR_COPY[socialErrorKind(e)]);
    } finally {
      setSending(false);
    }
  };

  const menu = (c: Row) => {
    const yours = c.uid === me;
    const canRemove = yours || (!onClip && video?.uid === me);
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
          (onClip ? social.service.deleteClipComment(c.id) : social.service.deleteComment(c.id))
            .then(() => {
              haptic.select();
              setList((l) => (l ?? []).filter((x) => x.id !== c.id));
              if (target) bumpCommentCount(target, -1);
            })
            .catch((e) => showAlert(t('Couldn’t delete it'), SOCIAL_ERROR_COPY[socialErrorKind(e)]));
        } else if (choice === report) askReport({ kind: onClip ? 'clipComment' : 'comment', id: c.id, ownerUid: c.uid }, social.report);
        else askBlock(c.handle, false, (on) => social.setBlocked(c.uid, on));
      },
    );
  };

  const filmedIt = (c: Row) => !onClip && c.uid === video?.uid;

  return (
    <View ref={page} onLayout={keyboard.onLayout} style={[styles.root, { paddingBottom: keyboard.inset }]}>
      <PageTitle title={t('Comments')} />
      <SheetClose />
      <View style={styles.head}>
        <Text style={styles.title} accessibilityRole="header">
          {list ? commentsLabel(total) : t('Comments')}
        </Text>
        {clipArtist ? (
          <Text style={styles.about} numberOfLines={1}>
            {clipArtist.name}
            {clipTitle ? <Text style={styles.aboutTitle}>{`  ·  ${clipTitle}`}</Text> : null}
          </Text>
        ) : null}
      </View>
      <ScrollView style={styles.scroll} contentContainerStyle={[pageColumn, styles.list]} keyboardShouldPersistTaps="handled" keyboardDismissMode="interactive">
        {!social.user ? <Text style={styles.quiet}>{t('Sign in to read and write comments.')}</Text> : null}
        {social.user && list === undefined && !failed ? <ActivityIndicator color={color.glow} /> : null}
        {!onClip && video === null ? <Text style={styles.quiet}>{t('This video isn’t available any more.')}</Text> : null}
        {failed && list === undefined ? (
          <Pressable onPress={() => setAttempt((n) => n + 1)} accessibilityRole="button" accessibilityLabel={t('Couldn’t load the comments. Try again')} hitSlop={8}>
            <Text style={styles.quiet}>{t('Couldn’t load the comments. Check the signal and tap to try again.')}</Text>
          </Pressable>
        ) : null}
        {list && !shown.length && open ? <Text style={styles.quiet}>{t('No comments yet. Say something nice.')}</Text> : null}
        {shown.map((c) => (
          <Pressable
            key={c.id}
            onLongPress={() => menu(c)}
            accessibilityRole="text"
            accessibilityLabel={`${filmedIt(c) ? t('@{handle}, who filmed it', { handle: c.handle }) : `@${c.handle}`}: ${c.text}. ${ago(c.createdAt.split('#')[0], now)}`}
            accessibilityActions={[{ name: 'more', label: c.uid === me ? t('Delete') : !onClip && video?.uid === me ? t('Delete, report or block') : t('Report or block') }]}
            onAccessibilityAction={() => menu(c)}
            style={styles.comment}
          >
            <View style={{ flex: 1 }}>
              <Text style={styles.who}>
                <Text onPress={() => router.push({ pathname: '/u/[handle]', params: { handle: c.handle } })}>@{c.handle}</Text>
                {filmedIt(c) ? <Text style={styles.author}> · {t('filmed it')}</Text> : null}
                <Text style={styles.ago}> · {ago(c.createdAt.split('#')[0], now)}</Text>
              </Text>
              <Text style={styles.text}>{c.text}</Text>
            </View>
            <Pressable onPress={() => menu(c)} accessibilityElementsHidden importantForAccessibility="no" hitSlop={10}>
              <Text style={styles.more}>•••</Text>
            </Pressable>
          </Pressable>
        ))}
        {more ? (
          <Pressable
            onPress={() => void loadMore()}
            disabled={loadingMore}
            accessibilityRole="button"
            accessibilityLabel={t('Show more comments')}
            hitSlop={8}
            style={({ pressed }) => [styles.moreRow, pressed && { opacity: 0.7 }]}
          >
            {loadingMore ? <ActivityIndicator color={color.glow} /> : <Text style={styles.moreText}>{t('Show more comments')}</Text>}
          </Pressable>
        ) : null}
      </ScrollView>
      {open || !social.user ? (
        social.profile ? (
          <View style={[styles.compose, { paddingBottom: (keyboard.inset ? 0 : insets.bottom) + space.sm }]}>
            <TextInput
              value={text}
              onChangeText={(typed) => setText(typed.slice(0, COMMENT_MAX + 20))}
              placeholder={onClip || !video ? t('Add a comment…') : video.uid === me ? t('Reply to your comments…') : t('Add a comment for @{handle}…', { handle: video.handle })}
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
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: SHEET_BACKGROUND },
  // Room on the right for the close button. Drawn over the list, so comments scroll under it, never across it.
  head: { zIndex: 1, backgroundColor: SHEET_BACKGROUND, paddingLeft: space.xl, paddingRight: space.xl + space.xxxl, paddingTop: space.xl, paddingBottom: space.md, gap: space.xs },
  title: { ...type.title, color: color.moon },
  about: { ...type.label, color: color.moon },
  aboutTitle: { color: color.moonDim, fontWeight: '400' },
  scroll: { flex: 1, overflow: 'hidden' },
  list: { paddingHorizontal: space.xl, paddingBottom: space.xl, gap: space.md },
  quiet: { ...type.body, color: color.moonDim },
  comment: { flexDirection: 'row', alignItems: 'flex-start', gap: space.md },
  who: { ...type.label, color: color.moon },
  author: { color: color.glow },
  ago: { color: color.moonFaint, fontWeight: '400' },
  text: { ...type.body, color: color.moon, marginTop: 2 },
  more: { ...type.label, color: color.moonFaint, letterSpacing: 1 },
  moreRow: { alignSelf: 'center', paddingVertical: space.sm },
  moreText: { ...type.label, color: color.glow },
  compose: { ...pageColumn, flexDirection: 'row', alignItems: 'flex-end', gap: space.sm, paddingHorizontal: space.lg, paddingTop: space.sm, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: color.hairline },
  input: { flex: 1, ...type.body, color: color.moon, maxHeight: 120, paddingHorizontal: space.md, paddingVertical: space.sm, borderRadius: radius.md, backgroundColor: color.glass },
  send: { paddingHorizontal: space.lg, paddingVertical: space.sm, borderRadius: radius.pill, backgroundColor: color.glowDeep, ...accentEdge },
  sendText: { ...type.headline, color: color.moon },
  dim: { opacity: 0.4 },
});
