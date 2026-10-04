import AVFoundation
import Foundation

// Opens the default microphone for N seconds, so Upshot's meeting detector
// sees a new app using the mic. Usage: MeetingTest [seconds]
let seconds = Double(CommandLine.arguments.dropFirst().first ?? "8") ?? 8
let engine = AVAudioEngine()
let input = engine.inputNode
let format = input.outputFormat(forBus: 0)
input.installTap(onBus: 0, bufferSize: 1024, format: format) { _, _ in }
do {
  try engine.start()
  print("mic open")
} catch {
  print("mic failed: \(error)")
  exit(1)
}
Thread.sleep(forTimeInterval: seconds)
engine.stop()
print("mic closed")
