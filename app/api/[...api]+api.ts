import app from '@/backend/server';

console.log('[API-ROUTE] Loading API route, app type:', typeof app);

// Standard Expo API route pattern
export async function GET(request: Request) {
  console.log('[API-ROUTE] GET request to:', request.url);
  try {
    const response = await app.fetch(request);
    console.log('[API-ROUTE] GET response status:', response.status);
    return response;
  } catch (error) {
    console.error('[API-ROUTE] GET error:', error);
    return new Response(JSON.stringify({ error: 'GET request failed', details: String(error) }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

export async function POST(request: Request) {
  console.log('[API-ROUTE] POST request to:', request.url);
  try {
    const response = await app.fetch(request);
    console.log('[API-ROUTE] POST response status:', response.status);
    return response;
  } catch (error) {
    console.error('[API-ROUTE] POST error:', error);
    return new Response(JSON.stringify({ error: 'POST request failed', details: String(error) }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

export async function PUT(request: Request) {
  return app.fetch(request);
}

export async function DELETE(request: Request) {
  return app.fetch(request);
}

export async function PATCH(request: Request) {
  return app.fetch(request);
}

export async function OPTIONS(request: Request) {
  return app.fetch(request);
}

export default app;