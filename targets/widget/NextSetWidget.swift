import SwiftUI
import WidgetKit

/// The "Next set" widget (home screen, small and medium; lock screen, all three
/// sizes). On a festival night: the set on your route now and the next one,
/// moving on by itself at each set's start and end. Before a festival you're
/// going to: the countdown. Otherwise: a quiet invitation.

let appGroup = "group.app.afterglowmusic"

struct GlanceEntry: TimelineEntry {
  let date: Date
  let glance: Glance
}

struct GlanceProvider: TimelineProvider {
  private func load() -> Glance {
    Glance.decode(UserDefaults(suiteName: appGroup)?.string(forKey: "glance")) ?? .none
  }

  func placeholder(in context: Context) -> GlanceEntry {
    GlanceEntry(date: .now, glance: Glance(
      kind: "live", festivalId: nil, festival: "EDC Orlando", place: nil, startsAt: nil, night: "Saturday",
      sets: [
        GlanceSet(artist: "ILLENIUM", stage: "kineticFIELD", start: Date.now.addingTimeInterval(-1200).timeIntervalSince1970 * 1000, end: Date.now.addingTimeInterval(2400).timeIntervalSince1970 * 1000, walk: nil, color: nil),
        GlanceSet(artist: "Subtronics", stage: "circuitGROUNDS", start: Date.now.addingTimeInterval(3000).timeIntervalSince1970 * 1000, end: Date.now.addingTimeInterval(6600).timeIntervalSince1970 * 1000, walk: 8, color: nil),
      ],
      until: nil))
  }

  func getSnapshot(in context: Context, completion: @escaping (GlanceEntry) -> Void) {
    let glance = load()
    completion(glance.kind == "none" && context.isPreview ? placeholder(in: context) : GlanceEntry(date: .now, glance: glance))
  }

  func getTimeline(in context: Context, completion: @escaping (Timeline<GlanceEntry>) -> Void) {
    let glance = load()
    let now = Date.now
    // One entry now, then one at every set's start and end tonight, so the widget moves on by itself.
    var dates = [now] + glance.changes(after: now).prefix(30)
    let calendar = Calendar.current
    let nextMidnight = calendar.startOfDay(for: calendar.date(byAdding: .day, value: 1, to: now) ?? now)
    if glance.kind == "countdown" { dates.append(nextMidnight) }
    let entries = dates.map { GlanceEntry(date: $0, glance: glance) }
    // After the night (or at midnight, for the countdown), ask again; the app also reloads it whenever the plan changes.
    let after = glance.untilDate.map { max($0, now.addingTimeInterval(900)) } ?? nextMidnight
    completion(Timeline(entries: entries, policy: .after(after)))
  }
}

struct NextSetWidget: Widget {
  let kind = "NextSetWidget"

  var body: some WidgetConfiguration {
    StaticConfiguration(kind: kind, provider: GlanceProvider()) { entry in
      NextSetView(entry: entry)
    }
    .configurationDisplayName("Next set")
    .description("On a festival night, the set you're at and where to go next. Before it, the countdown.")
    .supportedFamilies([.systemSmall, .systemMedium, .accessoryRectangular, .accessoryInline, .accessoryCircular])
  }
}

private func artistTint(_ hex: String?) -> Color {
  guard let (r, g, b) = hex?.rgb else { return Color("glow") }
  return Color(red: r, green: g, blue: b)
}

struct NextSetView: View {
  let entry: GlanceEntry
  @Environment(\.widgetFamily) private var family

  private var link: URL? {
    switch entry.glance.kind {
    case "live": return URL(string: "afterglow://tonight")
    case "countdown": return entry.glance.festivalId.flatMap { URL(string: "afterglow://festival/\($0)") }
    default: return URL(string: "afterglow://festivals")
    }
  }

  var body: some View {
    content
      .widgetURL(link)
      .containerBackground(for: .widget) {
        LinearGradient(colors: [Color("nightRaised"), Color("night")], startPoint: .top, endPoint: .bottom)
          .overlay(alignment: .topTrailing) {
            Circle().fill(Color("glowDeep").opacity(0.35)).frame(width: 120, height: 120).blur(radius: 40).offset(x: 40, y: -40)
          }
      }
  }

  @ViewBuilder private var content: some View {
    switch family {
    case .accessoryInline: inline
    case .accessoryCircular: circular
    case .accessoryRectangular: rectangular
    default: home
    }
  }

  // Lock screen, one line.
  @ViewBuilder private var inline: some View {
    let g = entry.glance
    if g.kind == "live", let next = g.nowAndNext(at: entry.date).next {
      Text("Next: \(next.artist) \(next.startDate, style: .time)")
    } else if g.kind == "countdown", let days = g.daysUntil(from: entry.date) {
      Text("\(g.festival ?? "Festival") in \(days)d")
    } else {
      Text("Afterglow")
    }
  }

  // Lock screen, round.
  @ViewBuilder private var circular: some View {
    let g = entry.glance
    ZStack {
      AccessoryWidgetBackground()
      if g.kind == "live", let on = g.nowAndNext(at: entry.date).now {
        VStack(spacing: 0) {
          Image(systemName: "music.note")
          Text(timerInterval: entry.date...max(entry.date, on.endDate), countsDown: true)
            .font(.caption2).monospacedDigit().multilineTextAlignment(.center)
        }
      } else if g.kind == "countdown", let days = g.daysUntil(from: entry.date) {
        VStack(spacing: 0) {
          Text("\(days)").font(.title3.bold())
          Text(days == 1 ? "day" : "days").font(.caption2)
        }
      } else {
        Image(systemName: "sparkles")
      }
    }
  }

  // Lock screen, rectangle.
  @ViewBuilder private var rectangular: some View {
    let g = entry.glance
    let pair = g.nowAndNext(at: entry.date)
    let on = pair.now
    let next = pair.next
    VStack(alignment: .leading, spacing: 1) {
      if g.kind == "live", let on {
        Text("NOW · \(on.stage)").font(.caption2).opacity(0.75)
        Text(on.artist).font(.headline).lineLimit(1)
        if let next { Text("Next \(next.artist) \(next.startDate, style: .time)").font(.caption2).lineLimit(1) }
      } else if g.kind == "live", let next {
        Text("NEXT · \(next.stage)").font(.caption2).opacity(0.75)
        Text(next.artist).font(.headline).lineLimit(1)
        Text(next.startDate, style: .relative).font(.caption2)
      } else if g.kind == "live" {
        Text(g.night?.uppercased() ?? "TONIGHT").font(.caption2).opacity(0.75)
        Text(g.festival ?? "Festival").font(.headline).lineLimit(1)
      } else if g.kind == "countdown", let days = g.daysUntil(from: entry.date) {
        Text("IN \(days) \(days == 1 ? "DAY" : "DAYS")").font(.caption2).opacity(0.75)
        Text(g.festival ?? "Festival").font(.headline).lineLimit(2)
      } else {
        Text("Afterglow").font(.headline)
        Text("Your next festival shows here").font(.caption2).lineLimit(2)
      }
    }
    .frame(maxWidth: .infinity, alignment: .leading)
  }

  // Home screen.
  @ViewBuilder private var home: some View {
    let g = entry.glance
    let pair = g.nowAndNext(at: entry.date)
    let on = pair.now
    let next = pair.next
    VStack(alignment: .leading, spacing: 6) {
      if g.kind == "live" {
        Text("\(g.night?.uppercased() ?? "TONIGHT") · \(g.festival ?? "")")
          .font(.caption2.weight(.semibold)).foregroundStyle(Color("glow")).lineLimit(1)
        if let on {
          SetBlock(label: "Now", set: on, date: entry.date, big: true)
        }
        if let next, family == .systemMedium || on == nil {
          SetBlock(label: "Next", set: next, date: entry.date, big: on == nil)
        }
        if on == nil && next == nil {
          Spacer(minLength: 0)
          Text("That's tonight done. Get home safe.").font(.footnote).foregroundStyle(Color("moon").opacity(0.7))
        }
      } else if g.kind == "countdown", let days = g.daysUntil(from: entry.date) {
        Text("YOUR NEXT FESTIVAL").font(.caption2.weight(.semibold)).foregroundStyle(Color("glow"))
        Spacer(minLength: 0)
        HStack(alignment: .firstTextBaseline, spacing: 4) {
          Text("\(days)").font(.system(size: 40, weight: .bold, design: .rounded)).foregroundStyle(Color("moon"))
          Text(days == 1 ? "day" : "days").font(.headline).foregroundStyle(Color("moon").opacity(0.7))
        }
        Text(g.festival ?? "").font(.headline).foregroundStyle(Color("moon")).lineLimit(2)
        if family == .systemMedium, let place = g.place {
          Text(place).font(.caption).foregroundStyle(Color("moon").opacity(0.6)).lineLimit(1)
        }
      } else {
        Text("AFTERGLOW").font(.caption2.weight(.semibold)).foregroundStyle(Color("glow"))
        Spacer(minLength: 0)
        Text("Tap I'm going on a festival and it counts down here.")
          .font(.footnote).foregroundStyle(Color("moon").opacity(0.8))
      }
      Spacer(minLength: 0)
    }
    .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
  }
}

/// One set: who, where, and the time left (now) or until it starts (next).
struct SetBlock: View {
  let label: String
  let set: GlanceSet
  let date: Date
  let big: Bool

  var body: some View {
    VStack(alignment: .leading, spacing: 2) {
      HStack(spacing: 4) {
        Circle().fill(artistTint(set.color)).frame(width: 6, height: 6)
        Text(label.uppercased()).font(.caption2.weight(.semibold)).foregroundStyle(Color("moon").opacity(0.6))
        if label == "Now" {
          Text(timerInterval: date...max(date, set.endDate), countsDown: true)
            .font(.caption2).monospacedDigit().foregroundStyle(Color("moon").opacity(0.6))
        } else {
          Text(set.startDate, style: .time).font(.caption2).foregroundStyle(Color("moon").opacity(0.6))
        }
      }
      Text(set.artist)
        .font(big ? .title3.weight(.bold) : .headline)
        .foregroundStyle(Color("moon")).lineLimit(1).minimumScaleFactor(0.7)
      Text(set.walk.map { "\(set.stage) · \($0) min walk" } ?? set.stage)
        .font(.caption).foregroundStyle(Color("moon").opacity(0.65)).lineLimit(1)
    }
  }
}
