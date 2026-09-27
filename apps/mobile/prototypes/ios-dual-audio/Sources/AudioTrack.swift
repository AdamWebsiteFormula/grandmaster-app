import AVFoundation
import CoreMedia

final class AudioTrack {
  let url: URL
  private(set) var sampleCount = 0
  private(set) var droppedBufferCount = 0
  private(set) var firstTimestamp: Double?
  private(set) var lastTimestamp: Double?

  private var writer: AVAssetWriter?
  private var input: AVAssetWriterInput?

  init(url: URL) {
    self.url = url
  }

  func append(_ buffer: CMSampleBuffer) throws {
    guard CMSampleBufferDataIsReady(buffer), CMSampleBufferGetNumSamples(buffer) > 0 else {
      return
    }

    if writer == nil {
      guard let format = CMSampleBufferGetFormatDescription(buffer),
        let description = CMAudioFormatDescriptionGetStreamBasicDescription(format)
      else {
        throw CaptureError.invalidAudioFormat
      }
      let writer = try AVAssetWriter(outputURL: url, fileType: .m4a)
      let input = AVAssetWriterInput(
        mediaType: .audio,
        outputSettings: [
          AVFormatIDKey: kAudioFormatMPEG4AAC,
          AVSampleRateKey: description.pointee.mSampleRate,
          AVNumberOfChannelsKey: Int(description.pointee.mChannelsPerFrame),
          AVEncoderBitRateKey: 128_000,
        ]
      )
      input.expectsMediaDataInRealTime = true
      guard writer.canAdd(input) else { throw CaptureError.invalidAudioFormat }
      writer.add(input)
      guard writer.startWriting() else {
        throw writer.error ?? CaptureError.writerFailed
      }
      writer.startSession(atSourceTime: CMSampleBufferGetPresentationTimeStamp(buffer))
      self.writer = writer
      self.input = input
      firstTimestamp = CMTimeGetSeconds(CMSampleBufferGetPresentationTimeStamp(buffer))
    }

    guard let writer, let input else { throw CaptureError.writerFailed }
    guard input.isReadyForMoreMediaData else {
      droppedBufferCount += 1
      return
    }
    guard input.append(buffer) else {
      throw writer.error ?? CaptureError.writerFailed
    }
    sampleCount += CMSampleBufferGetNumSamples(buffer)
    lastTimestamp = CMTimeGetSeconds(CMSampleBufferGetPresentationTimeStamp(buffer))
  }

  func finish() async throws -> URL? {
    guard let writer, let input else { return nil }
    guard writer.status == .writing else {
      throw writer.error ?? CaptureError.writerFailed
    }
    input.markAsFinished()
    await withCheckedContinuation { continuation in
      writer.finishWriting {
        continuation.resume()
      }
    }
    guard writer.status == .completed else {
      throw writer.error ?? CaptureError.writerFailed
    }
    return url
  }
}

enum CaptureError: LocalizedError {
  case invalidAudioFormat
  case writerFailed

  var errorDescription: String? {
    switch self {
    case .invalidAudioFormat: "The captured audio format could not be encoded."
    case .writerFailed: "The captured audio file could not be written."
    }
  }
}
