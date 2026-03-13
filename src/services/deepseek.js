const DEFAULT_FIRST_LEVEL_TAGS = [
  '人群画像',
  '使用场景',
  '核心卖点',
  '体验反馈',
  '购买动机',
  '情绪倾向',
  '内容方向'
]

const DEFAULT_SECOND_LEVEL_TAGS = [
  '价格敏感',
  '日常通勤',
  '功能实用',
  '效果明显',
  '复购意愿',
  '正向口碑',
  '传播素材'
]

const DEEPSEEK_BASE_URL = import.meta.env.VITE_DEEPSEEK_BASE_URL || 'https://api.deepseek.com'
const DEEPSEEK_API_KEY = import.meta.env.VITE_DEEPSEEK_API_KEY || ''
const DEEPSEEK_MODEL = import.meta.env.VITE_DEEPSEEK_MODEL || 'deepseek-chat'
const DEEPSEEK_FAST_MODEL = import.meta.env.VITE_DEEPSEEK_FAST_MODEL || DEEPSEEK_MODEL

const resolvePositiveNumber = (value, fallback) => {
  const parsed = Number(value)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback
}

const DEEPSEEK_BATCH_SIZE = resolvePositiveNumber(import.meta.env.VITE_DEEPSEEK_BATCH_SIZE, 100)
const DEEPSEEK_MAX_CONCURRENCY = resolvePositiveNumber(import.meta.env.VITE_DEEPSEEK_MAX_CONCURRENCY, 8)
const DEEPSEEK_MAX_TEXT_LENGTH = resolvePositiveNumber(import.meta.env.VITE_DEEPSEEK_MAX_TEXT_LENGTH, 120)
const DEEPSEEK_PREVIEW_BATCH_SIZE = resolvePositiveNumber(import.meta.env.VITE_DEEPSEEK_PREVIEW_BATCH_SIZE, 24)
const DEEPSEEK_MAX_OUTPUT_TOKENS = resolvePositiveNumber(import.meta.env.VITE_DEEPSEEK_MAX_OUTPUT_TOKENS, 900)
const DEEPSEEK_PRODUCT_MAX_OUTPUT_TOKENS = resolvePositiveNumber(import.meta.env.VITE_DEEPSEEK_PRODUCT_MAX_OUTPUT_TOKENS, 1400)
const DEEPSEEK_PREVIEW_MAX_OUTPUT_TOKENS = resolvePositiveNumber(import.meta.env.VITE_DEEPSEEK_PREVIEW_MAX_OUTPUT_TOKENS, 420)
const DEEPSEEK_DATA_TEMPERATURE = resolvePositiveNumber(import.meta.env.VITE_DEEPSEEK_DATA_TEMPERATURE, 0.2)
const DEEPSEEK_PRODUCT_TEMPERATURE = resolvePositiveNumber(import.meta.env.VITE_DEEPSEEK_PRODUCT_TEMPERATURE, 0.35)
const DEEPSEEK_TOP_P = resolvePositiveNumber(import.meta.env.VITE_DEEPSEEK_TOP_P, 0.8)
const DEEPSEEK_MAX_TAG_COUNT = resolvePositiveNumber(import.meta.env.VITE_DEEPSEEK_MAX_TAG_COUNT, 20)

const SYSTEM_PROMPT = [
  '你是中文电商标签归纳助手。',
  '你的目标是以最短时间输出稳定、可执行、可落表的一级/二级标签。',
  '禁止输出思考过程、解释、前后缀、代码块、JSON、额外说明。',
  '如果用户要求表格，则只输出 Markdown 表格正文。'
].join('\n')

const MARKDOWN_TABLE_TEMPLATE = [
  '| 一级标签 | 二级标签 |',
  '| --- | --- |'
].join('\n')

const compactText = (value = '', maxLength = DEEPSEEK_MAX_TEXT_LENGTH) => String(value || '')
  .replace(/\s+/g, ' ')
  .trim()
  .slice(0, maxLength)

const buildCompactSourceLines = (payload) => {
  const records = Array.isArray(payload?.sourceRecords)
    ? payload.sourceRecords
    : Array.isArray(payload?.sourceTexts)
      ? payload.sourceTexts.map((text, index) => ({
        recordId: String(index + 1),
        text
      }))
      : []

  return records
    .map((item, index) => {
      const text = compactText(item?.text || '')

      if (!text) {
        return null
      }

      return `${index + 1}. ${text}`
    })
    .filter(Boolean)
}

const buildDataContext = (payload) => {
  if (payload.mode === 'data') {
    return [
      `产品名称：${payload.productName || ''}`,
      `数据表：${payload.table || ''}`,
      `字段：${payload.field || ''}`,
      `数据类型：${payload.channelLabel || payload.channel || ''}`,
      `摘要：${compactText(payload.summary || '', 180)}`,
      `样本数：${Array.isArray(payload.sourceRecords)
        ? payload.sourceRecords.length
        : Array.isArray(payload.sourceTexts)
          ? payload.sourceTexts.length
          : 0}`,
      '样本文本：',
      buildCompactSourceLines(payload).join('\n')
    ].join('\n')
  }

  return [
    `产品名称：${payload.productName || ''}`,
    `产品摘要：${compactText(payload.summary || '', 180)}`,
    `核心功能：${compactText(payload.coreFeature || '', 120)}`,
    `目标人群：${Array.isArray(payload.audiences) ? payload.audiences.join('、') : ''}`
  ].join('\n')
}

const buildReviewPrompt = (payload) => {
  const data = buildDataContext(payload)

  return [
    '任务：根据评价数据，快速归纳高频标签。',
    data,
    '规则：',
    `1. 只输出 ${DEEPSEEK_MAX_TAG_COUNT} 条以内最重要标签。`,
    '2. 一级标签必须是宏观维度；二级标签必须是具体诉求/痛点/场景。',
    '3. 去重、避免近义词重复、优先高频高价值标签。',
    '4. 不要输出分析过程、说明、结论、编号列表。',
    '5. 仅输出 Markdown 表格，格式必须如下：',
    MARKDOWN_TABLE_TEMPLATE
  ].join('\n')
}

const buildQaPrompt = (payload) => {
  const data = buildDataContext(payload)

  return [
    `任务：根据购买前问答数据，归纳消费者最关心的问题标签（产品：${payload.productName || '产品名称'}）。`,
    data,
    '规则：',
    `1. 只输出 ${DEEPSEEK_MAX_TAG_COUNT} 条以内标签。`,
    '2. 一级标签体现问题维度，二级标签体现具体关注点。',
    '3. 去重、合并近义项，按关注度从高到低排序。',
    '4. 不要解释，不要输出任何表格之外的内容。',
    '5. 输出格式固定为：',
    MARKDOWN_TABLE_TEMPLATE
  ].join('\n')
}

const buildProductPrompt = (payload) => {
  const audienceSummary = Array.isArray(payload.audiences) && payload.audiences.length
    ? payload.audiences.join('、')
    : '待补充'
  const data = buildDataContext(payload)

  return [
    `任务：为产品"${payload.productName || '产品名称'}"设计购买决策标签。`,
    `目标人群：${audienceSummary}`,
    data,
    '规则：',
    `1. 只输出 ${DEEPSEEK_MAX_TAG_COUNT} 条以内高价值标签。`,
    '2. 一级标签体现购买决策维度，二级标签体现具体诉求。',
    '3. 优先输出对转化影响最大的标签，不要展开分析。',
    '4. 不要输出 JSON、不要输出调研报告、不要输出额外说明。',
    '5. 仅输出 Markdown 表格，格式固定为：',
    MARKDOWN_TABLE_TEMPLATE
  ].join('\n')
}

const buildGenericPrompt = (payload) => {
  const data = buildDataContext(payload)

  return [
    '任务：基于业务信息生成标签。',
    data,
    '规则：',
    `1. 只输出 ${DEEPSEEK_MAX_TAG_COUNT} 条以内标签。`,
    '2. 一级标签是宏观维度，二级标签是具体描述。',
    '3. 去重并按重要性排序。',
    '4. 仅输出 Markdown 表格，不要解释。',
    '5. 输出格式固定为：',
    MARKDOWN_TABLE_TEMPLATE
  ].join('\n')
}

const buildPrompt = (payload) => {
  if (payload.mode === 'product') {
    return buildProductPrompt(payload)
  }

  if (payload.mode === 'data' && payload.channel === 'review') {
    return buildReviewPrompt(payload)
  }

  if (payload.mode === 'data' && payload.channel === 'qa') {
    return buildQaPrompt(payload)
  }

  return buildGenericPrompt(payload)
}

const normalizeMessageContent = (content) => {
  if (typeof content === 'string') {
    return content
  }

  if (Array.isArray(content)) {
    return content
      .map((item) => {
        if (typeof item === 'string') {
          return item
        }

        if (typeof item?.text === 'string') {
          return item.text
        }

        if (typeof item?.content === 'string') {
          return item.content
        }

        return ''
      })
      .join('\n')
  }

  if (typeof content === 'object' && typeof content?.text === 'string') {
    return content.text
  }

  return ''
}

const normalizeJsonCandidate = (value) => String(value || '')
  .replace(/^\uFEFF/, '')
  .replace(/[\u200B-\u200D]/g, '')
  .trim()

const repairJsonLikeString = (value) => {
  const normalized = normalizeJsonCandidate(value)
    .replace(/^json\s*/i, '')
    .replace(/[""]/g, '"')
    .replace(/['']/g, "'")

  let result = ''
  let inString = false
  let escaped = false

  for (let index = 0; index < normalized.length; index += 1) {
    const char = normalized[index]

    if (inString) {
      if (escaped) {
        result += char
        escaped = false
        continue
      }

      if (char === '\\') {
        result += char
        escaped = true
        continue
      }

      if (char === '"') {
        const nextChar = normalized[index + 1] || ''
        const shouldKeepAsLiteralQuote = nextChar && ![',', '}', ']', ':'].includes(nextChar) && !/\s/.test(nextChar)

        if (shouldKeepAsLiteralQuote) {
          result += '\\"'
          continue
        }

        result += char
        inString = false
        continue
      }

      if (char === '\n') {
        result += '\\n'
        continue
      }

      if (char === '\r') {
        continue
      }

      if (char === '\t') {
        result += '\\t'
        continue
      }

      result += char
      continue
    }

    if (char === '"') {
      inString = true
      result += char
      continue
    }

    result += char
  }

  return result.replace(/,\s*([}\]])/g, '$1').trim()
}

const parseJsonSafely = (value) => {
  if (!value || typeof value !== 'string') {
    return null
  }

  const normalizedValue = normalizeJsonCandidate(value)

  try {
    return JSON.parse(normalizedValue)
  } catch (error) {
    try {
      return JSON.parse(repairJsonLikeString(normalizedValue))
    } catch (repairError) {
      return null
    }
  }
}

const collectBalancedJsonSnippets = (content) => {
  const snippets = []
  const stack = []
  let startIndex = -1
  let inString = false
  let escaped = false

  for (let index = 0; index < content.length; index += 1) {
    const char = content[index]

    if (inString) {
      if (escaped) {
        escaped = false
        continue
      }

      if (char === '\\') {
        escaped = true
        continue
      }

      if (char === '"') {
        inString = false
      }

      continue
    }

    if (char === '"') {
      inString = true
      continue
    }

    if (char === '{' || char === '[') {
      if (!stack.length) {
        startIndex = index
      }

      stack.push(char)
      continue
    }

    if (char === '}' || char === ']') {
      if (!stack.length) {
        continue
      }

      const last = stack[stack.length - 1]
      const isMatched = (last === '{' && char === '}') || (last === '[' && char === ']')

      if (!isMatched) {
        stack.length = 0
        startIndex = -1
        continue
      }

      stack.pop()

      if (!stack.length && startIndex !== -1) {
        snippets.push(content.slice(startIndex, index + 1))
        startIndex = -1
      }
    }
  }

  return snippets
}

const extractRowsFromMarkdownTable = (content) => {
  const lines = String(content || '')
    .split(/\r?\n/)
    .map(line => line.trim())
    .filter(Boolean)
    .filter(line => line.startsWith('|') && line.endsWith('|'))

  if (lines.length < 3) {
    return null
  }

  const rows = lines
    .slice(2)
    .map((line, index) => line.split('|').map(cell => cell.trim()).filter(Boolean))
    .filter(cells => cells.length >= 2)
    .map((cells, index) => ({
      id: index + 1,
      label1Tag: cells[0],
      label2Tag: cells[1]
    }))
    .filter(item => item.label1Tag || item.label2Tag)

  return rows.length ? rows : null
}

const extractJson = (content) => {
  const normalizedContent = normalizeMessageContent(content).trim()

  if (!normalizedContent) {
    return null
  }

  const candidates = [normalizedContent]
  const repairedContent = repairJsonLikeString(normalizedContent)

  if (repairedContent && repairedContent !== normalizedContent) {
    candidates.push(repairedContent)
  }

  const fencedBlocks = [...normalizedContent.matchAll(/```(?:json)?\s*([\s\S]*?)\s*```/gi)]
    .map(match => match[1]?.trim())
    .filter(Boolean)

  candidates.push(...fencedBlocks)
  candidates.push(...collectBalancedJsonSnippets(normalizedContent))

  if (repairedContent) {
    candidates.push(...collectBalancedJsonSnippets(repairedContent))
  }

  for (const candidate of candidates) {
    const parsed = parseJsonSafely(candidate)
    if (parsed) {
      return parsed
    }
  }

  return extractRowsFromMarkdownTable(normalizedContent)
}

const unwrapTagPayload = (items) => {
  if (Array.isArray(items)) {
    return items
  }

  if (Array.isArray(items?.data)) {
    return items.data
  }

  if (Array.isArray(items?.tags)) {
    return items.tags
  }

  if (Array.isArray(items?.result)) {
    return items.result
  }

  if (Array.isArray(items?.rows)) {
    return items.rows
  }

  return []
}

const uniqueValues = (items) => [...new Set(items.filter(Boolean))]

const buildNormalizedResultFromRows = (rows) => {
  const seen = new Set()

  const cleaned = rows
    .map((item, index) => ({
      id: item?.id || index + 1,
      label1Tag: String(item?.label1Tag || '').trim(),
      label2Tag: String(item?.label2Tag || '').trim()
    }))
    .filter(item => item.label1Tag || item.label2Tag)
    .filter((item) => {
      const key = `${item.label1Tag}__${item.label2Tag}`

      if (seen.has(key)) {
        return false
      }

      seen.add(key)
      return true
    })
    .map((item, index) => ({
      ...item,
      id: index + 1
    }))

  if (!cleaned.length) {
    return {
      raw: [],
      firstLevelTags: DEFAULT_FIRST_LEVEL_TAGS,
      secondLevelTags: DEFAULT_SECOND_LEVEL_TAGS
    }
  }

  const firstLevelTags = uniqueValues(cleaned.map(item => item.label1Tag).concat(DEFAULT_FIRST_LEVEL_TAGS))
  const secondLevelTags = uniqueValues(cleaned.map(item => item.label2Tag).concat(DEFAULT_SECOND_LEVEL_TAGS))

  return {
    raw: cleaned,
    firstLevelTags,
    secondLevelTags
  }
}

const normalizeSourceRecord = (item, index = 0) => {
  const text = String(item?.text || '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, DEEPSEEK_MAX_TEXT_LENGTH)

  if (!text) {
    return null
  }

  return {
    recordId: item?.recordId || String(index + 1),
    text
  }
}

const getNormalizedSourceRecords = (payload) => {
  const sourceRecords = Array.isArray(payload?.sourceRecords) && payload.sourceRecords.length
    ? payload.sourceRecords
    : Array.isArray(payload?.sourceTexts)
      ? payload.sourceTexts.map((text, index) => ({
        recordId: String(index + 1),
        text: String(text || '')
      }))
      : []

  return sourceRecords
    .map((item, index) => normalizeSourceRecord(item, index))
    .filter(Boolean)
}

const createSourceRecordChunks = (payload, chunkSize = DEEPSEEK_BATCH_SIZE) => {
  const sourceRecords = getNormalizedSourceRecords(payload)

  if (!sourceRecords.length) {
    return []
  }

  const chunks = []

  for (let index = 0; index < sourceRecords.length; index += chunkSize) {
    chunks.push(sourceRecords.slice(index, index + chunkSize))
  }

  return chunks
}

const createChunkPayload = (payload, sourceRecordsChunk = []) => ({
  ...payload,
  sourceRecords: sourceRecordsChunk,
  sourceTexts: sourceRecordsChunk.map(item => item?.text || '')
})

const createPreviewPayload = (payload, previewSize = DEEPSEEK_PREVIEW_BATCH_SIZE) => {
  const sourceRecords = getNormalizedSourceRecords(payload)

  if (!sourceRecords.length || sourceRecords.length <= previewSize) {
    return null
  }

  const sampled = []
  const step = Math.max(Math.floor(sourceRecords.length / previewSize), 1)

  for (let index = 0; index < sourceRecords.length && sampled.length < previewSize; index += step) {
    sampled.push(sourceRecords[index])
  }

  if (!sampled.length) {
    return null
  }

  return createChunkPayload(payload, sampled)
}

const normalizeRawRows = (items) => unwrapTagPayload(items)
  .map((item, index) => ({
    id: item?.id || index + 1,
    label1Tag: String(item?.label1Tag || '').trim(),
    label2Tag: String(item?.label2Tag || '').trim()
  }))
  .filter(item => item.label1Tag || item.label2Tag)

const normalizeTags = (items, payload = {}) => {
  const rows = normalizeRawRows(items)

  return buildNormalizedResultFromRows(rows)
}

const mergeTagResults = (results = []) => buildNormalizedResultFromRows(
  results.flatMap(result => Array.isArray(result?.raw) ? result.raw : [])
)

export const getFallbackTags = () => ({
  firstLevelTags: DEFAULT_FIRST_LEVEL_TAGS,
  secondLevelTags: DEFAULT_SECOND_LEVEL_TAGS
})

const parseStreamLine = (line) => {
  const trimmed = line.trim()
  if (!trimmed || !trimmed.startsWith('data:')) {
    return null
  }

  const data = trimmed.slice(5).trim()
  if (data === '[DONE]') {
    return { done: true }
  }

  try {
    const parsed = JSON.parse(data)
    const content = parsed?.choices?.[0]?.delta?.content || ''
    return { content, done: false }
  } catch (error) {
    return null
  }
}

const resolveRequestOptions = (payload, options = {}) => {
  const isPreview = Boolean(options.isPreview)
  const isProductMode = payload?.mode === 'product'
  const isDataMode = payload?.mode === 'data'

  return {
    model: isDataMode ? DEEPSEEK_FAST_MODEL : DEEPSEEK_MODEL,
    maxTokens: isPreview
      ? DEEPSEEK_PREVIEW_MAX_OUTPUT_TOKENS
      : isProductMode
        ? DEEPSEEK_PRODUCT_MAX_OUTPUT_TOKENS
        : DEEPSEEK_MAX_OUTPUT_TOKENS,
    temperature: isProductMode ? DEEPSEEK_PRODUCT_TEMPERATURE : DEEPSEEK_DATA_TEMPERATURE,
    topP: DEEPSEEK_TOP_P,
    systemPrompt: SYSTEM_PROMPT
  }
}

const requestTagTableOnce = async (payload, onStreamChunk = null, requestOptions = {}) => {
  if (!DEEPSEEK_API_KEY) {
    throw new Error('缺少 DeepSeek API Key，请在 .env.local 中配置 VITE_DEEPSEEK_API_KEY')
  }

  const resolvedRequestOptions = resolveRequestOptions(payload, requestOptions)

  const requestUrl = `${DEEPSEEK_BASE_URL.replace(/\/$/, '')}/chat/completions`
  const requestBody = {
    model: resolvedRequestOptions.model,
    thinking: {
      type: 'disabled'
    },
    frequency_penalty: 0,
    max_tokens: resolvedRequestOptions.maxTokens,
    presence_penalty: 0,
    response_format: {
      type: 'text'
    },
    stop: null,
    stream: true,
    stream_options: {
      include_usage: true
    },
    temperature: resolvedRequestOptions.temperature,
    top_p: resolvedRequestOptions.topP,
    tools: null,
    tool_choice: 'none',
    logprobs: false,
    top_logprobs: null,
    messages: [
      {
        role: 'system',
        content: resolvedRequestOptions.systemPrompt
      },
      {
        role: 'user',
        content: buildPrompt(payload)
      }
    ]
  }

  console.group('[DeepSeek] generateTagTable (streaming)')
  console.log('请求入参 payload:', payload)
  console.log('请求地址 url:', requestUrl)
  console.log('请求配置:', resolvedRequestOptions)
  console.log('请求体 body:', { ...requestBody, stream: true, max_tokens: resolvedRequestOptions.maxTokens })

  const response = await fetch(requestUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'text/event-stream',
      Authorization: `Bearer ${DEEPSEEK_API_KEY}`
    },
    body: JSON.stringify(requestBody)
  })

  console.log('响应状态:', response.status, response.statusText)

  if (!response.ok) {
    const errorText = await response.text()
    console.error('DeepSeek 请求失败:', errorText)
    console.groupEnd()
    throw new Error(errorText || 'DeepSeek 请求失败')
  }

  const reader = response.body.getReader()
  const decoder = new TextDecoder('utf-8')
  let buffer = ''
  let fullContent = ''

  while (true) {
    const { done, value } = await reader.read()

    if (done) {
      break
    }

    buffer += decoder.decode(value, { stream: true })
    const lines = buffer.split('\n')

    buffer = lines.pop() || ''

    for (const line of lines) {
      const parsed = parseStreamLine(line)
      if (!parsed) {
        continue
      }

      if (parsed.done) {
        break
      }

      if (parsed.content) {
        fullContent += parsed.content

        if (typeof onStreamChunk === 'function') {
          onStreamChunk(parsed.content, fullContent)
        }
      }
    }
  }

  if (buffer) {
    const parsed = parseStreamLine(buffer)
    if (parsed?.content) {
      fullContent += parsed.content

      if (typeof onStreamChunk === 'function') {
        onStreamChunk(parsed.content, fullContent)
      }
    }
  }

  console.log('流式响应完整内容:', fullContent)

  const extracted = extractJson(fullContent)
  console.log('提取后的 parsed JSON:', extracted)

  if (!extracted) {
    console.warn('DeepSeek 返回内容解析失败，自动回退到默认标签')
    console.groupEnd()

    return {
      raw: [],
      ...getFallbackTags()
    }
  }

  const normalized = normalizeTags(extracted, payload)

  console.log('归一化标签结果:', normalized)
  console.groupEnd()

  return normalized
}

export const generateTagTable = async (payload, options = {}) => {
  const { onProgress, onStreamChunk } = options
  const sourceRecordChunks = payload?.mode === 'data'
    ? createSourceRecordChunks(payload)
    : []

  if (sourceRecordChunks.length <= 1) {
    const singleResult = await requestTagTableOnce(payload, onStreamChunk)

    if (typeof onProgress === 'function') {
      onProgress({
        result: singleResult,
        completedChunks: 1,
        totalChunks: 1,
        isComplete: true
      })
    }

    return singleResult
  }

  console.group('[DeepSeek] 批量异步生成标签')
  console.log('总数据量:', sourceRecordChunks.reduce((sum, chunk) => sum + chunk.length, 0))
  console.log('分片数量:', sourceRecordChunks.length)
  console.log('分片大小:', DEEPSEEK_BATCH_SIZE)
  console.log('最大并发数:', DEEPSEEK_MAX_CONCURRENCY)

  const chunkResults = new Array(sourceRecordChunks.length)
  let completedChunks = 0
  let streamedContent = ''
  const previewPayload = createPreviewPayload(payload)

  const emitProgress = (isComplete = false) => {
    if (typeof onProgress !== 'function') {
      return
    }

    onProgress({
      result: mergeTagResults(chunkResults.filter(Boolean)),
      completedChunks,
      totalChunks: sourceRecordChunks.length,
      isComplete
    })
  }

  if (previewPayload) {
    try {
      const previewResult = await requestTagTableOnce(previewPayload, onStreamChunk, { isPreview: true })

      if (typeof onProgress === 'function') {
        onProgress({
          result: previewResult,
          completedChunks: 0,
          totalChunks: sourceRecordChunks.length,
          isComplete: false
        })
      }
    } catch (error) {
      console.warn('[DeepSeek] 预览标签生成失败，继续执行正式分片:', error)
    }
  }

  let nextChunkIndex = 0

  const runChunkWorker = async () => {
    while (nextChunkIndex < sourceRecordChunks.length) {
      const currentIndex = nextChunkIndex
      nextChunkIndex += 1

      const chunk = sourceRecordChunks[currentIndex]
      const chunkPayload = createChunkPayload(payload, chunk)
      let currentChunkContent = ''

      try {
        const result = await requestTagTableOnce(chunkPayload, previewPayload ? null : (chunkText, chunkFullContent) => {
          currentChunkContent = chunkFullContent

          if (typeof onStreamChunk === 'function') {
            onStreamChunk(chunkText, `${streamedContent}${chunkFullContent}`)
          }
        })

        if (!previewPayload) {
          streamedContent += currentChunkContent
        }

        chunkResults[currentIndex] = result
      } catch (error) {
        console.error(`[DeepSeek] 分片 ${currentIndex + 1}/${sourceRecordChunks.length} 处理失败:`, error)
      } finally {
        completedChunks += 1
        emitProgress(completedChunks === sourceRecordChunks.length)
      }
    }
  }

  const workerCount = Math.min(DEEPSEEK_MAX_CONCURRENCY, sourceRecordChunks.length)
  await Promise.all(Array.from({ length: workerCount }, () => runChunkWorker()))

  const aggregated = mergeTagResults(chunkResults.filter(Boolean))
  emitProgress(true)
  console.log('聚合后的标签结果:', aggregated)
  console.groupEnd()

  return aggregated
}