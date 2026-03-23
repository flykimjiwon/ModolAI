import { NextResponse } from 'next/server';
import { query } from '@/lib/postgres';
import { verifyTokenWithResult } from '@/lib/auth';
import { getNextModelServerEndpointWithIndex } from '@/lib/modelServers';
import { logExternalApiRequest } from '@/lib/externalApiLogger';
import { createServerError } from '@/lib/errorHandler';

export const runtime = 'nodejs';

const CHART_SYSTEM_PROMPT = `You are a data formatting assistant. Your job is to convert user-provided data into a JSON array suitable for Recharts.

Rules:
1. Return ONLY valid JSON - no markdown, no explanation, no code blocks.
2. The JSON must be an array of objects.
3. Each object represents one data point with a "name" field (string label) and one or more numeric value fields.
4. Field names for values should be descriptive (e.g., "value", "sales", "count", "revenue").
5. If the user provides tabular or CSV-like data, parse it accurately.
6. If the user provides natural language descriptions, extract reasonable numeric data.
7. For pie/donut charts, use "name" and "value" fields.
8. Keep the data concise - maximum 20 data points unless specifically requested.
9. Ensure all numeric values are actual numbers, not strings.

Example output for "Monthly sales: Jan 100, Feb 150, Mar 200":
[{"name":"1월","value":100},{"name":"2월","value":150},{"name":"3월","value":200}]`;

export async function POST(request) {
  try {
    const authResult = verifyTokenWithResult(request);
    if (!authResult.valid) {
      return NextResponse.json({ error: authResult.error }, { status: 401 });
    }

    const body = await request.json();
    const { rawData, chartType, modelId } = body;

    if (!rawData || !rawData.trim()) {
      return NextResponse.json({ error: 'Data input is required' }, { status: 400 });
    }

    // Resolve model - use agent settings or provided modelId
    let targetModel = modelId;
    if (!targetModel) {
      try {
        const settingsResult = await query(
          `SELECT selected_model_id FROM agent_settings WHERE agent_id = '10'`
        );
        if (settingsResult.rows.length > 0 && settingsResult.rows[0].selected_model_id) {
          targetModel = settingsResult.rows[0].selected_model_id;
        }
      } catch {
        // ignore - will use default
      }
    }

    if (!targetModel) {
      return NextResponse.json(
        { error: 'Please configure a model for Chart Maker in the admin page' },
        { status: 400 }
      );
    }

    const endpoint = await getNextModelServerEndpointWithIndex();

    if (!endpoint || !endpoint.endpoint) {
      return NextResponse.json(
        { error: 'No model server available' },
        { status: 503 }
      );
    }

    const userPrompt = `Convert this data for a ${chartType || 'bar'} chart:\n\n${rawData}`;

    const messages = [
      { role: 'system', content: CHART_SYSTEM_PROMPT },
      { role: 'user', content: userPrompt },
    ];

    const requestBody = {
      model: targetModel,
      messages,
      temperature: 0.1,
      max_tokens: 2048,
    };

    const headers = { 'Content-Type': 'application/json' };
    if (endpoint.apiKey) {
      headers['Authorization'] = `Bearer ${endpoint.apiKey}`;
    }

    const apiUrl = `${endpoint.endpoint}/v1/chat/completions`;
    const startTime = Date.now();

    const response = await fetch(apiUrl, {
      method: 'POST',
      headers,
      body: JSON.stringify(requestBody),
    });

    const elapsed = Date.now() - startTime;

    if (!response.ok) {
      const errText = await response.text().catch(() => 'Unknown error');
      console.error(`[chart-generate] Model API error ${response.status}:`, errText);
      return NextResponse.json(
        { error: `Model server error (${response.status})` },
        { status: 502 }
      );
    }

    const result = await response.json();
    const content = result.choices?.[0]?.message?.content || '';

    // Log the API call
    logExternalApiRequest({
      userId: authResult.user?.id,
      endpoint: apiUrl,
      model: targetModel,
      prompt: userPrompt,
      response: content,
      latencyMs: elapsed,
      status: 'success',
      agentId: '10',
    }).catch(() => {});

    // Parse the JSON from LLM response
    let chartData;
    try {
      let jsonStr = content.trim();
      const jsonMatch = jsonStr.match(/```(?:json)?\s*([\s\S]*?)```/);
      if (jsonMatch) {
        jsonStr = jsonMatch[1].trim();
      }
      const arrayMatch = jsonStr.match(/\[[\s\S]*\]/);
      if (arrayMatch) {
        jsonStr = arrayMatch[0];
      }
      chartData = JSON.parse(jsonStr);

      if (!Array.isArray(chartData)) {
        throw new Error('Response is not an array');
      }
    } catch (parseError) {
      console.error('[chart-generate] JSON parse error:', parseError.message);
      return NextResponse.json({
        error: 'Failed to parse LLM response. Please check your data format.',
        rawResponse: content,
      }, { status: 422 });
    }

    return NextResponse.json({
      success: true,
      data: chartData,
      model: targetModel,
      latencyMs: elapsed,
    });
  } catch (error) {
    console.error('[POST /api/webapp-chart-generate] error:', error);
    return createServerError(error);
  }
}
