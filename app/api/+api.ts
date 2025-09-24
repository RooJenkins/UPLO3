import app from '@/backend/server';

console.log('[API-ROOT] Loading root API route');

// Handle bare /api and /api/ to hit backend root
export async function GET(request: Request) {
  console.log('[API-ROOT] GET request to:', request.url);
  try {
    const url = new URL(request.url);
    const stripped = new URL(url.origin + '/');
    console.log('[API-ROOT] Forwarding to backend root');
    const response = await app.fetch(new Request(stripped, request));
    console.log('[API-ROOT] Backend response status:', response.status);
    return response;
  } catch (error) {
    console.error('[API-ROOT] Error:', error);
    return new Response(JSON.stringify({ error: 'API root failed', details: String(error) }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

export async function POST(request: Request) {
  return GET(request);
}

export async function OPTIONS(request: Request) {
  return new Response(null, { 
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization'
    }
  });
}

export default app;