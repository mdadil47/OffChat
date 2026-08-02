export const colors = {
  background: '#FAFAFC',
  surface: '#FFFFFF',
  primary: '#6C5CE7',
  primaryMuted: '#EEECFB',
  textPrimary: '#14141F',
  textSecondary: '#9A99A6',
  hairline: '#ECECF2',
  online: '#3DD98A',
  danger: '#E5484D',
};

const AVATAR_PALETTE = ['#F97C7C', '#6C5CE7', '#3DD98A', '#FFB84D', '#4DA3FF', '#FF7CC5'];

export function avatarColorFor(id: string): string {
  let hash = 0;
  for (let i = 0; i < id.length; i++) {
    hash = id.charCodeAt(i) + ((hash << 5) - hash);
  }
  return AVATAR_PALETTE[Math.abs(hash) % AVATAR_PALETTE.length];
}