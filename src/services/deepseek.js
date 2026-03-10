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

const buildDataContext = (payload) => {
  if (payload.mode === 'data') {
    return JSON.stringify({
      productName: payload.productName || '',
      table: payload.table || '',
      field: payload.field || '',
      channel: payload.channel || ''
    }, null, 2)
  }

  return JSON.stringify({
    productName: payload.productName || '',
    coreFeature: payload.coreFeature || '',
    audiences: payload.audiences || []
  }, null, 2)
}

const buildReviewPrompt = (payload) => {
  const data = buildDataContext(payload)

  return `你是一名电商运营专家，${data}是我从电商平台上采集到的用户评价数据，你需要对用户评价进行深度分析，以洞察用户痛点和需求。请按照以下步骤和格式完成评价分析任务：
1. 逐条分析评价：对提供的每一条用户评价，仔细阅读并提取其中涉及的关键词或短语，理解其语义。
2. 归纳出一级标签（宏观维度）和二级标签（具体痛点/需求），确保标签体系符合MECE原则；
3. 按一级标签占比从高到低排序；
4. 最终以JSON格式输出，格式为：[{"id":1,"label1Tag":"","label2Tag":""}, ...]`
}

const buildQaPrompt = (payload) => {
  const data = buildDataContext(payload)

  return `你是一名电商运营专家。${data}是我从电商平台采集的消费者在购买“${payload.productName || '产品名称'}”时的“问大家”数据，请帮我设计一套标签分类体系，用于洞察消费者购买前的关注点。

要求：
1. 逐条分析每条“问大家”内容，提取关键词和语义。
2. 归纳一级标签（宏观维度，如“产品功能”、“物流服务”等）和二级标签（具体关注点，如“是否防水”、“发货速度”等），确保标签体系符合MECE原则（相互独立、完全穷举）。
3. 以表格形式输出，字段为：一级标签、二级标签。
4. 按一级标签的出现频次从高到低排序（如有数据支持）。
5. 同时请额外输出严格 JSON，格式为：[{"id":1,"label1Tag":"","label2Tag":""}, ...]，方便程序解析。`
}

const buildGenericPrompt = (payload) => {
  const data = buildDataContext(payload)

  return [
    '你是一名电商运营与标签体系分析专家。',
    `以下是待分析的业务信息：${data}`,
    '请基于这些信息输出标签分析结果。',
    '要求：',
    '1. 输出严格 JSON。',
    '2. JSON 格式为：[{"id":1,"label1Tag":"","label2Tag":""}, ...]。',
    '3. 返回 7 条标签结果。',
    '4. label1Tag 为一级标签，label2Tag 为二级标签。',
    '5. 一级标签尽量体现宏观维度，二级标签尽量体现用户需求、痛点或具体描述。'
  ].join('\n')
}

const buildPrompt = (payload) => {
  if (payload.mode === 'data' && payload.channel === 'review') {
    return buildReviewPrompt(payload)
  }

  if (payload.mode === 'data' && payload.channel === 'qa') {
    return buildQaPrompt(payload)
  }

  return buildGenericPrompt(payload)
}

const extractJson = (content) => {
  if (!content) {
    return null
  }

  try {
    return JSON.parse(content)
  } catch (error) {
    const matched = content.match(/\[[\s\S]*\]|\{[\s\S]*\}/)
    if (!matched) {
      return null
    }

    try {
      return JSON.parse(matched[0])
    } catch (parseError) {
      return null
    }
  }
}

const normalizeTags = (items) => {
  if (!Array.isArray(items)) {
    return {
      firstLevelTags: DEFAULT_FIRST_LEVEL_TAGS,
      secondLevelTags: DEFAULT_SECOND_LEVEL_TAGS
    }
  }

  const cleaned = items
    .map(item => ({
      label1Tag: String(item?.label1Tag || '').trim(),
      label2Tag: String(item?.label2Tag || '').trim()
    }))
    .filter(item => item.label1Tag || item.label2Tag)
    .slice(0, 7)

  const firstLevelTags = cleaned.map(item => item.label1Tag).filter(Boolean)
  const secondLevelTags = cleaned.map(item => item.label2Tag).filter(Boolean)

  return {
    firstLevelTags: firstLevelTags.concat(DEFAULT_FIRST_LEVEL_TAGS).slice(0, 7),
    secondLevelTags: secondLevelTags.concat(DEFAULT_SECOND_LEVEL_TAGS).slice(0, 7)
  }
}

export const getFallbackTags = () => ({
  firstLevelTags: DEFAULT_FIRST_LEVEL_TAGS,
  secondLevelTags: DEFAULT_SECOND_LEVEL_TAGS
})

export const generateTagTable = async (payload) => {
  const response = await fetch('/api/deepseek/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model: 'deepseek-chat',
      temperature: 0.6,
      messages: [
        {
          role: 'system',
          content: '你是一名专业的中文电商运营分析助手，擅长用户评价洞察和标签体系搭建。'
        },
        {
          role: 'user',
          content: buildPrompt(payload)
        }
      ]
    })
  })

  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(errorText || 'DeepSeek 请求失败')
  }

  const result = await response.json()
  const content = result?.choices?.[0]?.message?.content || ''
  const parsed = extractJson(content)

  if (!parsed) {
    throw new Error('DeepSeek 返回内容解析失败')
  }

  return normalizeTags(parsed)
}