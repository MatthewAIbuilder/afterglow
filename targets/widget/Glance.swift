import Foundation

/// Your festival at a glance, as the app leaves it (features/glance/glance.ts,
/// JSON in the App Group). The Watch app has an identical copy
/// (targets/watch/Glance.swift). Times are milliseconds since 1970.
struct GlanceSet: Codable, Hashable {
  let artist: String
  let stage: String
  let start: Double
  let end: Double
  let walk: Int?
  let color: String?

  var startDate: Date { Date(timeIntervalSince1970: start / 1000) }
  var endDate: Date { Date(timeIntervalSince1970: end / 1000) }
}

struct Glance: Codable {
  /// "live", "countdown" or "none".
  let kind: String
  let festivalId: String?
  let festival: String?
  let place: String?
  let startsAt: Double?
  let night: String?
  let sets: [GlanceSet]?
  let until: Double?

  static let none = Glance(kind: "none", festivalId: nil, festival: nil, place: nil, startsAt: nil, night: nil, sets: nil, until: nil)

  static func decode(_ json: String?) -> Glance? {
    guard let json, let data = json.data(using: .utf8) else { return nil }
    return try? JSONDecoder().decode(Glance.self, from: data)
  }

  var startsAtDate: Date? { startsAt.map { Date(timeIntervalSince1970: $0 / 1000) } }
  var untilDate: Date? { until.map { Date(timeIntervalSince1970: $0 / 1000) } }

  /// The set on now and the next one, at a moment (the same as nowAndNext in glance.ts).
  func nowAndNext(at date: Date) -> (now: GlanceSet?, next: GlanceSet?) {
    let list = sets ?? []
    let on = list.first { $0.startDate <= date && date < $0.endDate }
    let next = list.first { $0.startDate > date }
    return (on, next)
  }

  /// Every moment the picture changes after `date` (a set starts or ends), soonest first.
  func changes(after date: Date) -> [Date] {
    let moments = (sets ?? []).flatMap { [$0.startDate, $0.endDate] }.filter { $0 > date }
    return Array(Set(moments)).sorted()
  }

  /// Whole days until the festival, counted at local midnight.
  func daysUntil(from date: Date) -> Int? {
    guard let start = startsAtDate else { return nil }
    let calendar = Calendar.current
    return calendar.dateComponents([.day], from: calendar.startOfDay(for: date), to: calendar.startOfDay(for: start)).day
  }
}

extension String {
  /// "#RRGGBB" as red, green and blue from 0 to 1.
  var rgb: (Double, Double, Double)? {
    let hex = trimmingCharacters(in: CharacterSet(charactersIn: "#"))
    guard hex.count == 6, let value = UInt32(hex, radix: 16) else { return nil }
    return (Double((value >> 16) & 0xFF) / 255, Double((value >> 8) & 0xFF) / 255, Double(value & 0xFF) / 255)
  }
}
