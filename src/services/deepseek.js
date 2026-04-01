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
const DEEPSEEK_API_KEY_ENCRYPTED = import.meta.env.VITE_DEEPSEEK_API_KEY_ENCRYPTED || ''
const DEEPSEEK_API_KEY_SECRET = import.meta.env.VITE_DEEPSEEK_API_KEY_SECRET || ''
const DEEPSEEK_MODEL = import.meta.env.VITE_DEEPSEEK_MODEL || 'deepseek-chat'
const DEEPSEEK_FAST_MODEL = import.meta.env.VITE_DEEPSEEK_FAST_MODEL || DEEPSEEK_MODEL
const DEEPSEEK_ENCRYPTED_KEY_PREFIX = 'enc-v2:'
const DEEPSEEK_ENCRYPTION_KEY_LENGTH = 32
const DEEPSEEK_PBKDF2_ITERATIONS = 120000

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

const AUDIENCE_PROFILE_MAP = {
  '都市GenZ（一二线城市的95后/00后）': {
    name: '都市GenZ',
    definition: '生活在一二线城市的95后/00后',
    profile: '追求新潮与个性：他们是互联网原住民，注重颜值、悦己消费，是潮玩、国潮、新奇特商品的主力军。'
  },
  '小镇GenZ（三四线及以下城市的95后/00后）': {
    name: '小镇GenZ',
    definition: '生活在三四线及以下城市的95后/00后',
    profile: '追求性价比与社交：相比都市GenZ，他们生活压力较小，消费决策更看重实用性和社交属性，是游戏、二次元、本地生活消费的重要力量。'
  },
  '都市银发（一二线城市的50岁以上人群）': {
    name: '都市银发',
    definition: '生活在一二线城市的50岁以上人群',
    profile: '追求品质与健康：通常拥有较高的退休金和消费能力，注重健康养生、旅游、智能家居，是滋补品、高端家电的重要客群。'
  },
  '小镇中老年（三四线及以下城市的50岁以上人群）': {
    name: '小镇中老年',
    definition: '生活在三四线及以下城市的50岁以上人群',
    profile: '追求实用与家庭：消费习惯较为传统，注重家庭生活，是家庭日用品、广场舞装备、高性价比服饰的主要购买者。'
  },
  '精致妈妈（28-45岁，有孩家庭女性）': {
    name: '精致妈妈',
    definition: '28-45岁，有孩家庭女性',
    profile: '追求效率与安全：消费决策围绕孩子和家庭，注重产品的安全、便捷和品质，是母婴、家居、教育类产品的核心决策者。'
  },
  '新锐白领（25-35岁，都市职场精英）': {
    name: '新锐白领',
    definition: '25-35岁，都市职场精英',
    profile: '追求品质与体验：收入较高，注重生活品质和身份认同，是美妆、服饰、轻奢品、体验式服务（如SPA、健身）的主要消费者。'
  },
  '资深中产（35-50岁，事业稳定人群）': {
    name: '资深中产',
    definition: '35-50岁，事业稳定人群',
    profile: '追求价值与圈层：拥有较强的经济实力，消费注重品牌背书和长期价值，是奢侈品、汽车、房产、投资理财的主要客群。'
  },
  '都市蓝领（22-45岁，城市服务业/制造业从业者）': {
    name: '都市蓝领',
    definition: '22-45岁，城市服务业/制造业从业者',
    profile: '追求性价比与即时满足：收入相对有限但消费频次高，注重商品的实用性和即时性，是快消品、平价服饰、本地餐饮的主力军。'
  }
}

let resolvedDeepSeekApiKeyPromise = null

const decodeBase64ToBytes = (value = '') => Uint8Array.from(atob(String(value || '')), char => char.charCodeAt(0))

const decodeBase64Json = (value = '') => {
  const bytes = decodeBase64ToBytes(value)
  return JSON.parse(new TextDecoder().decode(bytes))
}

const decryptDeepSeekApiKey = async (encryptedPayload, secret) => {
  const normalizedPayload = String(encryptedPayload || '').trim()
  const normalizedSecret = String(secret || '').trim()

  if (!normalizedPayload || !normalizedSecret) {
    return ''
  }

  if (!normalizedPayload.startsWith(DEEPSEEK_ENCRYPTED_KEY_PREFIX)) {
    throw new Error('DeepSeek 加密 Key 格式不正确')
  }

  if (typeof window === 'undefined' || !window.crypto?.subtle) {
    throw new Error('当前环境不支持浏览器解密能力')
  }

  const payload = decodeBase64Json(normalizedPayload.slice(DEEPSEEK_ENCRYPTED_KEY_PREFIX.length))
  const textEncoder = new TextEncoder()
  const passwordKey = await window.crypto.subtle.importKey(
    'raw',
    textEncoder.encode(normalizedSecret),
    'PBKDF2',
    false,
    ['deriveKey']
  )

  const derivedKey = await window.crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: decodeBase64ToBytes(payload.salt),
      iterations: Number(payload.iterations) || DEEPSEEK_PBKDF2_ITERATIONS,
      hash: 'SHA-256'
    },
    passwordKey,
    {
      name: 'AES-GCM',
      length: DEEPSEEK_ENCRYPTION_KEY_LENGTH * 8
    },
    false,
    ['decrypt']
  )

  const encryptedBytes = decodeBase64ToBytes(payload.data)
  const authTagBytes = decodeBase64ToBytes(payload.tag)
  const cipherBytes = new Uint8Array(encryptedBytes.length + authTagBytes.length)

  cipherBytes.set(encryptedBytes, 0)
  cipherBytes.set(authTagBytes, encryptedBytes.length)

  const decrypted = await window.crypto.subtle.decrypt(
    {
      name: 'AES-GCM',
      iv: decodeBase64ToBytes(payload.iv),
      tagLength: authTagBytes.length * 8
    },
    derivedKey,
    cipherBytes
  )

  return new TextDecoder().decode(decrypted)
}

const resolveDeepSeekApiKeyValue = async () => {
  if (DEEPSEEK_API_KEY) {
    return DEEPSEEK_API_KEY
  }

  if (DEEPSEEK_API_KEY_ENCRYPTED && DEEPSEEK_API_KEY_SECRET) {
    return decryptDeepSeekApiKey(DEEPSEEK_API_KEY_ENCRYPTED, DEEPSEEK_API_KEY_SECRET)
  }

  return ''
}

const getDeepSeekApiKey = async () => {
  if (!resolvedDeepSeekApiKeyPromise) {
    resolvedDeepSeekApiKeyPromise = resolveDeepSeekApiKeyValue()
  }

  return resolvedDeepSeekApiKeyPromise
}

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

const buildAudienceDefinitionLines = (audiences = []) => {
  const resolvedAudiences = Array.isArray(audiences) ? audiences : []

  return resolvedAudiences
    .map((item) => {
      const matched = AUDIENCE_PROFILE_MAP[item]

      if (!matched) {
        return `- ${item}`
      }

      return `- ${matched.name}｜核心定义：${matched.definition}｜消费特征与画像：${matched.profile}`
    })
    .join('\n')
}

const buildReviewPrompt = (payload) => {
  const data = buildDataContext(payload)
  const productName = payload.productName || '该产品'

  return [
    '我是一名电商行业的用户评价分析师，专门分析用户的售后评价，并针对每一条评论打上标签。',
    `{data}里是不同用户，针对${productName}的评价内容，你需要逐条进行分析，以语义的方式并进行归类总结，替我设计标签。`,
    '',
    data,
    '',
    '要求1：只需要生成标签，不要有任何其他的内容。',
    '要求2：以表格的形式进行输出，表格一共2列，第1列是1级标签，第2列是2级标签。请直接输出内容，不要给我生成文件。',
    '要求3：所有的2级标签，必须归属于1级标签的体系之下。',
    '要求4：我是有经验的标签设计师，我设计的1级标签符合MECE原则的，你需要在我的约束条件下，基于语义进行2级标签的补充。',
    '',
    '1级标签我已经锁死，不要添加其他任何内容，它们分别是：无法归类、基础属性、外观特征、质量感受、使用体验、使用场景、功能效果、价格价值、物流服务、客户服务。',
    '',
    '【无法归类】包含的2级标签有：无法归类。',
    '【基础属性】包含的2级标签有：数量规格、材质、重量、尺寸大小、成分材料。',
    '【物流服务】包含的2级标签有：物流速度、错漏发、破损。',
    '【价格价值】包含的2级标签有：价格折扣、赠品、品牌比较、是否回购。',
    '【客户服务】包含的2级标签有：客户服务。',
    '',
    '以上5个1级标签下的2级标签属于共性标签，已经锁死。',
    '以下5个1级标签下的2级标签属于特性标签，需要你协助补充。',
    '',
    '【外观特征】包含的2级标签有：颜色、造型、风格、包装。',
    '【质量感受】包含的2级标签有：耐用性、工艺水平、稳定性、厚薄、软硬。',
    '【使用体验】包含的2级标签有：舒适度、易用性、便利性、味道、维护成本、上手难易度。',
    '以上3个1级标签之下，你需要基于用户评价增加标签，你可以添加的数量是0~2个。',
    '',
    '【使用场景】包含的2级标签有：送礼场景。剩余的由你来设计。',
    '【使用场景】指的是用户在什么场景下使用，请你基于用户描述进行自由提炼，你可以添加的数量是0~5个。',
    '',
    '【功能效果】包含的2级标签完全由你来设计。',
    '【功能效果】指的是产品能不能解决问题、产品可以带来什么价值。请你基于用户描述进行自由提炼，你可以添加的数量是0~5个。',
    '',
    '要求5：你所有自主添加的标签，不能和其他所有的2级标签重复，要符合MECE原则。如果你发现有与其他2级标签含义重复，你可以不添加任何2级标签。',
    '要求6：在输出之前，请基于你设计的2级标签轮循检查、反复验证，所有2级标签请尽量做到MECE原则。例如：功能效果、使用体验、质量感受这3个模块的2级标签很容易重复，请仔细检查并调整。',
    '',
    '输出格式必须严格为以下 Markdown 表格：',
    MARKDOWN_TABLE_TEMPLATE
  ].join('\n')
}

const buildQaPrompt = (payload) => {
  const data = buildDataContext(payload)
  const productName = payload.productName || '该产品'

  return [
    '我是一名电商行业的数据分析师，专门分析用户的购买前咨询内容，看用户在购买前主要关心哪些问题，并针对每一条用户关心的提问设计标签。',
    `{data}里是不同用户，针对${productName}的提问内容，你需要逐条进行分析，以语义的方式并进行归类总结，替我设计标签。`,
    '',
    data,
    '',
    '要求1：只需要生成标签，不要有任何其他的内容。',
    '要求2：以表格的形式进行输出，表格一共2列，第1列是1级标签，第2列是2级标签。请直接输出内容，不要给我生成文件。',
    '要求3：所有的2级标签，必须归属于1级标签的体系之下。',
    '要求4：我是有经验的标签设计师，我设计的1级标签符合MECE原则的，你需要在我的约束条件下，基于语义进行2级标签的补充。',
    '',
    '1级标签我已经锁死，不要添加其他任何内容，它们分别是：无法归类、基础属性、外观特征、质量感受、使用体验、使用场景、功能效果、价格价值、物流服务、客户服务。',
    '',
    '【无法归类】包含的2级标签有：无法归类。',
    '【基础属性】包含的2级标签有：数量规格、材质、重量、尺寸大小、成分材料。',
    '【物流服务】包含的2级标签有：物流速度、错漏发、破损。',
    '【价格价值】包含的2级标签有：价格折扣、赠品、品牌比较、是否回购。',
    '【客户服务】包含的2级标签有：客户服务。',
    '',
    '以上5个1级标签下的2级标签属于共性标签，已经锁死。',
    '以下5个1级标签下的2级标签属于特性标签，需要你协助补充。',
    '',
    '【外观特征】包含的2级标签有：颜色、造型、风格、包装。',
    '【质量感受】包含的2级标签有：耐用性、工艺水平、稳定性、厚薄、软硬。',
    '【使用体验】包含的2级标签有：舒适度、易用性、便利性、味道、维护成本、上手难易度。',
    '以上3个1级标签之下，你需要基于用户的评价/提问增加标签，你可以添加的数量是0~2个。',
    '',
    '【使用场景】包含的2级标签有：送礼场景。剩余的由你来设计。',
    '【使用场景】指的是用户在什么场景下使用，请你基于用户描述进行自由提炼，你可以添加的数量是0~5个。',
    '',
    '【功能效果】包含的2级标签完全由你来设计。',
    '【功能效果】指的是产品能解决什么问题、可以带来什么价值。请你基于用户描述进行自由提炼，你可以添加的数量是3~5个。',
    '',
    '要求5：你所有自主添加的标签，不能和其他所有的2级标签重复，要符合MECE原则。如果你发现有与其他2级标签含义重复，你可以不添加任何2级标签。',
    '要求6：在输出之前，请基于你设计的2级标签轮循检查、反复验证，所有2级标签请尽量做到MECE原则。例如：功能效果、使用体验、质量感受这3个模块的2级标签很容易重复，请仔细检查并调整。',
    '',
    '输出格式必须严格为以下 Markdown 表格：',
    MARKDOWN_TABLE_TEMPLATE
  ].join('\n')
}

const buildProductPrompt = (payload) => {
  const productName = payload.productName || '输入产品名称'
  const coreFeature = payload.coreFeature || '产品的核心功能'
  const audienceSummary = Array.isArray(payload.audiences) && payload.audiences.length
    ? payload.audiences.map(item => AUDIENCE_PROFILE_MAP[item]?.name || item).join('、')
    : '产品人群'
  const audienceDefinitionLines = buildAudienceDefinitionLines(payload.audiences)

  return [
    '我是一名电商行业的数据分析师，专门分析用户的购买前咨询内容，看用户在购买前主要关心哪些问题，并针对每一条用户关心的提问设计标签。',
    '我现在手头，没有任何用户的数据。',
    '',
    '我希望你基于各个电商平台、各个行业分析报告，输出1级和2级标签。',
    '',
    '要求1：只需要生成标签，不要有任何其他的内容。',
    '要求2：以表格的形式进行输出，表格一共2列，第1列是1级标签，第2列是2级标签。请直接输出内容，不要给我生成文件。',
    '要求3：所有的2级标签，必须归属于1级标签的体系之下。',
    '要求4：我是有经验的标签设计师，我设计的1级标签符合MECE原则的，你需要在我的约束条件下，基于语义进行2级标签的补充。',
    '',
    '1级标签我已经锁死，不要添加其他任何内容，它们分别是：无法归类、基础属性、外观特征、质量感受、使用体验、使用场景、功能效果、价格价值、物流服务、客户服务。',
    '',
    '要求5：你所有自主添加的标签，不能和其他所有的2级标签重复，要符合MECE原则。如果你发现有与其他2级标签含义重复，你可以不添加任何2级标签。',
    '要求6：在输出之前，请基于你设计的2级标签轮循检查、反复验证，所有2级标签请尽量做到MECE原则。例如：功能效果、使用体验、质量感受这3个模块的2级标签很容易重复，请仔细检查并调整。',
    '',
    `我们本次生成的产品是：“${productName}”`,
    `产品的核心功能是：“${coreFeature}”`,
    `我们的产品核心人群包含：${audienceSummary}`,
    '',
    '附：产品使用核心人群定义',
    '人群名称｜核心定义｜消费特征与画像',
    audienceDefinitionLines || '- 产品人群｜待补充｜待补充',
    '',
    '请开始工作。',
    '',
    '输出格式必须严格为以下 Markdown 表格：',
    MARKDOWN_TABLE_TEMPLATE
  ].join('\n')
}

const buildGenericPrompt = (payload) => {
  const data = buildDataContext(payload)

  return [
    '任务：基于业务信息生成标签。',
    data,
    '规则：',
    '1. 根据输入信息尽可能完整输出标签，不要人为限制标签条数。',
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

  const cleanedRows = rows
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

  const cleaned = cleanedRows

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

const normalizePayloadSourceRecords = (payload = {}) => {
  const sourceRecords = Array.isArray(payload?.sourceRecords) && payload.sourceRecords.length
    ? payload.sourceRecords
    : Array.isArray(payload?.sourceTexts)
      ? payload.sourceTexts.map((text, index) => ({
        recordId: String(index + 1),
        text: String(text || '')
      }))
      : []

  const normalizedSourceRecords = sourceRecords
    .map((item, index) => normalizeSourceRecord(item, index))
    .filter(Boolean)

  return normalizedSourceRecords
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
  const deepSeekApiKey = await getDeepSeekApiKey()

  if (!deepSeekApiKey) {
    throw new Error('缺少 DeepSeek API Key，请在 .env.local 中配置 VITE_DEEPSEEK_API_KEY 或加密后的 VITE_DEEPSEEK_API_KEY_ENCRYPTED')
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
      Authorization: `Bearer ${deepSeekApiKey}`
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
  const normalizedSourceRecords = normalizePayloadSourceRecords(payload)
  const normalizedPayload = {
    ...payload,
    sourceRecords: normalizedSourceRecords,
    sourceTexts: normalizedSourceRecords.map(item => item.text)
  }
  const result = await requestTagTableOnce(normalizedPayload, onStreamChunk)

  if (typeof onProgress === 'function') {
    onProgress({
      result,
      completedChunks: 1,
      totalChunks: 1,
      isComplete: true
    })
  }

  return result
}