import SwiftUI

@main
struct AudioProbeApp: App {
  @StateObject private var capture = DualAudioCapture()

  var body: some Scene {
    WindowGroup {
      NavigationStack {
        Form {
          Section("Capture") {
            Text(capture.status)
            Text("Playback route: \(capture.audioRoute.isEmpty ? "Unknown" : capture.audioRoute)")
            if capture.recording {
              Button("Stop capture") {
                Task { await capture.stop() }
              }
              .disabled(capture.busy)
            } else {
              Button("Choose full display") {
                capture.presentPicker()
              }
              .disabled(capture.busy)
            }
          }
          Section("Separate audio files") {
            Text(capture.counts.isEmpty ? "No capture yet" : capture.counts)
            if let microphoneURL = capture.microphoneURL {
              ShareLink("Share microphone.m4a", item: microphoneURL)
            }
            if let deviceAudioURL = capture.deviceAudioURL {
              ShareLink("Share device-audio.m4a", item: deviceAudioURL)
            }
          }
          Section {
            Text("These files stay on this device until you share them or delete the app. "
              + "A sample count does not prove that a track contains audible sound.")
          }
        }
        .navigationTitle("Dual audio probe")
      }
    }
  }
}
