/**
 * The carnival's colours, fonts and sizes. Games draw with these rather than
 * their own values, so every booth on the midway looks like it belongs.
 */
export const theme = {
  colors: {
    background: '#14110d', // soot
    surface: '#33291f', // charred leather
    text: '#f2e6c8', // bone
    muted: '#b3a585', // dusty bone
    accent: '#e0a526', // torch brass
    danger: '#e0503a', // blood-orange (readable on dark)
    stripeA: '#b8291c', // war-banner red
    stripeB: '#ece0bf', // bleached bone
    water: '#9be22d', // goblin toxic green
    wood: '#6e4628',
  },
  font: {
    family: '"Superclarendon", "Rockwell", "Roboto Slab", "Bookman Old Style", "Georgia", serif',
    small: 14,
    body: 18,
    title: 32,
  },
  radius: 12,
  canvas: {
    width: 800,
    height: 500,
  },
} as const;

/** Canvas font string, e.g. canvasFont('title') → 'bold 32px "Superclarendon", …'. */
export function canvasFont(size: 'small' | 'body' | 'title', weight: 'normal' | 'bold' = 'normal') {
  return `${weight} ${theme.font[size]}px ${theme.font.family}`;
}

/** Exposes the theme to CSS as custom properties, e.g. --color-accent. */
export function applyTheme(root: HTMLElement = document.documentElement) {
  for (const [name, value] of Object.entries(theme.colors)) {
    root.style.setProperty(`--color-${name}`, value);
  }
  root.style.setProperty('--font-family', theme.font.family);
  root.style.setProperty('--radius', `${theme.radius}px`);
}
