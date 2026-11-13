// Cloudflare Pages Functions: /api/... এর সব রিকোয়েস্ট এখানে আসে
import { handle } from '../../server/api.js';
export const onRequest = (context) => handle(context.request, context.env);
