// Soundboard helper for classic ChGK cues.
const SOUND_MAP = {
  spin: "assets/sounds/spin.mp3",
  gong: "assets/sounds/gong.mp3",
  tick: "assets/sounds/tick.mp3",
  end: "assets/sounds/end.mp3",
};

export const createSoundboard = () => {
  const audio = {};
  Object.entries(SOUND_MAP).forEach(([key, src]) => {
    const element = new Audio(src);
    element.preload = "auto";
    audio[key] = element;
  });

  return {
    // Returns boolean to signal autoplay success/failure to the UI layer.
    async play(name) {
      const sound = audio[name];
      if (!sound) return false;
      sound.currentTime = 0;
      try {
        await sound.play();
        return true;
      } catch (error) {
        return false;
      }
    },
    setVolume(value) {
      Object.values(audio).forEach((sound) => {
        sound.volume = value;
      });
    },
    mute(state) {
      Object.values(audio).forEach((sound) => {
        sound.muted = state;
      });
    },
  };
};
