import type { MusicTrack } from './settings';

export type PlayableMusicTrack = 'chefe-final' | 'veludo-no-cafe';

export const MUSIC_SRC: Record<PlayableMusicTrack, string> = {
  'chefe-final': '/Chefe%20Final.mp3',
  'veludo-no-cafe': '/Veludo%20No%20Caf%C3%A9.mp3',
};

/** Resolve a faixa efetiva (modo combinado troca conforme fases na mesa). */
export function resolveEffectiveMusicTrack(
  track: MusicTrack,
  hasPhasesOnTable: boolean,
): PlayableMusicTrack | null {
  if (track === 'none') return null;
  if (track === 'combined') {
    return hasPhasesOnTable ? 'chefe-final' : 'veludo-no-cafe';
  }
  return track;
}
