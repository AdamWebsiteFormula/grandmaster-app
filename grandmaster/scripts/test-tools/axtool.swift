import ApplicationServices
import Foundation

// Usage: axtool <pid> list [filter]
//        axtool <pid> press <title> [nth]
let args = CommandLine.arguments
let pid = pid_t(args[1])!
let app = AXUIElementCreateApplication(pid)
AXUIElementSetAttributeValue(app, "AXManualAccessibility" as CFString, kCFBooleanTrue)
usleep(300_000)

func attr(_ el: AXUIElement, _ name: String) -> String {
  var v: CFTypeRef?
  AXUIElementCopyAttributeValue(el, name as CFString, &v)
  return v as? String ?? ""
}

var found: [(AXUIElement, String, String)] = []
var seen = Set<Int>()
func walk(_ el: AXUIElement, _ depth: Int) {
  if depth > 45 || found.count > 2000 { return }
  let h = Int(CFHash(el))
  if seen.contains(h) { return }
  seen.insert(h)
  let role = attr(el, kAXRoleAttribute)
  let title = attr(el, kAXTitleAttribute)
  let desc = attr(el, kAXDescriptionAttribute)
  let label = title.isEmpty ? desc : title
  if !label.isEmpty { found.append((el, role, label)) }
  var kids: CFTypeRef?
  AXUIElementCopyAttributeValue(el, kAXChildrenAttribute as CFString, &kids)
  for k in (kids as? [AXUIElement]) ?? [] { walk(k, depth + 1) }
}
var winsRef: CFTypeRef?
AXUIElementCopyAttributeValue(app, kAXWindowsAttribute as CFString, &winsRef)
let startWindows = (winsRef as? [AXUIElement]) ?? []
if startWindows.isEmpty { walk(app, 0) } else { for w in startWindows { walk(w, 0) } }

if args[2] == "resize" {
  var wins: CFTypeRef?
  AXUIElementCopyAttributeValue(app, kAXWindowsAttribute as CFString, &wins)
  let list = (wins as? [AXUIElement]) ?? []
  let pick = list.first { attr($0, kAXTitleAttribute) == "Upshot" } ?? list.first
  if let w = pick {
    var size = CGSize(width: Double(args[3])!, height: Double(args[4])!)
    var origin = CGPoint(x: 40, y: 40)
    let sv = AXValueCreate(.cgSize, &size)!
    let ov = AXValueCreate(.cgPoint, &origin)!
    AXUIElementSetAttributeValue(w, kAXPositionAttribute as CFString, ov)
    let r = AXUIElementSetAttributeValue(w, kAXSizeAttribute as CFString, sv)
    print("resize", r.rawValue)
  }
} else if args[2] == "list" {
  let filter = args.count > 3 ? args[3].lowercased() : ""
  for (_, role, label) in found where filter.isEmpty || label.lowercased().contains(filter) {
    print(role, "|", label)
  }
} else if args[2] == "showmenu" {
  // Right-click equivalent: AXShowMenu on the element with this exact title.
  let title = args[3]
  let nth = args.count > 4 ? Int(args[4])! : 0
  let matches = found.filter { $0.2 == title }
  if matches.count > nth {
    let r = AXUIElementPerformAction(matches[nth].0, kAXShowMenuAction as CFString)
    print("showmenu", matches[nth].1, title, r.rawValue)
  } else {
    print("not found:", title, "matches:", matches.count)
  }
} else if args[2] == "menupress" {
  // Press an item in an open menu (menus hang off the app, not a window).
  found.removeAll(); seen.removeAll()
  walk(app, 0)
  let title = args[3]
  if let m = found.first(where: { $0.1 == "AXMenuItem" && $0.2 == title }) {
    let r = AXUIElementPerformAction(m.0, kAXPressAction as CFString)
    print("menupress", title, r.rawValue)
  } else {
    print("menu item not found:", title, found.filter { $0.1 == "AXMenuItem" }.map { $0.2 }.prefix(20))
  }
} else if args[2] == "press" {
  let title = args[3]
  let nth = args.count > 4 ? Int(args[4])! : 0
  let matches = found.filter { $0.2 == title && ["AXButton", "AXLink", "AXRadioButton", "AXCheckBox", "AXMenuItem", "AXTab", "AXPopUpButton", "AXComboBox"].contains($0.1) }
  if matches.count > nth {
    let r = AXUIElementPerformAction(matches[nth].0, kAXPressAction as CFString)
    print("pressed", matches[nth].1, title, r.rawValue)
  } else {
    print("not found:", title, "matches:", matches.count)
  }
}
