import app from '@/backend/hono';

console.log('API route loaded, app:', typeof app);

// Export the Hono app as the default export for Expo API routes
export default app;

// Handle all HTTP methods by creating proper Request objects
export async function GET(request: Request) {
  console.log('API GET request:', request.url);
  return app.fetch(request);
}

export async function POST(request: Request) {
  console.log('API POST request:', request.url);
  return app.fetch(request);
}

export async function PUT(request: Request) {
  console.log('API PUT request:', request.url);
  return app.fetch(request);
}

export async function DELETE(request: Request) {
  console.log('API DELETE request:', request.url);
  return app.fetch(request);
}

export async function PATCH(request: Request) {
  console.log('API PATCH request:', request.url);
  return app.fetch(request);
}

export async function OPTIONS(request: Request) {
  console.log('API OPTIONS request:', request.url);
  return app.fetch(request);
}