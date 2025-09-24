console.log('[API-ROUTE-TEST] Simple test route loaded');

export async function GET(request: Request) {
  console.log('[API-ROUTE-TEST] GET handler called for:', request.url);

  return new Response(
    JSON.stringify({
      success: true,
      message: 'Simple API route works!',
      timestamp: new Date().toISOString(),
      url: request.url,
      method: 'GET'
    }),
    {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'X-Test-Route': 'working'
      }
    }
  );
}

export async function POST(request: Request) {
  console.log('[API-ROUTE-TEST] POST handler called for:', request.url);

  return new Response(
    JSON.stringify({
      success: true,
      message: 'Simple POST API route works!',
      timestamp: new Date().toISOString(),
      url: request.url,
      method: 'POST'
    }),
    {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'X-Test-Route': 'working'
      }
    }
  );
}

console.log('[API-ROUTE-TEST] Simple test route exports ready');