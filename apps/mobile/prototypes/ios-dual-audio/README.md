# iPhone dual-audio probe

This standalone, local-only iOS app tests whether a user-selected full-display ScreenCaptureKit stream delivers *separate* `.audio` (device playback) and `.microphone` buffers. It saves each stream to its own AAC file and displays sample and dropped-buffer counts. It does not connect to Anarlog sessions, transcription, or sync, and it does not assign speaker identities.

Apple's [iOS ScreenCaptureKit sample](https://developer.apple.com/documentation/screencapturekit/capturing-screen-content-on-ios) requires an iPhone with **iOS 27 beta** and **Xcode 27 beta**. The system picker controls what is captured, including whether the microphone is enabled. This experiment has **not** been compiled or tested on an iPhone; the development environment used to prepare it is Linux.

## Run on a Mac

1. Install Xcode 27 beta and [XcodeGen](https://github.com/yonaskolb/XcodeGen). Connect an iPhone running iOS 27 beta and pair AirPods.
2. In this directory, run `xcodegen generate --spec project.yml`, then open `AnarlogDualAudioProbe.xcodeproj` in Xcode. Select your development team in Signing & Capabilities, and change the bundle ID if necessary. Build and run on the iPhone, not the simulator.
3. Tap **Choose full display**. Select the full display in Apple's picker and turn **Microphone** on. Start with an ordinary media player, then try the intended meeting app. While wearing AirPods, play known remote audio and speak a different phrase into the mic, with some overlap. Return to the probe and tap **Stop capture**.
4. The probe shows a sample count, dropped buffers, and first/last presentation timestamps (PTS) for each channel. It offers separate **Share** actions for `microphone.m4a` and `device-audio.m4a`. Listen to *both* exports. Compare whether the spoken phrase is on the mic track, whether playback is on the device track, whether their PTS ranges overlap, and whether either track contains silence or leaked audio. The files each start at their own first sample; use the reported PTS values to account for any offset between them. Repeat with the intended meeting app; a successful media-player test does not establish access to another app's call audio.

Files are stored in the app's local Documents directory under `AudioProbes/<capture ID>/` and are never uploaded by this probe. Remove the app to delete its recordings. A positive sample count only means a buffer was received; Apple notes that unavailable microphone audio may be delivered as silence. Write down the iOS build, device model, AirPods model, playback app, microphone selection, playback route, both counts, whether each exported file is audible, and whether audio overlaps before considering production integration.

Apple's [Developer Technical Support answer](https://developer.apple.com/forums/thread/841340) says that third-party apps cannot directly tap another app's live call audio. Even if ScreenCaptureKit produces device audio for ordinary media, meeting-call audio may be excluded.

The probe intentionally stays outside the Expo build. Do not infer that Anarlog mobile can capture both sources until an on-device test demonstrates non-silent independent recordings with the required audio source.
