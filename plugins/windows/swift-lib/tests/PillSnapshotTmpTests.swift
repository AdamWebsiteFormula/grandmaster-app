import SwiftUI
import XCTest

@testable import swift_lib

final class PillSnapshotTmpTests: XCTestCase {
  @MainActor
  func testRenderPill() throws {
    for (name, toggle, amp) in [("pill", true, 0.6), ("pill-notoggle", false, 0.2)] {
      let model = FloatingBarViewModel()
      model.liveCaptionToggleVisible = toggle
      model.amplitude = amp
      let view = FloatingBarView(
        model: model, settings: FloatingOverlaySettingsModel.shared,
        panelOrigin: { nil }, movePanel: { _ in })
      let size = FloatingBarLayout.containerSize(
        isExpanded: false, showsExpand: toggle, pillMode: true)
      let renderer = ImageRenderer(
        content: view.frame(width: size.width, height: size.height)
          .padding(20).background(Color(white: 0.93)))
      renderer.scale = 4
      let image = try XCTUnwrap(renderer.nsImage)
      let rep = try XCTUnwrap(NSBitmapImageRep(data: try XCTUnwrap(image.tiffRepresentation)))
      try XCTUnwrap(rep.representation(using: .png, properties: [:])).write(
        to: URL(fileURLWithPath: "/private/tmp/claude-501/-Users-Adam-code-grandmaster-app/8389184b-5309-4743-bad7-2158b7071329/scratchpad/\(name).png"))
    }
  }
}
