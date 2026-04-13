class SoundManager {
  private sounds: { [key: string]: HTMLAudioElement } = {};
  private muted: boolean = false;

  constructor() {
    this.loadSound('cast', 'https://assets.mixkit.co/active_storage/sfx/2571/2571-preview.mp3');
    this.loadSound('bite', 'https://assets.mixkit.co/active_storage/sfx/1340/1340-preview.mp3');
    this.loadSound('catch_common', 'https://assets.mixkit.co/active_storage/sfx/2000/2000-preview.mp3');
    this.loadSound('catch_rare', 'https://assets.mixkit.co/active_storage/sfx/2019/2019-preview.mp3');
    this.loadSound('catch_legendary', 'https://assets.mixkit.co/active_storage/sfx/2020/2020-preview.mp3');
    this.loadSound('junk', 'https://assets.mixkit.co/active_storage/sfx/2572/2572-preview.mp3');
    this.loadSound('click', 'https://assets.mixkit.co/active_storage/sfx/2568/2568-preview.mp3');
  }

  private loadSound(key: string, url: string) {
    const audio = new Audio(url);
    audio.preload = 'auto';
    this.sounds[key] = audio;
  }

  play(key: string) {
    if (this.muted || !this.sounds[key]) return;
    const sound = this.sounds[key];
    sound.currentTime = 0;
    sound.play().catch(e => console.warn('Audio play blocked', e));
  }

  toggleMute() {
    this.muted = !this.muted;
    return this.muted;
  }

  isMuted() {
    return this.muted;
  }
}

export const soundManager = new SoundManager();
