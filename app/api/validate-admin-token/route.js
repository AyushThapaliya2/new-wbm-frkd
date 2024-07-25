// app/api/validate-admin-token/route.js

export const POST = async (req, res) => {
    const { token } = await req.json();
  
    if (token === process.env.ADMIN_TOKEN) {
      return new Response(JSON.stringify({ valid: true }), { status: 200 });
    } else {
      return new Response(JSON.stringify({ valid: false }), { status: 401 });
    }
  };
  