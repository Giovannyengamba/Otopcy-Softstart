import { z } from 'zod';

export const zEmail = z.string().trim().toLowerCase().email('Invalid email address');

export const zPhone = z
  .string()
  .transform((s) => s.replace(/[\s\-()]/g, ''))
  .pipe(z.string().regex(/^\+\d{8,15}$/, 'Phone must be in E.164 format (e.g., +221771234567)'));

export const zCuid = z.string().regex(/^c[a-z0-9]{20,30}$/, 'Invalid cuid');

export const zPositiveInt = z.number().int().positive('Must be a positive integer');
