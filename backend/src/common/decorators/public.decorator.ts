import { SetMetadata } from '@nestjs/common';

export const IS_PUBLIC_KEY = 'isPublic';

/** Marks a route as accessible without JWT (e.g. /health, /ready, login). */
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
