import app from '@/backend/server';

// Simple health check API route
export async function GET(request: Request) {
  try {
    // Forward to backend root after stripping /api prefix
    const incoming = new URL(request.url);
    const adjusted = new URL(incoming.origin + '/');
    const response = await app.fetch(new Request(adjusted));
    return response;
  } catch (error) {
    console.error('Health check failed:', error);
    return new Response(
      JSON.stringify({ status: 'error', message: 'Backend not available' }),
      { 
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      }
    );
  }
}