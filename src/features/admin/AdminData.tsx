import * as DocumentPicker from 'expo-document-picker';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Linking, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { FilterChips } from '../../components/FilterChips';
import { SearchField } from '../../components/SearchField';
import { parseCatalogFile } from '../../data/file';
import { buildCatalog } from '../../data/merge';
import type { CatalogSnapshot, Festival } from '../../data/models';
import { showAlert } from '../../lib/dialog';
import { haptic } from '../../lib/haptics';
import { shareMessage } from '../../lib/share';
import { useNow } from '../../lib/useNow';
import { useCatalog } from '../../state/catalog';
import { useLivePatches } from '../../state/livePatches';
import { useSocial } from '../../state/social';
import { color, radius, space, type } from '../../theme/tokens';
import { formatTime } from '../festivals/format';
import { matchesName } from '../festivals/search';
import { DROP_FILES_MAX, type Drop } from '../social/models';
import { agoShort } from './admin';
import { buildDraft, type Draft, draftLine, type LineupMode } from './draft';
import { claudeBrief, DROP_STATUS_LABEL, dropFor, fileSummary, fileSummaryLine, looksLikeCatalogFile, sizeLabel } from './drops';
import { refreshLivePatches } from './LivePatchSync';
import { canReadPhotos, readPhotoText } from './readPhoto';
import { readSetList } from './setlist';

type Picked = { uri: string; name: string; type: string; size?: number };
type Review = { title: string; festivalId: string; file: string; line: string; notes: string[]; unread: string[]; preview: string[]; problems: string[]; ok: boolean; dropId?: string };

const today = () => new Date().toISOString().slice(0, 10);

/**
 * HQ's Data tab: the one place to throw lineups and set times at Afterglow.
 * Pick the festival (or name a new one), then paste text, add pictures or
 * PDFs, or paste an update a Claude Code session gave back. Text is read
 * here and now into a draft to check and publish; pictures and PDFs go to
 * the inbox, with one tap to hand them to a Claude Code session. Published
 * updates reach everyone's app within minutes, and can be taken down.
 */
export function AdminData() {
  const social = useSocial();
  const catalog = useCatalog();
  const patches = useLivePatches();
  const now = useNow();

  // Which festival this is for.
  const [query, setQuery] = useState('');
  const [festival, setFestival] = useState<Festival | undefined>();
  const [fresh, setFresh] = useState(false);
  const [newName, setNewName] = useState('');
  const [newStart, setNewStart] = useState('');
  const [newEnd, setNewEnd] = useState('');
  const [newWhere, setNewWhere] = useState('');

  const [text, setText] = useState('');
  const [files, setFiles] = useState<Picked[]>([]);
  const [note, setNote] = useState('');
  const [lineupMode, setLineupMode] = useState<LineupMode>('add');
  const [review, setReview] = useState<Review | undefined>();
  const [fromDrop, setFromDrop] = useState<string | undefined>();
  const [busy, setBusy] = useState<string | undefined>();
  const [saved, setSaved] = useState<Drop | undefined>();

  const [drops, setDrops] = useState<Drop[] | undefined>();
  const loadDrops = useCallback(() => {
    social.service
      .drops(50)
      .then(setDrops)
      .catch(() => setDrops((d) => d ?? []));
  }, [social.service]);
  useEffect(() => {
    void Promise.resolve().then(loadDrops);
  }, [loadDrops]);

  const matches = useMemo(() => (query.trim() ? catalog.festivals.filter((f) => matchesName(f.name, query)).slice(0, 6) : []), [catalog.festivals, query]);
  const nameOf = (id?: string) => (id ? catalog.festival(id)?.name : undefined);
  const snapshot = useMemo<CatalogSnapshot>(() => ({ artists: catalog.artists, festivals: catalog.festivals, clips: catalog.clips, similarities: catalog.similarities }), [catalog]);
  const target = festival ? { kind: 'existing' as const, festival } : fresh && newName.trim() ? { kind: 'new' as const, name: newName, start: day(newStart), end: day(newEnd), location: newWhere } : undefined;

  /** Check an update exactly as the app will read it. */
  const check = (file: string, title: string, extra: Pick<Review, 'line' | 'notes' | 'unread' | 'preview'>): Review => {
    const parsed = parseCatalogFile(file);
    const built = buildCatalog(snapshot, parsed);
    const s = fileSummary(parsed, catalog);
    return { title, festivalId: s.festivalId ?? '', file, problems: built.problems, ok: built.usedFile && !!s.festivalId, ...extra, ...(fromDrop ? { dropId: fromDrop } : {}) };
  };

  const read = () => {
    haptic.select();
    if (looksLikeCatalogFile(text)) {
      const parsed = parseCatalogFile(text);
      const s = fileSummary(parsed, catalog);
      setReview(check(text.trim(), `${s.festivalName ?? 'Update'}${s.sets ? ', set times' : ', lineup'}`, { line: fileSummaryLine(s), notes: [], unread: [], preview: [] }));
      return;
    }
    if (!target) {
      showAlert('Which festival is it for?', 'Pick a festival, or choose New festival and give it a name.');
      return;
    }
    const known = target.kind === 'existing' ? target.festival : undefined;
    const list = readSetList(text, { days: known?.days, stages: known?.stages.map((s) => s.name) });
    if (!list.acts.length) {
      showAlert('Nothing to read', 'Paste one act per line, or set times like "10:00 PM SUBTRONICS", with day headings like "Friday".');
      return;
    }
    const draft: Draft = buildDraft(list, target, catalog.artists, { lineup: lineupMode, today: today(), festivalIds: catalog.festivals.map((f) => f.id) });
    const preview = list.sets.slice(0, 40).map((s) => `${s.day ? `${s.day.slice(0, 3)} ` : ''}${formatTime(s.start)}  ${s.name}${s.stage ? ` · ${s.stage}` : ''}`);
    if (!list.sets.length) preview.push(...list.acts.slice(0, 40).map((a) => `${a.name}${a.days.length ? ` · ${a.days.join(', ')}` : ''}`));
    setReview(
      check(JSON.stringify(draft.file), `${draft.festivalName}${draft.sets ? ', set times' : ', lineup'}`, {
        line: draftLine(draft),
        notes: [...draft.notes, ...(draft.added.length ? [`New to Afterglow: ${draft.added.slice(0, 12).join(', ')}${draft.added.length > 12 ? ` and ${draft.added.length - 12} more` : ''}.`] : [])],
        unread: list.unread,
        preview,
      }),
    );
  };

  // A photo of set times (or a lineup), read in the browser into the text box, to check before reading.
  const [reading, setReading] = useState<number | undefined>();
  const readPhoto = async () => {
    const r = await DocumentPicker.getDocumentAsync({ type: ['image/*'], copyToCacheDirectory: true }).catch(() => undefined);
    const asset = r && !r.canceled ? r.assets[0] : undefined;
    if (!asset) return;
    haptic.select();
    setReading(0);
    try {
      const photo = (asset as { file?: Blob }).file ?? asset.uri;
      const known = festival?.stages.map((st) => st.name) ?? [];
      const found = await readPhotoText(photo, known, (p) => setReading(p));
      if (!found.trim()) {
        showAlert('No text found', 'Try a sharper picture, or crop it to one day or one stage.');
        return;
      }
      setText((t) => (t.trim() ? `${t.trim()}\n\n${found}` : found));
      setReview(undefined);
      haptic.settle();
    } catch (e) {
      showAlert('Couldn’t read the photo', e instanceof Error ? e.message : 'Try again.');
    } finally {
      setReading(undefined);
    }
  };

  const pick = async () => {
    const r = await DocumentPicker.getDocumentAsync({ type: ['image/*', 'application/pdf', 'text/plain'], multiple: true, copyToCacheDirectory: true }).catch(() => undefined);
    if (!r || r.canceled) return;
    setFiles((f) => [...f, ...r.assets.map((a) => ({ uri: a.uri, name: a.name, type: a.mimeType ?? '', size: a.size }))].slice(0, DROP_FILES_MAX));
  };

  const save = async () => {
    if (!files.length && !text.trim()) return;
    setBusy('save');
    try {
      const d = await social.service.addDrop({ festivalId: festival?.id, festivalName: !festival && fresh ? newName : undefined, note, text, files });
      haptic.settle();
      setSaved(d);
      setFiles([]);
      setNote('');
      loadDrops();
    } catch {
      showAlert('Couldn’t save it', 'Check the signal and try again. A file over 25 MB is too big.');
    } finally {
      setBusy(undefined);
    }
  };

  const publish = () => {
    if (!review?.ok) return;
    showAlert(`Publish “${review.title}”?`, 'It reaches everyone’s app within minutes. You can take it down from the list below.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Publish',
        onPress: async () => {
          setBusy('publish');
          try {
            await social.service.publishPatch({ title: review.title, festivalId: review.festivalId, file: review.file, ...(review.dropId ? { dropId: review.dropId } : {}) });
            if (review.dropId) await social.service.setDropStatus(review.dropId, 'done').catch(() => {});
            haptic.settle();
            refreshLivePatches();
            setReview(undefined);
            setText('');
            setFromDrop(undefined);
            loadDrops();
            showAlert('Published', 'Everyone sees it the next time they open the app.');
          } catch {
            showAlert('Couldn’t publish it', 'Check the signal and try again. If it keeps happening, the newest database rules may not be deployed yet.');
          } finally {
            setBusy(undefined);
          }
        },
      },
    ]);
  };

  const handToClaude = async (d: Drop) => {
    const r = await shareMessage(claudeBrief(d, nameOf(d.festivalId)), 'For Claude');
    if (r !== 'dismissed' && r !== 'failed' && d.status === 'waiting') {
      await social.service.setDropStatus(d.id, 'sent').catch(() => {});
      loadDrops();
    }
  };

  return (
    <View style={styles.wrap}>
      <Text style={styles.lead}>Throw lineups and set times at Afterglow: paste text to read it now, or add pictures and PDFs for a Claude Code session.</Text>

      {/* 1. Which festival. */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Which festival?</Text>
        {festival ? (
          <View style={styles.chosen}>
            <Text style={styles.chosenName} numberOfLines={1}>
              {festival.name}
            </Text>
            <Text style={styles.small}>
              {festival.dates} · {festival.lineup.length} acts{festival.sets?.length ? ` · ${festival.sets.length} set times` : ''}
            </Text>
            <Pressable onPress={() => setFestival(undefined)} accessibilityRole="button" hitSlop={8}>
              <Text style={styles.link}>Change</Text>
            </Pressable>
          </View>
        ) : fresh ? (
          <View style={styles.form}>
            <Field value={newName} onChange={setNewName} label="Festival name" placeholder="Festival name, like Lost Lands 2027" />
            <View style={styles.row2}>
              <Field value={newStart} onChange={setNewStart} label="First day" placeholder="First day 2027-09-17" />
              <Field value={newEnd} onChange={setNewEnd} label="Last day" placeholder="Last day 2027-09-19" />
            </View>
            <Field value={newWhere} onChange={setNewWhere} label="Where" placeholder="Where, like Legend Valley, Thornville, Ohio" />
            <Pressable onPress={() => setFresh(false)} accessibilityRole="button">
              <Text style={styles.link}>Pick one on Afterglow instead</Text>
            </Pressable>
          </View>
        ) : (
          <>
            <SearchField value={query} onChange={setQuery} placeholder="Find a festival" label="Find a festival" />
            {matches.map((f) => (
              <Pressable
                key={f.id}
                onPress={() => {
                  haptic.select();
                  setFestival(f);
                  setQuery('');
                }}
                accessibilityRole="button"
                style={({ pressed }) => [styles.option, pressed && styles.pressed]}
              >
                <Text style={styles.optionName}>{f.name}</Text>
                <Text style={styles.small}>{f.dates}</Text>
              </Pressable>
            ))}
            <Pressable onPress={() => setFresh(true)} accessibilityRole="button" style={styles.option}>
              <Text style={styles.link}>+ New festival</Text>
            </Pressable>
          </>
        )}
      </View>

      {/* 2. What to add. */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Paste text</Text>
        <Text style={styles.small}>A lineup (one act per line), set times (“Friday”, then “10:00 PM SUBTRONICS @ Bass Tent”), or an update Claude gave you.</Text>
        <TextInput
          value={text}
          onChangeText={(t) => {
            setText(t);
            setReview(undefined);
          }}
          multiline
          placeholder={'Friday\nMain Stage\n9:00 PM ILLENIUM\n10:30 PM SUBTRONICS'}
          placeholderTextColor={color.moonFaint}
          accessibilityLabel="Lineup or set times as text"
          style={[styles.input, styles.area]}
          autoCapitalize="none"
          autoCorrect={false}
        />
        {festival && !looksLikeCatalogFile(text) ? (
          <FilterChips
            inset={0}
            value={lineupMode}
            onChange={(k) => setLineupMode((k as LineupMode) ?? 'add')}
            chips={[
              { key: 'add', label: 'Add to the lineup', accessibilityLabel: 'Add these acts to the lineup' },
              { key: 'replace', label: 'Replace the lineup', accessibilityLabel: 'Make the lineup exactly this list' },
            ]}
          />
        ) : null}
        {canReadPhotos ? (
          <>
            <Button
              label={reading !== undefined ? `Reading the photo… ${Math.round(reading * 100)}%` : 'Read a photo of set times'}
              onPress={() => void readPhoto()}
              disabled={reading !== undefined}
            />
            <Text style={styles.small}>
              Its text lands in the box above to check first. Grids are read stage by stage; for a big one, crop it to one day at a time and read each picture in turn.
            </Text>
          </>
        ) : (
          <Text style={styles.small}>To read a photo of set times, open HQ on the website on a computer.</Text>
        )}
        <Button label="Read the text" onPress={read} disabled={!text.trim()} primary />

        <Text style={[styles.cardTitle, { marginTop: space.lg }]}>Pictures and PDFs</Text>
        <Text style={styles.small}>Lineup posters and set-time pictures. They go to the inbox below, ready to hand to a Claude Code session.</Text>
        {files.map((f, i) => (
          <View key={`${f.uri}-${i}`} style={styles.fileRow}>
            <Text style={styles.fileName} numberOfLines={1}>
              {f.name}
            </Text>
            {f.size ? <Text style={styles.small}>{sizeLabel(f.size)}</Text> : null}
            <Pressable onPress={() => setFiles((x) => x.filter((_, k) => k !== i))} accessibilityRole="button" accessibilityLabel={`Remove ${f.name}`} hitSlop={8}>
              <Text style={styles.remove}>×</Text>
            </Pressable>
          </View>
        ))}
        <Button label="+ Add pictures or PDFs" onPress={() => void pick()} disabled={files.length >= DROP_FILES_MAX} />
        <Field value={note} onChange={setNote} label="Note" placeholder="A note, like “Weekend 2 set times”" />
        <Button label={busy === 'save' ? 'Saving…' : 'Save to the inbox'} onPress={() => void save()} disabled={(!files.length && !text.trim()) || !!busy} />
        {saved ? (
          <View style={styles.savedNote}>
            <Text style={styles.small}>Saved to the inbox. Hand it to a Claude Code session when you’re ready.</Text>
            <Pressable onPress={() => void handToClaude(saved)} accessibilityRole="button">
              <Text style={styles.link}>Copy for Claude</Text>
            </Pressable>
          </View>
        ) : null}
      </View>

      {/* 3. The draft, checked. */}
      {review ? (
        <View style={[styles.card, styles.reviewCard]}>
          <Text style={styles.kicker}>Check before publishing</Text>
          <Text style={styles.cardTitle}>{review.title}</Text>
          <Text style={styles.body}>{review.line}</Text>
          {review.notes.map((n) => (
            <Text key={n} style={styles.warn}>
              {n}
            </Text>
          ))}
          {review.unread.length ? (
            <Text style={styles.small}>
              Couldn’t read: {review.unread.slice(0, 8).map((u) => `“${u}”`).join(', ')}
              {review.unread.length > 8 ? ` and ${review.unread.length - 8} more` : ''}
            </Text>
          ) : null}
          {review.preview.length ? (
            <View style={styles.preview}>
              {review.preview.map((p, i) => (
                <Text key={i} style={styles.previewLine} numberOfLines={1}>
                  {p}
                </Text>
              ))}
            </View>
          ) : null}
          {review.problems.slice(0, 6).map((p) => (
            <Text key={p} style={styles.warn}>
              {p}
            </Text>
          ))}
          {!review.ok ? <Text style={styles.warn}>This can’t be published as it is.</Text> : null}
          <View style={styles.buttons}>
            <Button label="Cancel" onPress={() => setReview(undefined)} />
            <Button label={busy === 'publish' ? 'Publishing…' : 'Publish to everyone'} onPress={publish} disabled={!review.ok || !!busy} primary />
          </View>
          <Pressable onPress={() => void shareMessage(JSON.stringify(JSON.parse(review.file), null, 2), 'Catalogue update')} accessibilityRole="button">
            <Text style={styles.link}>Copy as a catalogue file (to keep it in catalogue/afterglow.json)</Text>
          </Pressable>
        </View>
      ) : null}

      {/* 4. The inbox. */}
      <Text style={styles.section}>Inbox</Text>
      {!drops ? <ActivityIndicator color={color.glow} /> : null}
      {drops && !drops.length ? <Text style={styles.small}>Nothing in the inbox. Pictures and PDFs you save show here.</Text> : null}
      {drops?.map((d) => (
        <View key={d.id} style={styles.card}>
          <View style={styles.dropHead}>
            <Text style={styles.cardTitle} numberOfLines={1}>
              {dropFor(d, nameOf(d.festivalId))}
            </Text>
            <View style={[styles.status, d.status === 'waiting' && styles.statusWaiting, d.status === 'done' && styles.statusDone]}>
              <Text style={styles.statusText}>{DROP_STATUS_LABEL[d.status]}</Text>
            </View>
          </View>
          <Text style={styles.small}>{agoShort(d.createdAt, now.getTime())}</Text>
          {d.note ? <Text style={styles.body}>{d.note}</Text> : null}
          {d.files.map((f) => (
            <Pressable key={f.path} onPress={() => void Linking.openURL(f.url)} accessibilityRole="link" accessibilityLabel={`Open ${f.name}`}>
              <Text style={styles.link} numberOfLines={1}>
                {f.name} · {sizeLabel(f.size)} ↗
              </Text>
            </Pressable>
          ))}
          {d.text ? (
            <Text style={styles.small} numberOfLines={3}>
              {d.text}
            </Text>
          ) : null}
          <View style={styles.actions}>
            <Pressable onPress={() => void handToClaude(d)} accessibilityRole="button" style={styles.action}>
              <Text style={styles.actionText}>Copy for Claude</Text>
            </Pressable>
            {d.text ? (
              <Pressable
                onPress={() => {
                  setText(d.text ?? '');
                  setFromDrop(d.id);
                  const f = d.festivalId ? catalog.festival(d.festivalId) : undefined;
                  if (f) setFestival(f);
                  else if (d.festivalName) {
                    setFresh(true);
                    setNewName(d.festivalName);
                  }
                  setReview(undefined);
                }}
                accessibilityRole="button"
                style={styles.action}
              >
                <Text style={styles.actionText}>Use the text</Text>
              </Pressable>
            ) : null}
            {d.status !== 'done' ? (
              <Pressable onPress={() => void social.service.setDropStatus(d.id, 'done').then(loadDrops).catch(() => {})} accessibilityRole="button" style={styles.action}>
                <Text style={styles.actionText}>Done</Text>
              </Pressable>
            ) : null}
            <Pressable
              onPress={() =>
                showAlert('Delete this upload?', 'Its files are removed. Anything already published stays.', [
                  { text: 'Cancel', style: 'cancel' },
                  { text: 'Delete', style: 'destructive', onPress: () => void social.service.deleteDrop(d.id).then(loadDrops).catch(() => {}) },
                ])
              }
              accessibilityRole="button"
              accessibilityLabel="Delete this upload"
              style={styles.action}
            >
              <Text style={[styles.actionText, { color: color.moonFaint }]}>Delete</Text>
            </Pressable>
          </View>
        </View>
      ))}

      {/* 5. What's live. */}
      <Text style={styles.section}>Live on Afterglow</Text>
      {!patches.length ? <Text style={styles.small}>Nothing published from HQ yet.</Text> : null}
      {[...patches].reverse().map((p) => (
        <View key={p.id} style={[styles.card, styles.liveRow]}>
          <View style={{ flex: 1 }}>
            <Text style={styles.optionName} numberOfLines={1}>
              {p.title}
            </Text>
            <Text style={styles.small}>
              {nameOf(p.festivalId) ?? p.festivalId} · published {agoShort(p.publishedAt, now.getTime())}
            </Text>
          </View>
          <Pressable
            onPress={() =>
              showAlert(`Take down “${p.title}”?`, 'Everyone’s app goes back to what it showed before, the next time it opens.', [
                { text: 'Cancel', style: 'cancel' },
                {
                  text: 'Take down',
                  style: 'destructive',
                  onPress: () =>
                    void social.service
                      .unpublishPatch(p.id)
                      .then(refreshLivePatches)
                      .catch(() => showAlert('Couldn’t take it down', 'Check the signal and try again.')),
                },
              ])
            }
            accessibilityRole="button"
            accessibilityLabel={`Take down ${p.title}`}
            style={styles.action}
          >
            <Text style={[styles.actionText, { color: '#FF8A8A' }]}>Take down</Text>
          </Pressable>
        </View>
      ))}
    </View>
  );
}

/** "2027-09-17" if it's written like a date, else nothing. */
const day = (v: string) => (/^\d{4}-\d{2}-\d{2}$/.test(v.trim()) ? v.trim() : undefined);

function Field({ value, onChange, label, placeholder }: { value: string; onChange: (t: string) => void; label: string; placeholder: string }) {
  return <TextInput value={value} onChangeText={onChange} placeholder={placeholder} placeholderTextColor={color.moonFaint} accessibilityLabel={label} style={[styles.input, { flex: 1 }]} />;
}

function Button({ label, onPress, disabled, primary }: { label: string; onPress: () => void; disabled?: boolean; primary?: boolean }) {
  return (
    <Pressable onPress={onPress} disabled={disabled} accessibilityRole="button" style={({ pressed }) => [styles.button, primary && styles.primary, disabled && styles.dim, pressed && styles.pressed]}>
      <Text style={[styles.buttonText, primary && styles.primaryText]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrap: { paddingHorizontal: space.lg, gap: space.md },
  lead: { ...type.body, color: color.moonDim },
  card: { padding: space.lg, gap: space.sm, borderRadius: radius.lg, backgroundColor: color.glass, borderWidth: StyleSheet.hairlineWidth, borderColor: color.hairline },
  reviewCard: { borderColor: 'rgba(169,124,255,0.55)', backgroundColor: 'rgba(169,124,255,0.08)' },
  cardTitle: { ...type.headline, color: color.moon, flexShrink: 1 },
  kicker: { ...type.label, color: color.glow, textTransform: 'uppercase', letterSpacing: 1 },
  body: { ...type.body, color: color.moon },
  small: { ...type.caption, color: color.moonDim },
  warn: { ...type.caption, color: '#FFB86B' },
  link: { ...type.label, color: color.glow, paddingVertical: 4 },
  section: { ...type.title, color: color.moon, marginTop: space.lg },
  chosen: { gap: 2 },
  chosenName: { ...type.headline, color: color.moon },
  option: { paddingVertical: space.sm, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: color.hairline },
  optionName: { ...type.label, color: color.moon },
  form: { gap: space.sm },
  row2: { flexDirection: 'row', gap: space.sm },
  input: { ...type.body, color: color.moon, minHeight: 44, paddingHorizontal: space.md, borderRadius: radius.md, backgroundColor: 'rgba(255,255,255,0.06)', borderWidth: StyleSheet.hairlineWidth, borderColor: color.hairline },
  area: { minHeight: 150, paddingTop: space.sm, textAlignVertical: 'top', fontVariant: ['tabular-nums'] },
  fileRow: { flexDirection: 'row', alignItems: 'center', gap: space.sm, paddingVertical: 4 },
  fileName: { ...type.label, color: color.moon, flex: 1 },
  remove: { fontSize: 20, color: color.moonFaint, paddingHorizontal: 4 },
  savedNote: { padding: space.md, borderRadius: radius.md, backgroundColor: 'rgba(169,124,255,0.1)' },
  preview: { padding: space.md, borderRadius: radius.md, backgroundColor: 'rgba(0,0,0,0.25)', gap: 2 },
  previewLine: { ...type.caption, color: color.moon, fontVariant: ['tabular-nums'] },
  buttons: { flexDirection: 'row', gap: space.sm, justifyContent: 'flex-end', flexWrap: 'wrap' },
  button: { alignSelf: 'flex-start', paddingHorizontal: space.lg, minHeight: 42, justifyContent: 'center', borderRadius: radius.pill, backgroundColor: color.glass, borderWidth: StyleSheet.hairlineWidth, borderColor: color.hairline },
  primary: { backgroundColor: color.glow, borderColor: color.glow },
  buttonText: { ...type.label, color: color.moon },
  primaryText: { color: color.night },
  dim: { opacity: 0.45 },
  pressed: { opacity: 0.8, transform: [{ scale: 0.98 }] },
  dropHead: { flexDirection: 'row', alignItems: 'center', gap: space.sm, justifyContent: 'space-between' },
  status: { paddingHorizontal: space.sm, paddingVertical: 3, borderRadius: radius.pill, backgroundColor: 'rgba(169,124,255,0.2)' },
  statusWaiting: { backgroundColor: 'rgba(255,184,107,0.22)' },
  statusDone: { backgroundColor: 'rgba(255,255,255,0.08)' },
  statusText: { ...type.caption, color: color.moon },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm, marginTop: space.xs },
  action: { paddingHorizontal: space.md, paddingVertical: 7, borderRadius: radius.pill, borderWidth: StyleSheet.hairlineWidth, borderColor: color.hairline },
  actionText: { ...type.caption, color: color.moon },
  liveRow: { flexDirection: 'row', alignItems: 'center' },
});
