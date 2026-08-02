export const colors = {
  background: '#F5F4FB',
  primary: '#6C5CE7',
  primaryDark: '#5A4BD1',
  card: '#FFFFFF',
  textPrimary: '#1A1A2E',
  textSecondary: '#8B8B9E',
  bubbleMine: '#6C5CE7',
  bubbleTheirs: '#FFFFFF',
  bubbleTextMine: '#FFFFFF',
  bubbleTextTheirs: '#1A1A2E',
  border: '#ECEBF7',
  online: '#4CD97B',
};

const AVATAR_PALETTE = ['#F97C7C', '#6C5CE7', '#4CD97B', '#FFB84D', '#4DA3FF', '#FF7CC5'];

export function avatarColorFor(id: string): string {
  let hash = 0;
  for (let i = 0; i < id.length; i++) {
    hash = id.charCodeAt(i) + ((hash << 5) - hash);
  }
  return AVATAR_PALETTE[Math.abs(hash) % AVATAR_PALETTE.length];
}