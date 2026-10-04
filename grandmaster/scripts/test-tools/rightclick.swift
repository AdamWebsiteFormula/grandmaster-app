import CoreGraphics
import Foundation
// Right-clicks at a screen point (global event).
let p = CGPoint(x: Double(CommandLine.arguments[1])!, y: Double(CommandLine.arguments[2])!)
let src = CGEventSource(stateID: .hidSystemState)
CGEvent(mouseEventSource: src, mouseType: .mouseMoved, mouseCursorPosition: p, mouseButton: .left)?.post(tap: .cghidEventTap)
usleep(150_000)
CGEvent(mouseEventSource: src, mouseType: .rightMouseDown, mouseCursorPosition: p, mouseButton: .right)?.post(tap: .cghidEventTap)
usleep(60_000)
CGEvent(mouseEventSource: src, mouseType: .rightMouseUp, mouseCursorPosition: p, mouseButton: .right)?.post(tap: .cghidEventTap)
print("right-clicked", p)
