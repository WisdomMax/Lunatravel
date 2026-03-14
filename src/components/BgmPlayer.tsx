import { useRef, useEffect } from 'react';
import { useTravel } from '../context/TravelContext';

interface BgmPlayerProps {
  view: 'setup' | 'app';
}

export default function BgmPlayer({ view }: BgmPlayerProps) {
  const { state } = useTravel();
  const { isBgmPlaying, bgmVolume, currentBgmIndex, bgmPlaylist } = state;
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // 자동 재생 정책 대응 및 실제 재생 성공 보장 로직
  useEffect(() => {
    const player = audioRef.current;
    if (!player) return;

    const playBgm = () => {
      if (isBgmPlaying && bgmPlaylist.length > 0 && bgmPlaylist[currentBgmIndex]?.url) {
        // [복원 로직] Setup은 0.3, App은 0.15 배수를 적용하여 사용자 체감 볼륨을 제어합니다.
        const multiplier = view === 'setup' ? 0.3 : 0.15;
        const actualVolume = bgmVolume * multiplier;
        
        console.log(`[BGM] Playback (${view}): ${(bgmVolume * 100).toFixed(0)}% * ${multiplier} = ${(actualVolume * 100).toFixed(1)}%`);
        player.volume = actualVolume;
        player.loop = true; // 무조건 무한 루프
        player.play().then(() => {
          cleanupListeners();
        }).catch((err) => {
          console.warn("[BGM] Autoplay blocked, waiting for interaction.");
        });
      } else {
        player.pause();
      }
    };

    const handleInteraction = () => {
      console.log("[BGM] User interaction detected, forcing play...");
      playBgm();
    };

    const cleanupListeners = () => {
      window.removeEventListener('click', handleInteraction);
      window.removeEventListener('keydown', handleInteraction);
      window.removeEventListener('touchstart', handleInteraction);
      window.removeEventListener('mousedown', handleInteraction);
    };

    playBgm();

    window.addEventListener('click', handleInteraction);
    window.addEventListener('keydown', handleInteraction);
    window.addEventListener('touchstart', handleInteraction);
    window.addEventListener('mousedown', handleInteraction);

    return () => cleanupListeners();
  }, [isBgmPlaying, currentBgmIndex, bgmPlaylist.length, bgmPlaylist[currentBgmIndex]?.url, bgmVolume]);

  // 볼륨 및 뷰 전환 실시간 대응
  useEffect(() => {
    if (!audioRef.current) return;
    const multiplier = view === 'setup' ? 0.3 : 0.15;
    const actualVolume = bgmVolume * multiplier;
    audioRef.current.volume = actualVolume;
    audioRef.current.loop = true;
    console.log(`[BGM] View changed to ${view}, adjusting volume multiplier to ${multiplier}`);
  }, [bgmVolume, view]);

  const handleEnded = () => {
    // [원복] 랜덤 선택된 1곡만 계속 무한 반복함
    if (audioRef.current) {
      audioRef.current.currentTime = 0;
      audioRef.current.play().catch(e => console.error("[BGM] Loop restart failed:", e));
    }
  };

  return (
    <audio
      ref={audioRef}
      src={bgmPlaylist[currentBgmIndex]?.url}
      onEnded={handleEnded}
      preload="auto"
    />
  );
}
