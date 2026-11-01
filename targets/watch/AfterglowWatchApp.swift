import SwiftUI
import WatchConnectivity

/// Afterglow on the Apple Watch. The iPhone sends the glance (your festival
/// at a glance) as its application context; the Watch keeps the latest and
/// shows it, counting down and moving to the next set by itself.
@main
struct AfterglowWatchApp: App {
  @StateObject private var link = PhoneLink()

  var body: some Scene {
    WindowGroup {
      GlanceView(glance: link.glance)
    }
  }
}

/// The Watch's side of the link to the iPhone.
final class PhoneLink: NSObject, ObservableObject, WCSessionDelegate {
  private static let key = "glance"
  @Published var glance: Glance

  override init() {
    glance = Glance.decode(UserDefaults.standard.string(forKey: PhoneLink.key)) ?? .none
    super.init()
    if WCSession.isSupported() {
      WCSession.default.delegate = self
      WCSession.default.activate()
    }
  }

  private func take(_ context: [String: Any]) {
    guard let json = context[PhoneLink.key] as? String, let g = Glance.decode(json) else { return }
    UserDefaults.standard.set(json, forKey: PhoneLink.key)
    DispatchQueue.main.async { self.glance = g }
  }

  func session(_ session: WCSession, activationDidCompleteWith activationState: WCSessionActivationState, error: Error?) {
    // The last glance the iPhone sent while the Watch app was closed.
    take(session.receivedApplicationContext)
  }

  func session(_ session: WCSession, didReceiveApplicationContext applicationContext: [String: Any]) {
    take(applicationContext)
  }
}

struct GlanceView: View {
  let glance: Glance

  var body: some View {
    // Redraw every 30 seconds so the next set takes over on time.
    TimelineView(.periodic(from: .now, by: 30)) { context in
      content(at: context.date)
    }
    .background(Color("night"))
  }

  @ViewBuilder private func content(at date: Date) -> some View {
    let pair = glance.nowAndNext(at: date)
    let on = pair.now
    let next = pair.next
    ScrollView {
      VStack(alignment: .leading, spacing: 10) {
        if glance.kind == "live" {
          Text("\(glance.night?.uppercased() ?? "TONIGHT") · \(glance.festival ?? "")")
            .font(.caption2.weight(.semibold)).foregroundStyle(Color("glow")).lineLimit(2)
          if let on {
            WatchSet(label: "Now", set: on, date: date)
          }
          if let next {
            WatchSet(label: "Next", set: next, date: date)
          }
          if on == nil && next == nil {
            Text(glance.sets?.isEmpty ?? true ? "Set times aren't out yet. Your picks are in the app." : "That's tonight done. Get home safe.")
              .font(.footnote).foregroundStyle(Color("moon").opacity(0.75))
          }
        } else if glance.kind == "countdown", let days = glance.daysUntil(from: date) {
          Text("YOUR NEXT FESTIVAL").font(.caption2.weight(.semibold)).foregroundStyle(Color("glow"))
          HStack(alignment: .firstTextBaseline, spacing: 4) {
            Text("\(days)").font(.system(size: 44, weight: .bold, design: .rounded)).foregroundStyle(Color("moon"))
            Text(days == 1 ? "day" : "days").font(.headline).foregroundStyle(Color("moon").opacity(0.7))
          }
          Text(glance.festival ?? "").font(.headline).foregroundStyle(Color("moon"))
          if let place = glance.place {
            Text(place).font(.caption).foregroundStyle(Color("moon").opacity(0.6))
          }
        } else {
          Text("AFTERGLOW").font(.caption2.weight(.semibold)).foregroundStyle(Color("glow"))
          Text("Tap I'm going on a festival in the iPhone app, and it shows up here.")
            .font(.footnote).foregroundStyle(Color("moon").opacity(0.8))
        }
      }
      .frame(maxWidth: .infinity, alignment: .leading)
    }
  }
}

struct WatchSet: View {
  let label: String
  let set: GlanceSet
  let date: Date

  var body: some View {
    VStack(alignment: .leading, spacing: 2) {
      HStack(spacing: 4) {
        Text(label.uppercased()).font(.caption2.weight(.semibold)).foregroundStyle(Color("moon").opacity(0.6))
        Spacer(minLength: 2)
        if label == "Now" {
          Text(timerInterval: date...max(date, set.endDate), countsDown: true)
            .font(.caption2).monospacedDigit().foregroundStyle(Color("glow"))
        } else {
          Text(set.startDate, style: .time).font(.caption2).foregroundStyle(Color("glow"))
        }
      }
      Text(set.artist).font(.headline).foregroundStyle(Color("moon")).lineLimit(2).minimumScaleFactor(0.7)
      Text(set.walk.map { "\(set.stage) · \($0) min walk" } ?? set.stage)
        .font(.caption2).foregroundStyle(Color("moon").opacity(0.65)).lineLimit(2)
    }
    .padding(8)
    .frame(maxWidth: .infinity, alignment: .leading)
    .background(Color("nightRaised"), in: RoundedRectangle(cornerRadius: 12))
  }
}
