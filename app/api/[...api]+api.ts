console.log('[API-ROUTE] Initializing API route handler...');
console.log('[API-ROUTE] File loaded at:', new Date().toISOString());

// Enhanced request logging and error handling
function stripApiPrefix(request: Request): Request {
  const incomingUrl = new URL(request.url);
  console.log('[API-ROUTE] Original URL:', incomingUrl.toString());

  // Normalize: remove leading /api or /api/ once
  if (incomingUrl.pathname.startsWith('/api')) {
    const newPath = incomingUrl.pathname.replace(/^\/api\/?/, '/');
    const adjustedUrl = new URL(incomingUrl.origin + newPath + incomingUrl.search);
    console.log('[API-ROUTE] Stripped URL:', adjustedUrl.toString());
    return new Request(adjustedUrl, request);
  }

  console.log('[API-ROUTE] No prefix stripping needed');
  return request;
}

// Enhanced handler with comprehensive error handling
async function handle(request: Request): Promise<Response> {
  const start = Date.now();
  const method = request.method;
  const url = request.url;

  console.log(`[API-ROUTE] → ${method} ${url}`);

  try {
    console.log('[API-ROUTE] Loading backend app...');

    // Dynamic import with proper error handling
    const { default: app } = await import('@/backend/server');

    if (!app || typeof app.fetch !== 'function') {
      throw new Error('Backend app is invalid or missing fetch method');
    }

    console.log('[API-ROUTE] Backend app loaded successfully, type:', typeof app);

    // Strip API prefix and forward request
    const forwarded = stripApiPrefix(request);
    console.log('[API-ROUTE] Forwarding to backend app...');

    const response = await app.fetch(forwarded);
    const duration = Date.now() - start;

    console.log(`[API-ROUTE] ← ${method} ${url} [${response.status}] ${duration}ms`);

    return response;

  } catch (error) {
    const duration = Date.now() - start;
    console.error(`[API-ROUTE] ✕ ${method} ${url} [ERROR] ${duration}ms:`, error);
    console.error('[API-ROUTE] Error name:', error?.name);
    console.error('[API-ROUTE] Error message:', error?.message);

    return new Response(
      JSON.stringify({
        error: 'API Route Handler Failed',
        message: 'Failed to process request through backend',
        details: error instanceof Error ? {
          name: error.name,
          message: error.message,
          stack: error.stack?.split('\n').slice(0, 5).join('\n')
        } : String(error),
        timestamp: new Date().toISOString(),
        path: new URL(url).pathname,
        method: method
      }),
      {
        status: 500,
        headers: {
          'Content-Type': 'application/json',
          'X-Error-Source': 'api-route-handler'
        }
      }
    );
  }
}

// Exported for tests only; ignored by the Expo router
export { stripApiPrefix as __stripApiPrefixForTests, handle as __apiHandleForTests };

// Standard Expo API route pattern with individual handlers for better debugging
export async function GET(request: Request) {
  console.log('[API-ROUTE] GET handler called');
  return handle(request);
}

export async function POST(request: Request) {
  console.log('[API-ROUTE] POST handler called');
  return handle(request);
}

export async function PUT(request: Request) {
  console.log('[API-ROUTE] PUT handler called');
  return handle(request);
}

export async function DELETE(request: Request) {
  console.log('[API-ROUTE] DELETE handler called');
  return handle(request);
}

export async function PATCH(request: Request) {
  console.log('[API-ROUTE] PATCH handler called');
  return handle(request);
}

export async function OPTIONS(request: Request) {
  console.log('[API-ROUTE] OPTIONS handler called');
  return handle(request);
}

console.log('[API-ROUTE] API route handler initialized successfully');