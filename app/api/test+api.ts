// Simple test endpoint to verify API routing is working
export async function GET(request: Request) {
  console.log('[API-TEST] Test endpoint hit:', request.url);
  return new Response(JSON.stringify({ 
    message: 'API routing is working',
    timestamp: new Date().toISOString(),
    url: request.url 
  }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' }
  });
}

export async function POST(request: Request) {
  return GET(request);
}