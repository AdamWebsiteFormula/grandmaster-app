import AVFoundation
import CoreMedia
import ScreenCaptureKit
import SwiftUI

final class DualAudioCapture: NSObject, ObservableObject, SCContentSharingPickerObserver,
  SCStreamOutput, SCStreamDelegate
{
  @Published private(set) var status = "Ready"
  @Published private(set) var recording = false
  @Published private(set) var busy = false
  @Published private(set) var microphoneURL: URL?
  @Published private(set) var deviceAudioURL: URL?
  @Published private(set) var counts = ""
  @Published private(set) var audioRoute = ""

  private let picker = SCContentSharingPicker.shared
  private let sampleQueue = DispatchQueue(label: "so.anarlog.dual-audio.samples")
  private var stream: SCStream?
  private var microphone: AudioTrack?
  private var deviceAudio: AudioTrack?
  private var sampleError: Error?

  override init() {
    super.init()
    picker.add(self)
  }

  deinit {
    picker.remove(self)
  }

  func presentPicker() {
    guard !recording && !busy else { return }
    microphoneURL = nil
    deviceAudioURL = nil
    counts = ""
    status = "Choose the full display and enable Microphone."
    var configuration = SCContentSharingPickerConfiguration()
    configuration.showsMicrophoneControl = true
    picker.defaultConfiguration = configuration
    picker.isActive = true
    picker.present()
  }

  func contentSharingPicker(
    _ picker: SCContentSharingPicker,
    didUpdateWith filter: SCContentFilter,
    for stream: SCStream?
  ) {
    Task { @MainActor in
      await start(with: filter)
    }
  }

  func contentSharingPicker(_ picker: SCContentSharingPicker, didCancelFor stream: SCStream?) {
    DispatchQueue.main.async { self.status = "Selection canceled." }
  }

  func contentSharingPickerStartDidFailWithError(_ error: Error) {
    DispatchQueue.main.async { self.status = error.localizedDescription }
  }

  @MainActor
  private func start(with filter: SCContentFilter) async {
    guard !recording && !busy else { return }
    busy = true
    defer { busy = false }

    do {
      let directory = FileManager.default.urls(for: .documentDirectory, in: .userDomainMask)[0]
        .appendingPathComponent("AudioProbes", isDirectory: true)
        .appendingPathComponent(UUID().uuidString, isDirectory: true)
      try FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true)
      microphone = AudioTrack(url: directory.appendingPathComponent("microphone.m4a"))
      deviceAudio = AudioTrack(url: directory.appendingPathComponent("device-audio.m4a"))
      sampleError = nil

      try AVAudioSession.sharedInstance().setCategory(.playback, mode: .default, options: .mixWithOthers)
      try AVAudioSession.sharedInstance().setActive(true)
      audioRoute = AVAudioSession.sharedInstance().currentRoute.outputs
        .map(\.portName).joined(separator: ", ")

      let configuration = SCStreamConfiguration()
      configuration.capturesAudio = true
      configuration.captureMicrophone = filter.isMicrophoneEnabled
      configuration.sampleRate = 48_000
      configuration.channelCount = 1
      let newStream = SCStream(filter: filter, configuration: configuration, delegate: self)
      try newStream.addStreamOutput(self, type: .screen, sampleHandlerQueue: sampleQueue)
      try newStream.addStreamOutput(self, type: .audio, sampleHandlerQueue: sampleQueue)
      if filter.isMicrophoneEnabled {
        try newStream.addStreamOutput(self, type: .microphone, sampleHandlerQueue: sampleQueue)
      }
      try await newStream.startCapture()
      stream = newStream
      recording = true
      status = filter.isMicrophoneEnabled
        ? "Capturing device audio and microphone."
        : "Microphone disabled in the system picker; only device audio is capturing."
    } catch {
      status = error.localizedDescription
      stream = nil
      microphone = nil
      deviceAudio = nil
    }
  }

  func stream(
    _ stream: SCStream,
    didOutputSampleBuffer sampleBuffer: CMSampleBuffer,
    of type: SCStreamOutputType
  ) {
    guard sampleError == nil else { return }
    do {
      switch type {
      case .audio:
        try deviceAudio?.append(sampleBuffer)
      case .microphone:
        try microphone?.append(sampleBuffer)
      default:
        break
      }
    } catch {
      sampleError = error
    }
  }

  func stream(_ stream: SCStream, didStopWithError error: Error) {
    Task { @MainActor in
      await stop(reason: error)
    }
  }

  @MainActor
  func stop(reason: Error? = nil) async {
    guard recording && !busy else { return }
    busy = true
    recording = false
    var stopError: Error?
    do {
      try await stream?.stopCapture()
    } catch {
      stopError = error
    }
    stream = nil
    let (mic, device, error) = sampleQueue.sync {
      (microphone, deviceAudio, sampleError)
    }
    do {
      microphoneURL = try await mic?.finish()
      deviceAudioURL = try await device?.finish()
      counts = "Mic: \(mic?.sampleCount ?? 0) samples, \(mic?.droppedBufferCount ?? 0) dropped buffers, "
        + "PTS \(mic?.firstTimestamp ?? 0)–\(mic?.lastTimestamp ?? 0)s. "
        + "Device: \(device?.sampleCount ?? 0) samples, \(device?.droppedBufferCount ?? 0) dropped buffers, "
        + "PTS \(device?.firstTimestamp ?? 0)–\(device?.lastTimestamp ?? 0)s."
      if let error { throw error }
      if let stopError { throw stopError }
      if let reason {
        status = reason.localizedDescription
      } else {
        status = "Capture finished. Inspect both files for non-silent, independent audio."
      }
    } catch {
      status = error.localizedDescription
    }
    microphone = nil
    deviceAudio = nil
    busy = false
  }
}
