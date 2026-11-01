import ActivityKit
import Foundation

/// The festival Live Activity's data. The app's module has an identical copy
/// (modules/afterglow-live/ios/FestivalActivityAttributes.swift): ActivityKit
/// matches the two by name, so keep them exactly the same.
public struct FestivalActivityAttributes: ActivityAttributes {
  public struct ContentState: Codable, Hashable {
    /// The set on now, if any.
    public var nowArtist: String?
    public var nowStage: String?
    public var nowEnd: Date?
    /// The next set on your route tonight, if any.
    public var nextArtist: String?
    public var nextStage: String?
    public var nextStart: Date?
    /// Minutes of walking to the next stage, when it changes.
    public var nextWalk: Int?
    /// The artist on now's colour ("#RRGGBB"), for a touch of their light.
    public var color: String?
  }

  /// "EDC Orlando 2026"
  public var festival: String
  /// "Saturday"
  public var night: String
}
