import Cocoa

extension QuitInterceptor {
  func makePanel() -> NSPanel {
    let frame = centeredFrame(size: QuitOverlay.size)

    let panel = NSPanel(
      contentRect: frame,
      styleMask: [.borderless, .nonactivatingPanel],
      backing: .buffered,
      defer: false
    )

    panel.level = .floating
    panel.isFloatingPanel = true
    panel.hidesOnDeactivate = false
    panel.isOpaque = false
    panel.backgroundColor = .clear
    panel.hasShadow = true
    panel.collectionBehavior = [.canJoinAllSpaces, .fullScreenAuxiliary, .ignoresCycle]
    panel.isMovableByWindowBackground = false
    panel.ignoresMouseEvents = true

    panel.contentView = makeContentView(size: QuitOverlay.size)
    return panel
  }

  func centeredFrame(size: NSSize) -> NSRect {
    guard let screen = NSScreen.main ?? NSScreen.screens.first else {
      return NSRect(origin: .zero, size: size)
    }
    let origin = NSPoint(
      x: screen.frame.midX - size.width / 2,
      y: screen.frame.midY - size.height / 2 + screen.frame.height * QuitOverlay.verticalOffsetRatio
    )
    return NSRect(origin: origin, size: size)
  }

  func makeContentView(size: NSSize) -> NSView {
    let container = NSView(frame: NSRect(origin: .zero, size: size))
    container.wantsLayer = true
    container.layer?.backgroundColor = QuitOverlay.backgroundColor.cgColor
    container.layer?.cornerRadius = QuitOverlay.cornerRadius
    container.layer?.masksToBounds = true

    let messageLabel = makeLabel(QuitOverlay.messageText, color: QuitOverlay.primaryTextColor)
    self.messageLabel = messageLabel
    // Fork: a second, smaller line says a recording stops (journey-meeting P2).
    let detailLabel = makeLabel(
      QuitOverlay.detailText, color: QuitOverlay.secondaryTextColor, font: QuitOverlay.detailFont)

    let blockHeight =
      messageLabel.frame.height + QuitOverlay.lineSpacing + detailLabel.frame.height
    let bottom = (size.height - blockHeight) / 2

    detailLabel.frame = NSRect(
      x: (size.width - detailLabel.frame.width) / 2,
      y: bottom,
      width: detailLabel.frame.width,
      height: detailLabel.frame.height
    )
    messageLabel.frame = NSRect(
      x: (size.width - messageLabel.frame.width) / 2,
      y: bottom + detailLabel.frame.height + QuitOverlay.lineSpacing,
      width: messageLabel.frame.width,
      height: messageLabel.frame.height
    )

    container.addSubview(messageLabel)
    container.addSubview(detailLabel)

    return container
  }

  func makeLabel(_ text: String, color: NSColor, font: NSFont = QuitOverlay.font) -> NSTextField {
    let label = NSTextField(labelWithString: text)
    label.font = font
    label.textColor = color
    label.alignment = .left
    label.sizeToFit()
    return label
  }

  // MARK: - Panel Visibility

  func showOverlay() {
    if panel == nil {
      panel = makePanel()
    }
    guard let panel else { return }

    panel.alphaValue = 0
    panel.orderFrontRegardless()

    NSAnimationContext.runAnimationGroup { context in
      context.duration = QuitOverlay.animationDuration
      context.timingFunction = CAMediaTimingFunction(name: .easeOut)
      panel.animator().alphaValue = 1.0
    }
  }

  func hidePanel() {
    guard let panel else { return }

    NSAnimationContext.runAnimationGroup({ context in
      context.duration = QuitOverlay.animationDuration
      context.timingFunction = CAMediaTimingFunction(name: .easeIn)
      panel.animator().alphaValue = 0
    }) {
      panel.orderOut(nil)
    }
  }
}
