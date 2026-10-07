import { useNetworkState } from "expo-network";
import { router } from "expo-router";
import { useCallback, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { showAlert } from "../../lib/dialog";
import { haptic } from "../../lib/haptics";
import { useCrewUpdates } from "../../state/crewUpdates";
import { color, glowA, radius, space, type } from "../../theme/tokens";
import { isOffline } from "../offline/status";
import { CHECK_INS, clock, presetLabel } from "./updates";
import { t } from "../../i18n";

/** How-you-are tints: fine, can't find you, need help. */
export const GREEN = "#5BE3B5";
export const AMBER = "#FFB86B";
export const RED = "#FF8A8A";

/**
 * How you're doing, as actions: "I'm OK" (or "I'm OK now" after asking for
 * help), "Can't find you" and "Need help", the last two asked first. Shared
 * by the chips below and the crew chat's check-in tray, so both send the
 * same way. `onSent` gets the update's id and the words it showed.
 */
export function useCareActions(
  festivalId: string,
  onSent: (id: string, what: string) => void,
) {
  const { sendCare, callLost, myCare } = useCrewUpdates();
  const asked = myCare?.care === "help";
  const ok = () => {
    const id = sendCare(festivalId, "ok");
    if (id) onSent(id, asked ? t("I’m OK now") : t("I’m OK"));
  };
  const lost = () =>
    showAlert(
      t("Tell your crew you can’t find them?"),
      t("They’ll see it with the time you sent it, and your meeting spot if you have one."),
      [
        { text: t("Cancel"), style: "cancel" },
        {
          text: t("Send"),
          onPress: () => {
            const id = callLost(festivalId);
            if (id) onSent(id, t("Can’t find you"));
          },
        },
      ],
    );
  const help = () =>
    showAlert(
      t("Ask your crew to come find you?"),
      t("They’ll see “Not feeling great” with the time you sent it, and their phones nudge them. A check-in with where you are helps them find you."),
      [
        { text: t("Cancel"), style: "cancel" },
        {
          text: t("Ask my crew"),
          onPress: () => {
            const id = sendCare(festivalId, "help");
            if (id) onSent(id, t("Need help"));
          },
        },
      ],
    );
  return { asked, myCare, ok, lost, help };
}

/**
 * What became of your last check-in, said honestly: sending, saved for when
 * there's signal (marked with the time you tapped), refused, or sent.
 */
export function useCheckInStatus() {
  const { outbox, dropped } = useCrewUpdates();
  const offline = isOffline(useNetworkState());
  const [sent, setSent] = useState<{ id: string; what: string; at: string }>();
  const done = (id: string, what: string) => {
    haptic.settle();
    setSent({ id, what, at: new Date().toISOString() });
  };
  const waiting = sent ? outbox.some((o) => o.id === sent.id) : false;
  const refused = sent ? dropped.includes(sent.id) : false;
  const status = !sent
    ? undefined
    : refused
      ? t("Couldn’t reach your crew with “{what}”. Try again.", { what: sent.what })
      : waiting
        ? offline
          ? t("“{what}” is saved for when there’s signal, marked {time}.", { what: sent.what, time: clock(sent.at) })
          : t("Sending “{what}”…", { what: sent.what })
        : t("Sent “{what}” · {time}", { what: sent.what, time: clock(sent.at) });
  const tint = refused ? RED : waiting && offline ? AMBER : undefined;
  const clear = useCallback(() => setSent(undefined), []);
  return { sent, done, status, tint, settled: !!sent && !waiting && !refused, clear };
}

/**
 * How you're doing, as chips like the check-ins: "I'm OK", "Can't find you"
 * (to your meeting spot when there is one) and "Need help" (asked first).
 * After asking for help, "I'm OK now" clears it. Each waits for signal like
 * any check-in and keeps the time you tapped. `onSent` gets the update's id.
 */
export function StatusChips({
  festivalId,
  onSent,
}: {
  festivalId: string;
  onSent: (id: string, what: string) => void;
}) {
  const { asked, myCare, ok, lost, help } = useCareActions(festivalId, onSent);
  return (
    <View style={{ gap: space.sm }}>
      {asked && myCare ? (
        <Text style={styles.asked}>
          {t("You asked your crew for help at {time}. Feeling better? Let them know.", { time: clock(myCare.at) })}
        </Text>
      ) : null}
      <View style={styles.chips}>
        <Chip
          label={asked ? t("I’m OK now") : t("I’m OK")}
          tint={GREEN}
          a11y={asked ? t("I’m OK now. Tell my crew") : t("I’m OK. Tell my crew")}
          onPress={ok}
        />
        <Chip
          label={t("Can’t find you")}
          tint={AMBER}
          a11y={t("Can’t find my crew. Tell them")}
          onPress={lost}
        />
        {asked ? null : (
          <Chip
            label={t("Need help")}
            tint={RED}
            a11y={t("Not feeling great. Ask my crew to come find me")}
            onPress={help}
          />
        )}
      </View>
    </View>
  );
}

/**
 * Check in with your crew right where you are: the quick check-ins as one
 * tap each, how you're doing below them, and the full check-in (stage, a
 * photo, your own words) a tap away. Says honestly whether it got through.
 */
export function CheckInPanel({
  festivalId,
  title = t("Check in"),
}: {
  festivalId: string;
  title?: string;
}) {
  const { checkIn, ready } = useCrewUpdates();
  const { done, status, tint } = useCheckInStatus();
  if (!ready) return null;

  return (
    <View style={styles.card}>
      <View style={styles.head}>
        <Text style={styles.title} accessibilityRole="header">
          {title}
        </Text>
        <Pressable
          onPress={() => {
            haptic.select();
            router.push("/check-in");
          }}
          accessibilityRole="button"
          accessibilityLabel={t("Check in with a stage, a photo or your own words")}
          hitSlop={8}
          style={({ pressed }) => [styles.more, pressed && styles.pressed]}
        >
          <Text style={styles.moreText}>{t("Stage, photo, words ›")}</Text>
        </Pressable>
      </View>
      <View style={styles.chips}>
        {CHECK_INS.map((words) => (
          <Chip
            key={words}
            label={presetLabel(words)}
            a11y={t("Send “{words}” to your crew", { words: presetLabel(words) })}
            onPress={() => {
              const id = checkIn(festivalId, { note: words });
              if (id) done(id, presetLabel(words));
            }}
          />
        ))}
      </View>
      <Text style={styles.label}>{t("Let them know")}</Text>
      <StatusChips festivalId={festivalId} onSent={done} />
      {status ? (
        <Text
          style={[styles.status, tint ? { color: tint } : null]}
          accessibilityLiveRegion="polite"
        >
          {status}
        </Text>
      ) : null}
    </View>
  );
}

function Chip({
  label,
  a11y,
  tint,
  onPress,
}: {
  label: string;
  a11y: string;
  tint?: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={() => {
        haptic.select();
        onPress();
      }}
      accessibilityRole="button"
      accessibilityLabel={a11y}
      style={({ pressed }) => [
        styles.chip,
        tint
          ? { borderColor: `${tint}66`, backgroundColor: `${tint}14` }
          : null,
        pressed && styles.pressed,
      ]}
    >
      <Text style={[styles.chipText, tint ? { color: tint } : null]}>
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    padding: space.lg,
    gap: space.sm,
    borderRadius: radius.lg,
    backgroundColor: color.glass,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: color.hairline,
    borderTopColor: color.rim,
  },
  head: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: space.md,
    marginBottom: space.xs,
  },
  title: { ...type.headline, color: color.moon },
  more: { paddingVertical: 4 },
  moreText: { ...type.label, color: color.glow },
  label: {
    ...type.caption,
    color: color.moonFaint,
    textTransform: "uppercase",
    letterSpacing: 1,
    marginTop: space.sm,
  },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: space.sm },
  chip: {
    paddingHorizontal: space.md + 2,
    paddingVertical: space.sm + 2,
    borderRadius: radius.md,
    backgroundColor: glowA(0.14),
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: glowA(0.4),
  },
  chipText: { ...type.label, fontSize: 14, color: color.moon },
  asked: { ...type.caption, color: RED },
  status: { ...type.caption, color: color.moonDim, marginTop: space.xs },
  pressed: { opacity: 0.8, transform: [{ scale: 0.97 }] },
});
