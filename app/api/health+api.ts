import app from '@/backend/server';

// Simple health check API route
export async function GET() {
  try {
    const response = await app.fetch(new Request('http://localhost/'));
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