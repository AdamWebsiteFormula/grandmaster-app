import Cocoa

// Fork: the meeting prompt, Granola's "nub" (Granola 7.637): a small card at the
// right screen edge, 70% down, with the meeting name, "Take notes" and "Not now".
// It sends the same events as the notification card, so the app handles it the
// same way. One prompt at a time; a new one replaces the old one.
enum PromptLayout {
  static let width: CGFloat = 148
  static let padding: CGFloat = 12
  static let iconSize: CGFloat = 32
  static let buttonHeight: CGFloat = 28
  static let spacing: CGFloat = 8
  static let edgeMargin: CGFloat = 8
  // Granola puts the top of the nub 70% of the way down the screen.
  static let verticalRatio: CGFloat = 0.7
}

final class PromptButton: NotificationButton {
  var onPress: (() -> Void)?

  override var intrinsicContentSize: NSSize {
    NSSize(width: NSView.noIntrinsicMetric, height: PromptLayout.buttonHeight)
  }

  override func performAction() {
    onPress?()
  }
}

final class MeetingPromptController {
  static let shared = MeetingPromptController()

  private var panel: NSPanel?
  private var key: String?
  private var dismissTimer: Timer?

  private init() {}

  func show(payload: NotificationPayload, manager: NotificationManager) {
    close()
    guard let screen = manager.getTargetScreen() else { return }

    let cornerRadius = manager.notificationCornerRadius()
    let content = makeContent(payload: payload, manager: manager)
    let size = NSSize(width: PromptLayout.width, height: ceil(content.fittingSize.height))

    let visible = screen.visibleFrame
    let finalX = visible.maxX - size.width - PromptLayout.edgeMargin
    let top = visible.maxY - (visible.height - size.height) * PromptLayout.verticalRatio
    let y = max(visible.minY + PromptLayout.edgeMargin, top - size.height)

    let panel = NSPanel(
      contentRect: NSRect(x: visible.maxX + Layout.slideInOffset, y: y, width: size.width, height: size.height),
      styleMask: [.borderless, .nonactivatingPanel],
      backing: .buffered,
      defer: false,
      screen: screen
    )
    panel.level = NSWindow.Level(rawValue: Int(Int32.max))
    panel.isFloatingPanel = true
    panel.hidesOnDeactivate = false
    panel.isOpaque = false
    panel.backgroundColor = .clear
    panel.hasShadow = true
    panel.collectionBehavior = [.canJoinAllSpaces, .fullScreenAuxiliary, .ignoresCycle]
    panel.isMovableByWindowBackground = false
    panel.alphaValue = 0

    let root = NSView(frame: NSRect(origin: .zero, size: size))
    root.wantsLayer = true
    root.layer?.cornerRadius = cornerRadius
    root.layer?.masksToBounds = true
    if #available(macOS 11.0, *) {
      root.layer?.cornerCurve = .continuous
    }

    let effectView = NSVisualEffectView(frame: root.bounds)
    effectView.material = .popover
    effectView.state = .active
    effectView.blendingMode = .behindWindow
    effectView.autoresizingMask = [.width, .height]
    root.addSubview(effectView)

    if manager.isMacOS26() {
      let background = NotificationBackgroundView(frame: root.bounds)
      background.cornerRadius = cornerRadius
      background.autoresizingMask = [.width, .height]
      background.makeBackgroundLiquidGlass()
      root.addSubview(background)
    }

    content.translatesAutoresizingMaskIntoConstraints = false
    root.addSubview(content)
    NSLayoutConstraint.activate([
      content.leadingAnchor.constraint(equalTo: root.leadingAnchor),
      content.trailingAnchor.constraint(equalTo: root.trailingAnchor),
      content.topAnchor.constraint(equalTo: root.topAnchor),
      content.bottomAnchor.constraint(equalTo: root.bottomAnchor),
    ])

    panel.contentView = root
    self.panel = panel
    self.key = payload.key

    panel.orderFrontRegardless()
    NSAnimationContext.runAnimationGroup { context in
      context.duration = Timing.slideIn
      context.timingFunction = CAMediaTimingFunction(name: .easeOut)
      panel.animator().setFrame(
        NSRect(x: finalX, y: y, width: size.width, height: size.height), display: true)
      panel.animator().alphaValue = 1.0
    }

    if payload.timeoutSeconds > 0 {
      dismissTimer = Timer.scheduledTimer(
        withTimeInterval: payload.timeoutSeconds, repeats: false
      ) { [weak self] _ in
        guard let self, let key = self.key else { return }
        RustBridge.onCollapsedTimeout(key: key)
        self.close()
      }
    }
  }

  func dismiss(forKey key: String) {
    if self.key == key {
      close()
    }
  }

  func close() {
    dismissTimer?.invalidate()
    dismissTimer = nil
    key = nil
    guard let panel else { return }
    self.panel = nil
    NSAnimationContext.runAnimationGroup(
      { context in
        context.duration = Timing.dismiss
        panel.animator().alphaValue = 0
      },
      completionHandler: {
        panel.orderOut(nil)
      })
  }

  private func makeContent(payload: NotificationPayload, manager: NotificationManager) -> NSView {
    let stack = NSStackView()
    stack.orientation = .vertical
    stack.alignment = .centerX
    stack.spacing = PromptLayout.spacing
    stack.edgeInsets = NSEdgeInsets(
      top: PromptLayout.padding, left: PromptLayout.padding,
      bottom: PromptLayout.padding, right: PromptLayout.padding)

    if let icon = manager.createNotificationIconView(for: payload) {
      icon.widthAnchor.constraint(equalToConstant: PromptLayout.iconSize).isActive = true
      icon.heightAnchor.constraint(equalToConstant: PromptLayout.iconSize).isActive = true
      stack.addArrangedSubview(icon)
    }

    let innerWidth = PromptLayout.width - PromptLayout.padding * 2
    let title = NSTextField(wrappingLabelWithString: payload.title)
    title.font = NSFont.systemFont(ofSize: 13, weight: .semibold)
    title.textColor = NSColor.labelColor
    title.alignment = .center
    title.maximumNumberOfLines = 3
    title.lineBreakMode = .byWordWrapping
    title.cell?.truncatesLastVisibleLine = true
    title.preferredMaxLayoutWidth = innerWidth
    stack.addArrangedSubview(title)
    title.widthAnchor.constraint(equalToConstant: innerWidth).isActive = true
    stack.setCustomSpacing(PromptLayout.spacing + 2, after: title)

    let takeNotes = PromptButton()
    takeNotes.title = payload.actionLabel ?? "Take notes"
    takeNotes.contentTintColor = NSColor.white
    takeNotes.setBackgroundColors(
      normal: Colors.actionButtonBg, pressed: Colors.actionButtonPressedBg)
    takeNotes.layer?.borderColor = NSColor.clear.cgColor
    takeNotes.onPress = { [weak self] in
      guard let self, let key = self.key else { return }
      RustBridge.onExpandedAccept(key: key)
      self.close()
    }

    let notNow = PromptButton()
    notNow.title = "Not now"
    notNow.onPress = { [weak self] in
      guard let self, let key = self.key else { return }
      RustBridge.onDismiss(key: key)
      self.close()
    }

    for button in [takeNotes, notNow] {
      stack.addArrangedSubview(button)
      button.widthAnchor.constraint(equalToConstant: innerWidth).isActive = true
    }

    stack.widthAnchor.constraint(equalToConstant: PromptLayout.width).isActive = true
    return stack
  }
}
