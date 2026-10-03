import Cocoa

enum QuitOverlay {
  static let size = NSSize(width: 360, height: 96)
  static let cornerRadius: CGFloat = 12
  static let verticalOffsetRatio: CGFloat = 0.15
  static let backgroundColor = NSColor(white: 0.12, alpha: 0.88)

  // Fork: sentence case, and say that a recording stops (journey-meeting P2;
  // Apple HIG Alerts: warn before a destructive action).
  static let messageText = "Press ⌘Q again to quit."
  static let detailText = "A recording in progress stops."
  static let font = NSFont.systemFont(ofSize: 22, weight: .medium)
  static let detailFont = NSFont.systemFont(ofSize: 13, weight: .regular)
  static let primaryTextColor = NSColor.white
  static let secondaryTextColor = NSColor(white: 1, alpha: 0.75)
  static let lineSpacing: CGFloat = 4

  static let animationDuration: TimeInterval = 0.15
  static let overlayDuration: TimeInterval = 1.5
}
