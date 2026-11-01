import SwiftUI
import WidgetKit

/// Everything Afterglow puts outside the app on the iPhone: the "Next set"
/// widget and the festival Live Activity.
@main
struct AfterglowWidgets: WidgetBundle {
  var body: some Widget {
    NextSetWidget()
    FestivalLiveActivity()
  }
}
