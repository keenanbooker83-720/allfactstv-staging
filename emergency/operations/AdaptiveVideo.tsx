import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react';
import type { VideoHTMLAttributes } from 'react';

/**
 * Native progressive MP4 playback is unchanged.
 * HLS/DASH manifests are played through Shaka when supported, with
 * native HLS as a Safari fallback. No access to private masters is added.
 */
type AdaptiveVideoProps = Omit<VideoHTMLAttributes<HTMLVideoElement>, 'src'> & {
  src: string;
  onPlaybackError?: (message: string) => void;
};

const AdaptiveVideo = forwardRef<HTMLVideoElement, AdaptiveVideoProps>(function AdaptiveVideo(
  { src, onPlaybackError, ...attributes }, forwardedRef
) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const errorRef = useRef(onPlaybackError);
  errorRef.current = onPlaybackError;
  useImperativeHandle(forwardedRef, () => videoRef.current as HTMLVideoElement, []);

  const adaptive = /\.(?:m3u8|mpd)(?:[?#]|$)/i.test(src);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !adaptive || !src) return;
    let cancelled = false;
    let player: { destroy: () => Promise<void> } | undefined;

    const start = async () => {
      if (/\.m3u8(?:[?#]|$)/i.test(src) && video.canPlayType('application/vnd.apple.mpegurl')) {
        video.src = src;
        video.load();
        if (video.autoplay) void video.play().catch(() => { /* user gesture required */ });
        return;
      }

      // Download Shaka only when an adaptive stream is actually selected.
      const module = await import('shaka-player');
      const shaka = module.default;
      if (cancelled) return;
      shaka.polyfill.installAll();
      if (!shaka.Player.isBrowserSupported()) {
        errorRef.current?.('Adaptive playback is not supported by this browser.');
        return;
      }
      const instance = new shaka.Player();
      player = instance;
      instance.configure({ streaming: { bufferingGoal: 20, rebufferingGoal: 2 } });
      instance.addEventListener('error', () => {
        if (!cancelled) errorRef.current?.('Adaptive stream encountered a playback error.');
      });
      await instance.attach(video);
      if (cancelled) return;
      await instance.load(src);
      if (cancelled) return;
      if (video.autoplay) void video.play().catch(() => { /* user gesture required */ });
    };

    void start().catch((error: unknown) => {
      if (!cancelled) errorRef.current?.(error instanceof Error ? error.message : 'Adaptive playback failed.');
    });

    return () => {
      cancelled = true;
      if (player) void player.destroy().catch(() => { /* already detached */ });
    };
  }, [adaptive, src]);

  return <video {...attributes} ref={videoRef} src={adaptive ? undefined : src} />;
});

export default AdaptiveVideo;