// functions/gemini-proxy/index.ts
import "@supabase/functions-js/edge-runtime.d.ts";

console.log("Starting gemini-proxy function (debug mode)");

async function callLLMWithLogging(url: string, options: RequestInit) {
  console.log('--- DEBUG START ---');
  console.log('ENV GEN_API_KEY present:', !!Deno.env.get('GEN_API_KEY'));
  console.log('ENV MODEL_ID:', Deno.env.get('MODEL_ID') || 'no MODEL_ID env var');
  try {
    console.log('Calling LLM URL:', url);
    const resp = await fetch(url, options);
    const status = resp.status;
    const text = await resp.text();
    console.log('LLM status:', status);
    console.log('LLM raw response (truncated 2000 chars):', text.slice(0, 2000));
    try {
      const json = JSON.parse(text);
      console.log('LLM parsed JSON keys:', Object.keys(json || {}));
      return { ok: true, json };
    } catch (parseErr) {
      console.error('JSON.parse failed:', parseErr);
      const match = text.match(/\{[\s\S]*\}/);
      if (match) {
        try {
          const json2 = JSON.parse(match[0]);
          console.log('Parsed embedded JSON keys:', Object.keys(json2 || {}));
          return { ok: true, json: json2 };
        } catch (e) {
          console.error('Embedded JSON parse failed:', e);
        }
      }
      return { ok: false, error: 'invalid_llm_response', raw: text };
    }
  } catch (err) {
    console.error('Network or fetch error calling LLM:', err);
    return { ok: false, error: 'fetch_error', detail: String(err) };
  } finally {
    console.log('--- DEBUG END ---');
  }
}

Deno.serve(async (req: Request) => {
  try {
    const url = new URL(req.url);

    // GET /list-models
    if (url.pathname.endsWith('/list-models')) {
      const apiKey = Deno.env.get('GEN_API_KEY') || '';
      if (!apiKey) {
        console.error('GEN_API_KEY missing in environment');
        return new Response(JSON.stringify({ error: 'missing_gen_api_key' }), { status: 500, headers: { 'Content-Type': 'application/json' } });
      }

      const llmUrl = `https://generativelanguage.googleapis.com/v1/models?key=${encodeURIComponent(apiKey)}`;
      const result = await callLLMWithLogging(llmUrl, { method: 'GET' });

      if (!result.ok) {
        return new Response(JSON.stringify({ error: result.error, raw: result.raw || result.detail }), { status: 500, headers: { 'Content-Type': 'application/json' } });
      }
      return new Response(JSON.stringify(result.json), { status: 200, headers: { 'Content-Type': 'application/json' } });
    }

    // POST /generate
    if (url.pathname.endsWith('/generate') && req.method === 'POST') {
      const apiKey = Deno.env.get('GEN_API_KEY') || '';
      const modelId = Deno.env.get('MODEL_ID') || 'models/gemini-1.5';
      if (!apiKey) {
        console.error('GEN_API_KEY missing in environment');
        return new Response(JSON.stringify({ error: 'missing_gen_api_key' }), { status: 500, headers: { 'Content-Type': 'application/json' } });
      }

      const incoming = await req.json().catch(() => null);
      if (!incoming) {
        return new Response(JSON.stringify({ error: 'invalid_request_body' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
      }

      const genUrl = `https://generativelanguage.googleapis.com/v1/${modelId}:generateText?key=${encodeURIComponent(apiKey)}`;
      const payload = {
        prompt: incoming.prompt ?? { text: String(incoming.text ?? '') },
        maxOutputTokens: incoming.maxOutputTokens ?? 256
      };

      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      const result = await callLLMWithLogging(genUrl, { method: 'POST', headers, body: JSON.stringify(payload) });

      if (!result.ok) {
        return new Response(JSON.stringify({ error: result.error, raw: result.raw || result.detail }), { status: 500, headers: { 'Content-Type': 'application/json' } });
      }
      return new Response(JSON.stringify(result.json), { status: 200, headers: { 'Content-Type': 'application/json' } });
    }

    // Ruta por defecto (sanity)
    if (req.method === 'POST') {
      const body = await req.json().catch(() => ({}));
      return new Response(JSON.stringify({ message: 'OK', received: body }), { status: 200, headers: { 'Content-Type': 'application/json' } });
    }

    return new Response(JSON.stringify({ message: 'Use /list-models, /generate or POST' }), { status: 200, headers: { 'Content-Type': 'application/json' } });
  } catch (err) {
    console.error('Unhandled error in handler:', err);
    return new Response(JSON.stringify({ error: 'internal', detail: String(err) }), { status: 500, headers: { 'Content-Type': 'application/json' } });
  }
});
