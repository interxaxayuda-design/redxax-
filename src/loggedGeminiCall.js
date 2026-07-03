// src/loggedGeminiCall.js
import { supabase, extractGeminiText, safeParseJSON } from './App';

export const loggedGeminiCall = async ({
  analysisId,
  callName,
  body,
  extractReasoning = null,
}) => {
  const start = performance.now();
  let rawText = null;
  let errorMsg = null;
  let data = null;

  try {
    const result = await supabase.functions.invoke('gemini-proxy', { body });
    if (result.error) {
      errorMsg = result.error.message;
      try { errorMsg = await result.error.context?.text?.() || errorMsg; } catch (_) {}
    } else {
      data = result.data;
      rawText = extractGeminiText(data);
    }
  } catch (e) {
    errorMsg = e.message;
  }

  const duration_ms = Math.round(performance.now() - start);

  let parsedOutput = null;
  let reasoning = null;
  if (rawText) {
    try { parsedOutput = safeParseJSON(rawText, callName); } catch (_) {
      parsedOutput = null;
    }
    if (extractReasoning) {
      try { reasoning = extractReasoning(rawText, parsedOutput); } catch (_) {}
    }
  }

  supabase.from('virax_call_logs').insert({
    analysis_id: analysisId,
    call_name: callName,
    prompt_text: typeof body.text === 'string' ? body.text.slice(0, 8000) : null,
    raw_response: rawText?.slice(0, 20000) ?? null,
    parsed_output: parsedOutput,
    reasoning,
    temperature: body.temperature ?? null,
    duration_ms,
    error: errorMsg,
  }).then(({ error }) => {
    if (error) console.warn(`[LOG] No se pudo loguear ${callName}:`, error.message);
  });

  if (errorMsg) throw new Error(errorMsg);
  return { data, rawText, parsedOutput };
};