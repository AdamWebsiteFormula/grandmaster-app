import CoreGraphics
import Foundation
let pid = Int(CommandLine.arguments[1])!
let info = CGWindowListCopyWindowInfo([.optionAll], kCGNullWindowID) as! [[String: Any]]
for w in info where (w[kCGWindowOwnerPID as String] as? Int) == pid {
  let id = w[kCGWindowNumber as String] as? Int ?? 0
  let name = w[kCGWindowName as String] as? String ?? ""
  let layer = w[kCGWindowLayer as String] as? Int ?? 0
  let b = w[kCGWindowBounds as String] as? [String: Any] ?? [:]
  print(id, layer, name, b["Width"] ?? "", b["Height"] ?? "")
}
