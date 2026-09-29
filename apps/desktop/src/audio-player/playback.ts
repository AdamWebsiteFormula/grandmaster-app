export function configureCenteredPlayback(
  media: HTMLMediaElement,
  createContext: () => AudioContext = () => new AudioContext(),
): AudioContext | null {
  let context: AudioContext;
  try {
    context = createContext();
  } catch {
    return null;
  }

  try {
    const source = context.createMediaElementSource(media);
    const gainNode = context.createGain();
    gainNode.channelCount = 1;
    gainNode.channelCountMode = "explicit";
    gainNode.channelInterpretation = "speakers";
    source.connect(gainNode);
    gainNode.connect(context.destination);
  } catch {
    void context.close().catch(() => {});
    return null;
  }

  return context;
}
