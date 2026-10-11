import type { Ionicons } from '@expo/vector-icons';

import type { Category } from '@/constants/skills';
import { brand, colors } from '@/constants/theme';

type CategoryStyle = {
  icon: keyof typeof Ionicons.glyphMap;
  /** Icon colour on light surfaces. */
  color: string;
  /** Tint behind the icon in tiles and circles. */
  surface: string;
};

/** One icon and colour per category, so Discover, Learn and Sessions agree. */
export const CATEGORY_STYLE: Record<Category, CategoryStyle> = {
  Programming: { icon: 'code-slash', color: brand.blue, surface: brand.blueSurface },
  Design: { icon: 'color-palette', color: brand.green, surface: brand.greenSurface },
  Business: { icon: 'briefcase', color: colors.accent, surface: colors.accentSurface },
  Academic: { icon: 'school', color: brand.navy, surface: brand.navySurface },
};
