import { z } from 'zod';
import { epochMsSchema } from './common.js';

export const bookmarkStatusSchema = z.enum(['active', 'dead', 'archived', 'deleted']);

export const contentStateSchema = z.enum(['pending', 'client', 'scraped', 'failed']);

export const folderOriginSchema = z.enum(['user', 'sqishy']);

/**
 * The unit of the sync payload. Titles are capped because browsers do not cap
 * them and a hostile page can set a multi-megabyte one.
 */
export const flatNodeSchema = z.object({
  id: z.string().min(1).max(128),
  parentId: z.string().min(1).max(128).nullable(),
  title: z.string().max(2048),
  url: z.string().max(4096).nullable(),
  dateAdded: epochMsSchema.nullable(),
  depth: z.number().int().min(0).max(64),
  index: z.number().int().min(0),
});
