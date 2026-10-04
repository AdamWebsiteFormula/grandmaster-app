import CoreGraphics
import Foundation
// Prints the owner of the topmost on-screen window that contains (x, y).
let x = Double(CommandLine.arguments[1])!, y = Double(CommandLine.arguments[2])!
let list = CGWindowListCopyWindowInfo([.optionOnScreenOnly, .excludeDesktopElements], kCGNullWindowID) as! [[String: Any]]
for w in list {
  guard let b = w[kCGWindowBounds as String] as? [String: Double], (w[kCGWindowLayer as String] as? Int) == 0 else { continue }
  if x >= b["X"]! && x <= b["X"]! + b["Width"]! && y >= b["Y"]! && y <= b["Y"]! + b["Height"]! {
    print(w[kCGWindowOwnerName as String] ?? "?", w[kCGWindowNumber as String] ?? "?", b)
    break
  }
}
