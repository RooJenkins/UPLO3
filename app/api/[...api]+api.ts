import app from '@/backend/server';

console.log('[API-ROUTE] Loading API route, app type:', typeof app);

function stripApiPrefix(request: Request): Request {
  const incomingUrl = new URL(request.url);
  console.log('[API-ROUTE] Original URL:', incomingUrl.href);
  console.log('[API-ROUTE] Original pathname:', incomingUrl.pathname);
  
  // Normalize: remove leading /api or /api/ once
  if (incomingUrl.pathname.startsWith('/api')) {
    const newPath = incomingUrl.pathname.replace(/^\/api\/?/, '/');
    const adjustedUrl = new URL(incomingUrl.origin + newPath + incomingUrl.search);
    console.log('[API-ROUTE] Stripped pathname:', newPath);
    console.log('[API-ROUTE] Adjusted URL:', adjustedUrl.href);
    return new Request(adjustedUrl, request);
  }
  return request;
}

async function handle(request: Request) {
  const forwarded = stripApiPrefix(request);
  try {
    const response = await app.fetch(forwarded);
    return response;
  } catch (error) {
    console.error('[API-ROUTE] Handler error:', error);
    return new Response(
      JSON.stringify({ error: 'Request failed', details: String(error) }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}

// Exported for tests only; ignored by the Expo router
export { stripApiPrefix as __stripApiPrefixForTests, handle as __apiHandleForTests };

// Standard Expo API route pattern
export async function GET(request: Request) {
  return handle(request);
}

export async function POST(request: Request) {
  return handle(request);
}

export async function PUT(request: Request) {
  return handle(request);
}

export async function DELETE(request: Request) {
  return handle(request);
}

export async function PATCH(request: Request) {
  return handle(request);
}

export async function OPTIONS(request: Request) {
  return handle(request);
}

export default app;