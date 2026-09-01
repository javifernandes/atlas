import { handleAtlasHttpIngress } from '@/atlas/server/atlas-http-ingress';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export const POST = (request: Request) => handleAtlasHttpIngress(request);
