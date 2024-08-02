import { AudioListener, AudioLoader, AudioAnalyser } from "three";
import { useRef, useEffect, useState, Suspense } from "react";
import { useLoader, useFrame } from "@react-three/fiber";
import { MathUtils } from "three";
import { mutation, useStore } from "../state/useStore";
import introSong from "../audio/intro-loop.mp3";
import mainSong from "../audio/main-nodrums.mp3";
import mainSongDrums from "../audio/main-onlydrums.mp3";

function Music() {
  const introPlayer = useRef();
  const themePlayer = useRef();
  const drumPlayer = useRef();
  const soundOrigin = useRef();
  const musicEnabled = useStore((s) => s.musicEnabled);
  const gameStarted = useStore((s) => s.gameStarted);
  const gameOver = useStore((s) => s.gameOver);
  const camera = useStore((s) => s.camera);
  const level = useStore((s) => s.level);
  // const hasInteracted = useStore((s) => s.hasInteracted);
  const [listener] = useState(() => new AudioListener());
  const introTheme = useLoader(AudioLoader, introSong);
  const mainTheme = useLoader(AudioLoader, mainSong);
  const mainThemeDrums = useLoader(AudioLoader, mainSongDrums);
  const themeFilter = useRef();
  const audioAnalyzer = useRef();
  const introVolume = useRef(1);
  const themeVolume = useRef(0);
  const drumVolume = useRef(0);
  const introPlaying = useRef(true);
  const startCrossfade = useRef(false);

  const handleUserGesture = () => {
    [introPlayer, themePlayer, drumPlayer].forEach((player) => {
      if (player.current?.context.state === "suspended") {
        player.current.context.resume();
      }
    });
  };

  useEffect(() => {
    document.addEventListener("click", handleUserGesture, { once: true });
    document.addEventListener("keydown", handleUserGesture, { once: true });

    return () => {
      document.removeEventListener("click", handleUserGesture);
      document.removeEventListener("keydown", handleUserGesture);
    };
  }, []);

  useEffect(() => {
    if (introPlayer.current) {
      introPlayer.current.setBuffer(introTheme);
    }
  }, [introTheme]);

  useEffect(() => {
    if (themePlayer.current) {
      themePlayer.current.setBuffer(mainTheme);
      themeFilter.current = themePlayer.current.context.createBiquadFilter();
      themeFilter.current.type = "lowpass";
      themeFilter.current.frequency.value = 0;
      themePlayer.current.setFilter(themeFilter.current);
    }
  }, [mainTheme]);

  useEffect(() => {
    if (drumPlayer.current) {
      drumPlayer.current.setBuffer(mainThemeDrums);
      audioAnalyzer.current = new AudioAnalyser(drumPlayer.current, 32);
    }
  }, [mainThemeDrums]);

  useEffect(() => {
    if (!musicEnabled) {
      if (introPlayer.current?.isPlaying) {
        introPlayer.current.stop();
      }
      if (themePlayer.current?.isPlaying) {
        themePlayer.current.stop();
        drumPlayer.current.stop();
      }
    }
  }, [musicEnabled]);

  useEffect(() => {
    if (musicEnabled && !gameOver) {
      if (!introPlayer.current?.isPlaying) {
        introPlayer.current.play();
        introPlaying.current = true;
      }
    } else {
      if (introPlayer.current?.isPlaying) {
        introPlayer.current.stop();
      }
    }

    if (introPlayer.current) introPlayer.current.setLoop(true);
    if (themePlayer.current) themePlayer.current.setLoop(true);
    if (drumPlayer.current) drumPlayer.current.setLoop(true);

    if (camera.current) {
      const cam = camera.current;
      cam.add(listener);
      return () => cam.remove(listener);
    }
  }, [
    musicEnabled,
    introTheme,
    mainTheme,
    mainThemeDrums,
    gameStarted,
    gameOver,
    camera,
    listener,
  ]);

  useEffect(() => {
    if (level > 0 && level % 2 === 0) {
      if (themePlayer.current)
        themePlayer.current.setPlaybackRate(1 + level * 0.02);
      if (drumPlayer.current)
        drumPlayer.current.setPlaybackRate(1 + level * 0.02);
    } else if (level === 0) {
      if (themePlayer.current) themePlayer.current.setPlaybackRate(1);
      if (drumPlayer.current) drumPlayer.current.setPlaybackRate(1);
    }
  }, [level]);

  useFrame((state, delta) => {
    if (musicEnabled) {
      if (audioAnalyzer.current) {
        const audioLevel = MathUtils.inverseLerp(
          0,
          255,
          audioAnalyzer.current.getFrequencyData()[0]
        );
        mutation.currentMusicLevel = audioLevel;
      }

      // Start playing main theme "on the beat" when game starts
      if (gameStarted && !themePlayer.current?.isPlaying) {
        if (introPlayer.current?.context.currentTime.toFixed(1) % 9.6 === 0) {
          startCrossfade.current = true;
          themePlayer.current.play();
          drumPlayer.current.play();
          themePlayer.current.setVolume(0);
          drumPlayer.current.setVolume(0);
        }
      }

      // Crossfade intro music to main theme when game starts
      if (gameStarted && !gameOver && themeVolume.current < 1) {
        if (!themePlayer.current?.isPlaying) {
          themePlayer.current.play();
          drumPlayer.current.play();
        }

        if (themeFilter.current) {
          themeFilter.current.frequency.value += delta * 4000;
        }

        themeVolume.current = Math.min(1, themeVolume.current + delta * 0.2);
        drumVolume.current = Math.min(1, drumVolume.current + delta * 0.2);
        introVolume.current = Math.max(0, introVolume.current - delta * 0.2);

        if (introPlayer.current)
          introPlayer.current.setVolume(introVolume.current);
        if (themePlayer.current)
          themePlayer.current.setVolume(themeVolume.current);
        if (drumPlayer.current)
          drumPlayer.current.setVolume(drumVolume.current);
      }

      // Crossfade main theme back to intro on game over
      if (gameOver && introVolume.current < 1) {
        if (!introPlayer.current?.isPlaying) {
          introPlayer.current.play();
        }

        if (themeFilter.current) {
          themeFilter.current.frequency.value -= delta * 4000;
        }

        themeVolume.current = Math.max(0, themeVolume.current - delta * 0.2);
        drumVolume.current = Math.max(0, drumVolume.current - delta * 0.2);
        introVolume.current = Math.min(1, introVolume.current + delta * 0.2);

        if (introPlayer.current)
          introPlayer.current.setVolume(introVolume.current);
        if (themePlayer.current)
          themePlayer.current.setVolume(themeVolume.current);
        if (drumPlayer.current)
          drumPlayer.current.setVolume(drumVolume.current);
      }
    }
  });

  return (
    <group ref={soundOrigin}>
      <audio ref={introPlayer} args={[listener]} />
      <audio ref={themePlayer} args={[listener]} />
      <audio ref={drumPlayer} args={[listener]} />
    </group>
  );
}

export default function SuspenseMusic() {
  return (
    <Suspense fallback={null}>
      <Music />
    </Suspense>
  );
}
