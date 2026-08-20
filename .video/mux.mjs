/* Mux the silent picture render with the synthesised sound-design bed. */
import { spawnSync } from 'node:child_process';
import ffmpegPath from 'ffmpeg-static';

const [video, audio = 'out/sound.wav', out] = process.argv.slice(2);
if (!video || !out) {
  console.error('usage: node mux.mjs <video.mp4> [audio.wav] <out.mp4>');
  process.exit(1);
}

const r = spawnSync(
  ffmpegPath,
  [
    '-y', '-hide_banner', '-loglevel', 'error',
    '-i', video,
    '-i', audio,
    '-c:v', 'copy',
    '-c:a', 'aac', '-b:a', '192k', '-ar', '48000',
    '-shortest', '-movflags', '+faststart',
    out,
  ],
  { stdio: 'inherit' }
);
process.exit(r.status ?? 1);
