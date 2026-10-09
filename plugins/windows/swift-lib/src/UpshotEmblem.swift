import AppKit
import SwiftUI

// Fork: the Upshot "U" from the app icon as a one-color mark, for the pill's
// emblem (Granola's nub shows its logo glyph the same way). A 96 px white PNG
// with alpha, cut from icons/stable/icon.png; tinted as a template image.
enum UpshotEmblem {
  static let image: NSImage? = {
    guard let data = Data(base64Encoded: pngBase64, options: .ignoreUnknownCharacters) else {
      return nil
    }
    let image = NSImage(data: data)
    image?.isTemplate = true
    return image
  }()

  private static let pngBase64 = """
    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
    """
}

struct UpshotEmblemView: View {
  let color: Color

  var body: some View {
    if let image = UpshotEmblem.image {
      Image(nsImage: image)
        .renderingMode(.template)
        .resizable()
        .interpolation(.high)
        .aspectRatio(contentMode: .fit)
        .foregroundStyle(color)
    }
  }
}
