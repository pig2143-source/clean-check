import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const revalidate = 0
export const maxDuration = 60

function readServerEnv() {
  return {
    apiKey: String(process.env.OPENAI_API_KEY || '').trim(),
    model: String(
      process.env.OPENAI_VISION_MODEL || 'gpt-4.1-mini'
    ).trim(),
    supabaseUrl: String(
      process.env.NEXT_PUBLIC_SUPABASE_URL || ''
    ).trim(),
    supabasePublicKey: String(
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || ''
    ).trim(),
    supabaseServiceKey: String(
      process.env.SUPABASE_SERVICE_ROLE_KEY || ''
    ).trim()
  }
}

function json(data, status = 200) {
  return NextResponse.json(data, {
    status,
    headers: {
      'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0',
      Pragma: 'no-cache',
      Expires: '0'
    }
  })
}

function createSupabaseClients() {
  const env = readServerEnv()

  if (
    !env.supabaseUrl ||
    !env.supabasePublicKey ||
    !env.supabaseServiceKey
  ) {
    throw new Error('Supabase 伺服器環境變數尚未設定完整。')
  }

  return {
    auth: createClient(
      env.supabaseUrl,
      env.supabasePublicKey,
      {
        auth: {
          persistSession: false,
          autoRefreshToken: false
        }
      }
    ),
    admin: createClient(
      env.supabaseUrl,
      env.supabaseServiceKey,
      {
        auth: {
          persistSession: false,
          autoRefreshToken: false
        }
      }
    )
  }
}

async function requireUser(request) {
  const authorization = request.headers.get('authorization') || ''
  const token = authorization.replace(/^Bearer\s+/i, '').trim()

  if (!token) {
    return {
      error: json(
        {
          error: '尚未登入。',
          code: 'UNAUTHORIZED'
        },
        401
      )
    }
  }

  const { auth, admin } = createSupabaseClients()

  const {
    data: { user },
    error
  } = await auth.auth.getUser(token)

  if (error || !user) {
    return {
      error: json(
        {
          error: '登入已失效，請重新登入。',
          code: 'SESSION_EXPIRED'
        },
        401
      )
    }
  }

  const { data: profile } = await admin
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .maybeSingle()

  return {
    admin,
    user,
    profile
  }
}

const analysisSchema = {
  type: 'object',
  additionalProperties: false,
  properties: {
    score: {
      type: 'integer',
      minimum: 0,
      maximum: 100
    },
    verdict: {
      type: 'string',
      enum: ['pass', 'review', 'fail']
    },
    oil_stain: {
      type: 'object',
      additionalProperties: false,
      properties: {
        detected: { type: 'boolean' },
        severity: {
          type: 'integer',
          minimum: 0,
          maximum: 3
        },
        confidence: {
          type: 'integer',
          minimum: 0,
          maximum: 100
        }
      },
      required: ['detected', 'severity', 'confidence']
    },
    water_stain: {
      type: 'object',
      additionalProperties: false,
      properties: {
        detected: { type: 'boolean' },
        severity: {
          type: 'integer',
          minimum: 0,
          maximum: 3
        },
        confidence: {
          type: 'integer',
          minimum: 0,
          maximum: 100
        }
      },
      required: ['detected', 'severity', 'confidence']
    },
    trash: {
      type: 'object',
      additionalProperties: false,
      properties: {
        detected: { type: 'boolean' },
        severity: {
          type: 'integer',
          minimum: 0,
          maximum: 3
        },
        confidence: {
          type: 'integer',
          minimum: 0,
          maximum: 100
        }
      },
      required: ['detected', 'severity', 'confidence']
    },
    summary: {
      type: 'string'
    },
    suggestions: {
      type: 'array',
      items: {
        type: 'string'
      },
      maxItems: 4
    },
    image_quality: {
      type: 'string',
      enum: ['good', 'usable', 'poor']
    }
  },
  required: [
    'score',
    'verdict',
    'oil_stain',
    'water_stain',
    'trash',
    'summary',
    'suggestions',
    'image_quality'
  ]
}

function extractOutputText(raw) {
  if (
    typeof raw?.output_text === 'string' &&
    raw.output_text.trim()
  ) {
    return raw.output_text.trim()
  }

  for (const outputItem of raw?.output || []) {
    for (const contentItem of outputItem?.content || []) {
      if (
        contentItem?.type === 'output_text' &&
        typeof contentItem.text === 'string'
      ) {
        return contentItem.text.trim()
      }
    }
  }

  return ''
}

function validateAnalysis(result) {
  if (!result || typeof result !== 'object') {
    throw new Error('AI 回傳格式不正確。')
  }

  if (
    !Number.isInteger(result.score) ||
    result.score < 0 ||
    result.score > 100
  ) {
    throw new Error('AI 評分格式不正確。')
  }

  if (!['pass', 'review', 'fail'].includes(result.verdict)) {
    throw new Error('AI 判定格式不正確。')
  }

  return result
}

function safeEnvironmentDiagnostics() {
  const env = readServerEnv()

  return {
    OPENAI_API_KEY: Boolean(env.apiKey),
    OPENAI_API_KEY_LENGTH: env.apiKey.length,
    OPENAI_API_KEY_PREFIX: env.apiKey
      ? `${env.apiKey.slice(0, 7)}…`
      : null,
    OPENAI_VISION_MODEL: Boolean(env.model),
    NEXT_PUBLIC_SUPABASE_URL: Boolean(env.supabaseUrl),
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY:
      Boolean(env.supabasePublicKey),
    SUPABASE_SERVICE_ROLE_KEY:
      Boolean(env.supabaseServiceKey)
  }
}

export async function GET() {
  const env = readServerEnv()

  return json({
    ok: true,
    service: 'DP Clean AI analysis v6.1.3',
    configured: Boolean(env.apiKey),
    model: env.model,
    runtime: 'nodejs',
    deployment: {
      vercelEnv: process.env.VERCEL_ENV || null,
      vercelRegion: process.env.VERCEL_REGION || null,
      commitSha:
        process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 8) || null
    },
    env: safeEnvironmentDiagnostics(),
    message: env.apiKey
      ? '伺服器已成功讀取 OPENAI_API_KEY。'
      : '伺服器仍未讀取 OPENAI_API_KEY。'
  })
}

export async function POST(request) {
  let submissionId = ''
  let admin = null

  try {
    const gate = await requireUser(request)

    if (gate.error) {
      return gate.error
    }

    admin = gate.admin

    const env = readServerEnv()

    if (!env.apiKey) {
      return json(
        {
          error: '伺服器未讀取 OPENAI_API_KEY。',
          code: 'OPENAI_API_KEY_MISSING',
          env: safeEnvironmentDiagnostics()
        },
        503
      )
    }

    const body = await request.json().catch(() => null)
    submissionId = String(body?.submissionId || '').trim()

    if (!submissionId) {
      return json(
        {
          error: '缺少 submissionId。',
          code: 'SUBMISSION_ID_MISSING'
        },
        400
      )
    }

    const { data: submission, error: submissionError } =
      await admin
        .from('cleaning_submissions')
        .select(`
          id,
          staff_id,
          photo_path,
          cleaning_tasks (
            name,
            area,
            photo_angles,
            instructions
          )
        `)
        .eq('id', submissionId)
        .single()

    if (submissionError || !submission) {
      return json(
        {
          error: '找不到照片紀錄。',
          code: 'SUBMISSION_NOT_FOUND'
        },
        404
      )
    }

    const isManager = gate.profile?.role === 'manager'
    const isOwner = submission.staff_id === gate.user.id

    if (!isManager && !isOwner) {
      return json(
        {
          error: '沒有權限分析此照片。',
          code: 'FORBIDDEN'
        },
        403
      )
    }

    if (!submission.photo_path) {
      return json(
        {
          error: '此紀錄沒有照片。',
          code: 'PHOTO_MISSING'
        },
        400
      )
    }

    const startedAt = Date.now()

    const { error: pendingError } = await admin
      .from('cleaning_submissions')
      .update({
        ai_status: 'analyzing',
        ai_error: null
      })
      .eq('id', submissionId)

    if (pendingError) {
      throw new Error(
        `無法更新 AI 分析狀態：${pendingError.message}`
      )
    }

    const { data: signedData, error: signedError } =
      await admin.storage
        .from('cleaning-photos')
        .createSignedUrl(submission.photo_path, 600)

    if (signedError || !signedData?.signedUrl) {
      throw new Error('無法讀取清潔照片。')
    }

    const task = submission.cleaning_tasks || {}

    const prompt = [
      '你是餐飲業清潔稽核助理。',
      '只根據照片中實際可見的內容判斷，不可推測被遮擋或畫面外區域。',
      `清潔項目：${task.name || '未提供'}`,
      `區域：${task.area || '未提供'}`,
      `建議拍攝角度：${task.photo_angles || '未提供'}`,
      `清潔 SOP：${task.instructions || '未提供'}`,
      '',
      '請檢查：',
      '1. 油污',
      '2. 水漬',
      '3. 垃圾、碎屑或雜物',
      '4. 照片是否清楚、完整且足以判讀',
      '',
      '評分範圍為 0 至 100 分。',
      'severity：0 無、1 輕微、2 明顯、3 嚴重。',
      '照片模糊、過暗、角度不完整時，image_quality 應降低，verdict 應設定為 review。',
      '若存在明顯垃圾、碎屑、油污或水漬，可設定為 fail。',
      '不確定時不可宣稱確定存在缺失。',
      '摘要及建議使用繁體中文。',
      'AI 結果僅供主管參考。'
    ].join('\n')

    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 50000)

    let openAIResponse

    try {
      openAIResponse = await fetch(
        'https://api.openai.com/v1/responses',
        {
          method: 'POST',
          signal: controller.signal,
          headers: {
            Authorization: `Bearer ${env.apiKey}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            model: env.model,
            input: [
              {
                role: 'user',
                content: [
                  {
                    type: 'input_text',
                    text: prompt
                  },
                  {
                    type: 'input_image',
                    image_url: signedData.signedUrl,
                    detail: 'high'
                  }
                ]
              }
            ],
            text: {
              format: {
                type: 'json_schema',
                name: 'cleanliness_analysis',
                strict: true,
                schema: analysisSchema
              }
            },
            max_output_tokens: 900
          })
        }
      )
    } finally {
      clearTimeout(timeout)
    }

    const rawResponse = await openAIResponse
      .json()
      .catch(() => ({}))

    if (!openAIResponse.ok) {
      const apiMessage =
        rawResponse?.error?.message ||
        `OpenAI API 錯誤，HTTP ${openAIResponse.status}`

      throw new Error(apiMessage)
    }

    const outputText = extractOutputText(rawResponse)

    if (!outputText) {
      throw new Error('AI 沒有回傳分析結果。')
    }

    let parsedResult

    try {
      parsedResult = JSON.parse(outputText)
    } catch {
      throw new Error('AI 回傳的 JSON 無法解析。')
    }

    const result = validateAnalysis(parsedResult)

    const updateData = {
      ai_status: 'completed',
      ai_score: result.score,
      ai_verdict: result.verdict,
      ai_oil_stain: result.oil_stain,
      ai_water_stain: result.water_stain,
      ai_trash: result.trash,
      ai_summary: result.summary,
      ai_suggestions: result.suggestions,
      ai_image_quality: result.image_quality,
      ai_model: env.model,
      ai_analyzed_at: new Date().toISOString(),
      ai_error: null
    }

    const { error: updateError } = await admin
      .from('cleaning_submissions')
      .update(updateData)
      .eq('id', submissionId)

    if (updateError) {
      throw new Error(
        `AI 結果無法寫入 Supabase：${updateError.message}`
      )
    }

    return json({
      ok: true,
      analysis: result,
      model: env.model,
      duration_ms: Date.now() - startedAt
    })
  } catch (error) {
    const isTimeout = error?.name === 'AbortError'

    const message = isTimeout
      ? 'AI 分析逾時，請稍後重新執行。'
      : error?.message || 'AI 分析失敗。'

    if (admin && submissionId) {
      await admin
        .from('cleaning_submissions')
        .update({
          ai_status: 'failed',
          ai_error: message
        })
        .eq('id', submissionId)
    }

    return json(
      {
        error: message,
        code: isTimeout
          ? 'OPENAI_TIMEOUT'
          : 'AI_ANALYSIS_FAILED'
      },
      500
    )
  }
}
