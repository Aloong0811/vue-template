<script setup>
import { computed, nextTick, onMounted, reactive, ref, watch } from 'vue'
import { createTagTable, getBitableTables, writeTagRowsToTable } from '../services/bitable'

const props = defineProps({
  tableName: {
    type: String,
    default: ''
  },
  summary: {
    type: String,
    default: ''
  },
  tagRows: {
    type: Array,
    default: () => []
  },
  firstLevelTags: {
    type: Array,
    default: () => []
  },
  secondLevelTags: {
    type: Array,
    default: () => []
  },
  sourceTableId: {
    type: String,
    default: ''
  },
  sourceTableName: {
    type: String,
    default: ''
  },
  isGenerating: {
    type: Boolean,
    default: false
  },
  generationComplete: {
    type: Boolean,
    default: true
  },
  completedChunks: {
    type: Number,
    default: 0
  },
  totalChunks: {
    type: Number,
    default: 0
  },
  streamingContent: {
    type: String,
    default: ''
  }
})

const tableOptions = ref([])
const tableLoading = ref(false)
const submitting = ref(false)
const streamingContentRef = ref(null)
const feedbackMessage = ref('')
const feedbackType = ref('info')

const escapeHtml = (value = '') => String(value)
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;')
  .replace(/'/g, '&#39;')

const formatInlineMarkdown = (value = '') => {
  let formatted = escapeHtml(value)

  formatted = formatted.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, '$1')
  formatted = formatted.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '$1')
  formatted = formatted.replace(/`([^`]+)`/g, '<code>$1</code>')
  formatted = formatted.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
  formatted = formatted.replace(/__([^_]+)__/g, '<strong>$1</strong>')
  formatted = formatted.replace(/\*(?!\*)([^*]+)\*/g, '<em>$1</em>')
  formatted = formatted.replace(/_(?!_)([^_]+)_/g, '<em>$1</em>')
  formatted = formatted.replace(/~~([^~]+)~~/g, '<del>$1</del>')

  return formatted
}

const isMarkdownTableSeparator = (line = '') => {
  const trimmed = String(line || '').trim()

  if (!trimmed.includes('|')) {
    return false
  }

  const normalized = trimmed
    .replace(/\|/g, '')
    .replace(/:/g, '')
    .replace(/-/g, '')
    .trim()

  return normalized === ''
}

const parseMarkdownTableLine = (line = '') => String(line || '')
  .trim()
  .replace(/^\|/, '')
  .replace(/\|$/, '')
  .split('|')
  .map(cell => cell.trim())

const cleanMarkdownCell = (value = '') => String(value || '')
  .replace(/`([^`]+)`/g, '$1')
  .replace(/\*\*([^*]+)\*\*/g, '$1')
  .replace(/__([^_]+)__/g, '$1')
  .replace(/\*(?!\*)([^*]+)\*/g, '$1')
  .replace(/_(?!_)([^_]+)_/g, '$1')
  .replace(/~~([^~]+)~~/g, '$1')
  .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '$1')
  .trim()

const extractTagRowsFromMarkdown = (content = '') => {
  const lines = String(content || '').split(/\r?\n/)
  const rows = []

  for (let index = 0; index < lines.length - 2; index += 1) {
    const headerLine = lines[index]?.trim()
    const separatorLine = lines[index + 1]?.trim()

    if (!headerLine || !separatorLine || !headerLine.includes('|') || !isMarkdownTableSeparator(separatorLine)) {
      continue
    }

    let cursor = index + 2

    while (cursor < lines.length) {
      const rowLine = lines[cursor]?.trim()

      if (!rowLine || !rowLine.includes('|')) {
        break
      }

      const cells = parseMarkdownTableLine(rowLine)

      if (cells.length >= 2) {
        rows.push({
          id: rows.length + 1,
          label1Tag: cleanMarkdownCell(cells[0]),
          label2Tag: cleanMarkdownCell(cells[1])
        })
      }

      cursor += 1
    }

    index = cursor - 1
  }

  return rows.filter(item => item.label1Tag || item.label2Tag)
}

const buildMarkdownTableHtml = (tableLines = []) => {
  if (tableLines.length < 2) {
    return ''
  }

  const headerCells = parseMarkdownTableLine(tableLines[0])
  const bodyRows = tableLines
    .slice(2)
    .map(parseMarkdownTableLine)
    .filter(cells => cells.length)

  const mergedBodyRows = bodyRows.map(cells =>
    headerCells.map((_, columnIndex) => ({
      value: cells[columnIndex] || '',
      rowSpan: 1,
      hidden: false
    }))
  )

  for (let columnIndex = 0; columnIndex < headerCells.length; columnIndex += 1) {
    let rowIndex = 0

    while (rowIndex < mergedBodyRows.length) {
      const currentCell = mergedBodyRows[rowIndex]?.[columnIndex]

      if (!currentCell || !currentCell.value) {
        rowIndex += 1
        continue
      }

      let nextRowIndex = rowIndex + 1

      while (nextRowIndex < mergedBodyRows.length) {
        const nextCell = mergedBodyRows[nextRowIndex]?.[columnIndex]

        if (!nextCell || nextCell.value !== currentCell.value) {
          break
        }

        currentCell.rowSpan += 1
        nextCell.hidden = true
        nextRowIndex += 1
      }

      rowIndex = nextRowIndex
    }
  }

  const headerHtml = headerCells
    .map(cell => `<th>${formatInlineMarkdown(cell)}</th>`)
    .join('')

  const bodyHtml = mergedBodyRows
    .map(cells => {
      const rowHtml = cells
        .filter(cell => !cell.hidden)
        .map((cell) => {
          const rowSpanAttr = cell.rowSpan > 1 ? ` rowspan="${cell.rowSpan}"` : ''
          return `<td${rowSpanAttr}>${formatInlineMarkdown(cell.value)}</td>`
        })
        .join('')

      return `<tr>${rowHtml}</tr>`
    })
    .join('')

  return `
    <div class="markdown-table-wrap">
      <table class="markdown-table">
        <thead><tr>${headerHtml}</tr></thead>
        <tbody>${bodyHtml}</tbody>
      </table>
    </div>
  `
}

const renderMarkdownToHtml = (content = '') => {
  const lines = String(content || '').replace(/\r\n?/g, '\n').split('\n')
  const blocks = []
  const paragraphBuffer = []
  const listBuffer = []
  let listType = ''
  let inCodeBlock = false
  let codeBlockLanguage = ''
  let codeBlockLines = []

  const flushParagraph = () => {
    if (!paragraphBuffer.length) {
      return
    }

    blocks.push(`<p>${paragraphBuffer.map(line => formatInlineMarkdown(line)).join('<br />')}</p>`)
    paragraphBuffer.length = 0
  }

  const flushList = () => {
    if (!listBuffer.length || !listType) {
      listBuffer.length = 0
      listType = ''
      return
    }

    blocks.push(`<${listType}>${listBuffer.map(item => `<li>${formatInlineMarkdown(item)}</li>`).join('')}</${listType}>`)
    listBuffer.length = 0
    listType = ''
  }

  const flushCodeBlock = () => {
    if (!codeBlockLines.length && !codeBlockLanguage) {
      return
    }

    const languageLabel = codeBlockLanguage
      ? `<div class="code-block-language">${escapeHtml(codeBlockLanguage)}</div>`
      : ''

    blocks.push(`
      <div class="code-block">
        ${languageLabel}
        <pre><code>${escapeHtml(codeBlockLines.join('\n'))}</code></pre>
      </div>
    `)

    codeBlockLines = []
    codeBlockLanguage = ''
  }

  for (let index = 0; index < lines.length; index += 1) {
    const rawLine = lines[index]
    const trimmed = rawLine.trim()

    if (trimmed.startsWith('```')) {
      flushParagraph()
      flushList()

      if (inCodeBlock) {
        flushCodeBlock()
        inCodeBlock = false
      } else {
        inCodeBlock = true
        codeBlockLanguage = trimmed.slice(3).trim()
      }

      continue
    }

    if (inCodeBlock) {
      codeBlockLines.push(rawLine)
      continue
    }

    if (trimmed && trimmed.includes('|') && index + 1 < lines.length && isMarkdownTableSeparator(lines[index + 1])) {
      flushParagraph()
      flushList()

      const tableLines = [trimmed, lines[index + 1].trim()]
      index += 2

      while (index < lines.length) {
        const tableLine = lines[index]?.trim()

        if (!tableLine || !tableLine.includes('|')) {
          break
        }

        tableLines.push(tableLine)
        index += 1
      }

      blocks.push(buildMarkdownTableHtml(tableLines))
      index -= 1
      continue
    }

    if (!trimmed) {
      flushParagraph()
      flushList()
      continue
    }

    const headingMatch = trimmed.match(/^(#{1,6})\s+(.*)$/)
    if (headingMatch) {
      flushParagraph()
      flushList()
      const level = headingMatch[1].length
      blocks.push(`<h${level}>${formatInlineMarkdown(headingMatch[2])}</h${level}>`)
      continue
    }

    const blockquoteMatch = trimmed.match(/^>\s?(.*)$/)
    if (blockquoteMatch) {
      flushParagraph()
      flushList()
      blocks.push(`<blockquote>${formatInlineMarkdown(blockquoteMatch[1])}</blockquote>`)
      continue
    }

    const unorderedMatch = trimmed.match(/^[-*+]\s+(.*)$/)
    if (unorderedMatch) {
      flushParagraph()

      if (listType && listType !== 'ul') {
        flushList()
      }

      listType = 'ul'
      listBuffer.push(unorderedMatch[1])
      continue
    }

    const orderedMatch = trimmed.match(/^\d+\.\s+(.*)$/)
    if (orderedMatch) {
      flushParagraph()

      if (listType && listType !== 'ol') {
        flushList()
      }

      listType = 'ol'
      listBuffer.push(orderedMatch[1])
      continue
    }

    paragraphBuffer.push(trimmed)
  }

  flushParagraph()
  flushList()

  if (inCodeBlock || codeBlockLines.length || codeBlockLanguage) {
    flushCodeBlock()
  }

  return blocks.join('')
}

const streamingTagRows = computed(() => extractTagRowsFromMarkdown(props.streamingContent))

const uniqueValues = (items = []) => [...new Set(items.filter(Boolean).map(item => String(item).trim()).filter(Boolean))]

const flatEnumeratedTagRows = computed(() => {
  const firstLevelTags = uniqueValues(props.firstLevelTags)
  const secondLevelTags = uniqueValues(props.secondLevelTags)
  const rowCount = Math.max(firstLevelTags.length, secondLevelTags.length)

  return Array.from({ length: rowCount }, (_, index) => ({
    id: index + 1,
    label1Tag: firstLevelTags[index] || '',
    label2Tag: secondLevelTags[index] || ''
  })).filter(item => item.label1Tag || item.label2Tag)
})

const effectiveTagRows = computed(() => {
  if (Array.isArray(props.tagRows) && props.tagRows.length) {
    return props.tagRows
  }

  return streamingTagRows.value
})

const createModeTagRows = computed(() => flatEnumeratedTagRows.value.length ? flatEnumeratedTagRows.value : effectiveTagRows.value)

const formData = reactive({
  action: 'create',
  tableName: '',
  selectedTable: ''
})

const currentTableOption = computed(() => {
  if (!props.sourceTableId) {
    return null
  }

  return {
    id: props.sourceTableId,
    name: props.sourceTableName || ''
  }
})

const normalizedTableOptions = computed(() => {
  if (!currentTableOption.value) {
    return tableOptions.value
  }

  const filteredOptions = tableOptions.value.filter(item => item.id !== currentTableOption.value.id)

  return [currentTableOption.value, ...filteredOptions]
})

const canSubmit = computed(() => {
  const rows = formData.action === 'create' ? createModeTagRows.value : effectiveTagRows.value
  return props.generationComplete && rows.length > 0
})

const showStreamingPanel = computed(() => props.isGenerating || Boolean(props.streamingContent))

const renderedStreamingHtml = computed(() => renderMarkdownToHtml(props.streamingContent))

const streamingPlaceholder = computed(() => {
  if (!props.isGenerating) {
    return ''
  }

  if (props.streamingContent) {
    return ''
  }

  if (props.totalChunks > 0) {
    return '正在等待 DeepSeek 返回首批内容，标签结果会在这里实时刷新…'
  }

  return '正在准备请求并等待 DeepSeek 开始输出，请稍候…'
})

const streamingStatusText = computed(() => (props.isGenerating ? 'AI 标签生成中…' : 'AI 标签生成完成'))

const hintText = computed(() => {
  if (!props.generationComplete) {
    if (props.totalChunks > 0) {
      return `标签正在聚合中，当前进度 ${props.completedChunks}/${props.totalChunks} 批；请等待全部完成后再创建或写入数据表`
    }

    return '标签正在聚合中，请等待全部完成后再创建或写入数据表'
  }

  if (!effectiveTagRows.value.length) {
    if (formData.action === 'create' && createModeTagRows.value.length) {
      return '将一级标签和二级标签枚举后平铺写入新数据表'
    }

    return '当前暂无可写入的标签数据'
  }

  if (formData.action === 'create') {
    return '创建新的页签，并将标签写入 A.一级标签 / A.二级标签 两列'
  }

  const selectedTarget = normalizedTableOptions.value.find(item => item.id === formData.selectedTable)
  return selectedTarget
    ? `将为「${selectedTarget.name}」在右侧新增 A/B/C... 版本标签列，并按顺序写入记录，不覆盖已有标签列内容`
    : '将为当前选择的数据表在右侧新增 A/B/C... 版本标签列，并按顺序写入记录'
})

const setFeedback = (message, type = 'info') => {
  feedbackMessage.value = message
  feedbackType.value = type
}

const loadTables = async () => {
  tableLoading.value = true

  try {
    const tables = await getBitableTables()
    tableOptions.value = tables

    if (!formData.selectedTable && props.sourceTableId) {
      formData.selectedTable = props.sourceTableId
    }
  } catch (error) {
    console.error('[TagTablePage] 读取数据表失败:', error)
  } finally {
    tableLoading.value = false
  }
}

const handleActionChange = (action) => {
  formData.action = action

  if (action === 'write' && props.sourceTableId) {
    formData.selectedTable = props.sourceTableId
  }
}

watch(
  () => props.sourceTableId,
  (value) => {
    if (!value) {
      return
    }

    if (!formData.selectedTable || formData.action === 'write') {
      formData.selectedTable = value
    }
  },
  { immediate: true }
)

watch(
  () => props.streamingContent,
  async () => {
    await nextTick()

    if (streamingContentRef.value) {
      streamingContentRef.value.scrollTop = streamingContentRef.value.scrollHeight
    }
  }
)

const handleSubmit = async () => {
  if (!props.generationComplete) {
    setFeedback('请等待标签数据全部聚合完成后，再创建或写入数据表', 'warning')
    return
  }

  if (!effectiveTagRows.value.length) {
    if (!(formData.action === 'create' && createModeTagRows.value.length)) {
      setFeedback('当前暂无可写入的标签数据', 'warning')
      return
    }
  }

  const submitRows = formData.action === 'create'
    ? createModeTagRows.value
    : effectiveTagRows.value

  if (!submitRows.length) {
    setFeedback('当前暂无可写入的标签数据', 'warning')
    return
  }

  submitting.value = true
  feedbackMessage.value = ''

  try {
    if (formData.action === 'create') {
      const result = await createTagTable({
        name: formData.tableName,
        rows: submitRows.map(item => ({ ...item })),
        firstLevelTags: props.firstLevelTags,
        secondLevelTags: props.secondLevelTags
      })

      await loadTables()
      formData.action = 'write'
      formData.selectedTable = result.tableId
      setFeedback(`创建成功，已写入新数据表列「${result.fieldNames?.firstLevelFieldName || 'A.一级标签'} / ${result.fieldNames?.secondLevelFieldName || 'A.二级标签'}」（tableId: ${result.tableId}）`, 'success')
      return
    }

    const targetTableId = formData.selectedTable || props.sourceTableId
    const result = await writeTagRowsToTable({
      tableId: targetTableId,
      rows: submitRows,
      mode: 'append-versioned-columns'
    })

    const ignoredText = result.ignoredMatchedRecordCount
      ? `，另有 ${result.ignoredMatchedRecordCount} 条记录未被本次写入覆盖`
      : ''

    const unwrittenText = result.unwrittenRowCount
      ? `；由于当前仅匹配到 ${result.updatedCount} 条记录，另有 ${result.unwrittenRowCount} 条标签未写入`
      : ''

    setFeedback(`写入成功，已新增列「${result.fieldNames?.firstLevelFieldName || ''} / ${result.fieldNames?.secondLevelFieldName || ''}」，共写入 ${result.updatedCount} 条记录${ignoredText}${unwrittenText}，目标 tableId: ${result.tableId}`, 'success')
  } catch (error) {
    console.error('[TagTablePage] 写入数据表失败:', error)
    setFeedback(error.message || '写入数据表失败', 'error')
  } finally {
    submitting.value = false
  }
}

onMounted(async () => {
  await loadTables()
})
</script>

<template>
  <section class="prototype-card tag-page-card">
    <div class="title-row">
      <div class="title-icon">#</div>
      <h2>饭大打标签</h2>
    </div>

    <div v-if="showStreamingPanel" class="streaming-panel">
      <div class="streaming-header">
        <div class="streaming-brand">
          <span class="streaming-avatar">D</span>
          <div class="streaming-meta">
            <span class="streaming-title">{{ streamingStatusText }}</span>
          </div>
        </div>
        <span v-if="isGenerating" class="streaming-indicator"></span>
      </div>
      <div ref="streamingContentRef" class="streaming-content markdown-body">
        <div v-if="renderedStreamingHtml" v-html="renderedStreamingHtml"></div>
        <div v-else-if="streamingPlaceholder" class="streaming-placeholder">
          <span class="streaming-placeholder-dot"></span>
          <span>{{ streamingPlaceholder }}</span>
        </div>
      </div>
    </div>

    <div class="divider"></div>

    <div class="mode-row action-row compact">
      <button
        type="button"
        class="mode-item"
        @click="handleActionChange('create')"
      >
        <span class="radio-dot" :class="{ active: formData.action === 'create' }"></span>
        <span class="mode-label">创建数据表</span>
      </button>

      <button
        type="button"
        class="mode-item"
        @click="handleActionChange('write')"
      >
        <span class="radio-dot" :class="{ active: formData.action === 'write' }"></span>
        <span class="mode-label">写入数据表</span>
      </button>
    </div>

    <template v-if="formData.action === 'create'">
      <div class="table-name-row">
        <div class="field-label">数据表名称</div>
        <input
          v-model="formData.tableName"
          class="prototype-input table-name-input"
          type="text"
          placeholder="请输入数据表名"
        >
      </div>

      <div class="submit-row">
        <button
          type="button"
          class="submit-btn wide-btn"
          :disabled="submitting || !canSubmit"
          @click="handleSubmit"
        >
          {{ submitting ? '创建中...' : '创建' }}
        </button>
      </div>

      <p class="hint-text">{{ hintText }}</p>
      <p v-if="feedbackMessage" class="feedback-text" :class="`feedback-${feedbackType}`">{{ feedbackMessage }}</p>
    </template>

    <template v-else>
      <div class="select-wrap write-select-wrap">
        <select v-model="formData.selectedTable" class="prototype-input prototype-select">
          <option disabled value="">{{ tableLoading ? '加载数据表中...' : '选择数据表' }}</option>
          <option v-for="item in normalizedTableOptions" :key="item.id" :value="item.id">{{ item.name }}</option>
        </select>
        <span class="select-arrow"></span>
      </div>

      <div class="submit-row">
        <button type="button" class="submit-btn wide-btn" :disabled="submitting || !canSubmit" @click="handleSubmit">
          {{ submitting ? '写入中...' : '写入' }}
        </button>
      </div>

      <p class="hint-text">{{ hintText }}</p>
      <p v-if="feedbackMessage" class="feedback-text" :class="`feedback-${feedbackType}`">{{ feedbackMessage }}</p>
    </template>
  </section>
</template>

<style scoped>
.prototype-card {
  width: 324px;
  padding: 14px;
  box-sizing: border-box;
  background: #f5f6f8;
  border: 1px solid #dfe3ea;
  border-radius: 10px;
  box-shadow: 0 10px 24px rgba(15, 23, 42, 0.08);
}

.title-row {
  display: flex;
  align-items: center;
  gap: 10px;
  padding-bottom: 10px;
  margin-bottom: 18px;
  border-bottom: 1px solid #e7eaf0;
}

.title-row h2 {
  margin: 0;
  font-size: 16px;
  line-height: 1.4;
  color: #1f2329;
  font-weight: 600;
}

.title-icon {
  width: 30px;
  height: 30px;
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(180deg, #eef3ff 0%, #e4ecff 100%);
  color: #4f6ef7;
  font-size: 16px;
  font-weight: 700;
}

.streaming-panel {
  border: 1px solid #dbe4f5;
  border-radius: 14px;
  background: linear-gradient(180deg, #ffffff 0%, #f8fbff 100%);
  overflow: hidden;
  box-shadow: 0 12px 28px rgba(15, 23, 42, 0.08);
}

.streaming-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
  padding: 14px 16px;
  background: linear-gradient(180deg, #f7faff 0%, #eef4ff 100%);
  border-bottom: 1px solid #e6edff;
}

.streaming-brand {
  display: flex;
  align-items: center;
  gap: 12px;
}

.streaming-avatar {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, #4f7cff 0%, #7a5cff 100%);
  color: #fff;
  font-size: 14px;
  font-weight: 700;
  box-shadow: 0 8px 18px rgba(79, 124, 255, 0.3);
}

.streaming-meta {
  display: flex;
  align-items: center;
}

.streaming-indicator {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: #3370ff;
  animation: pulse 1.5s ease-in-out infinite;
}

@keyframes pulse {
  0%, 100% {
    opacity: 1;
    transform: scale(1);
  }
  50% {
    opacity: 0.5;
    transform: scale(0.8);
  }
}

.streaming-title {
  font-size: 14px;
  font-weight: 600;
  color: #1f2329;
}

.streaming-content {
  max-height: 320px;
  overflow-y: auto;
  padding: 16px;
  font-size: 13px;
  line-height: 1.75;
  color: #1f2329;
  background: linear-gradient(180deg, #ffffff 0%, #fbfcff 100%);
}

.streaming-placeholder {
  min-height: 72px;
  display: flex;
  align-items: center;
  gap: 10px;
  color: #667085;
}

.streaming-placeholder-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  flex: 0 0 auto;
  background: #3370ff;
  box-shadow: 0 0 0 6px rgba(51, 112, 255, 0.12);
  animation: pulse 1.5s ease-in-out infinite;
}

.markdown-body :deep(h1),
.markdown-body :deep(h2),
.markdown-body :deep(h3),
.markdown-body :deep(h4),
.markdown-body :deep(h5),
.markdown-body :deep(h6) {
  margin: 0 0 12px;
  color: #1f2329;
  line-height: 1.45;
}

.markdown-body :deep(h1) {
  font-size: 22px;
}

.markdown-body :deep(h2) {
  font-size: 18px;
}

.markdown-body :deep(h3) {
  font-size: 16px;
}

.markdown-body :deep(p) {
  margin: 0 0 12px;
  color: #344054;
}

.markdown-body :deep(ul),
.markdown-body :deep(ol) {
  margin: 0 0 12px;
  padding-left: 20px;
  color: #344054;
}

.markdown-body :deep(li + li) {
  margin-top: 6px;
}

.markdown-body :deep(blockquote) {
  margin: 0 0 12px;
  padding: 10px 12px;
  border-left: 3px solid #7aa2ff;
  background: #f5f8ff;
  color: #475467;
  border-radius: 0 10px 10px 0;
}

.markdown-body :deep(code) {
  padding: 2px 6px;
  border-radius: 6px;
  background: #f2f4f7;
  color: #7a1fa2;
  font-family: 'Consolas', 'Monaco', 'Courier New', monospace;
  font-size: 12px;
}

.markdown-body :deep(strong) {
  color: #1d2939;
}

.markdown-body :deep(em) {
  color: #475467;
}

.markdown-body :deep(.code-block) {
  margin: 0 0 14px;
  border: 1px solid #dbe4f5;
  border-radius: 12px;
  overflow: hidden;
  background: #0f172a;
}

.markdown-body :deep(.code-block-language) {
  padding: 8px 12px;
  font-size: 12px;
  color: #cbd5e1;
  background: rgba(255, 255, 255, 0.08);
  text-transform: uppercase;
}

.markdown-body :deep(.code-block pre) {
  margin: 0;
  padding: 14px;
  overflow-x: auto;
}

.markdown-body :deep(.code-block code) {
  padding: 0;
  background: transparent;
  color: #e2e8f0;
  font-size: 12px;
}

.markdown-body :deep(.markdown-table-wrap) {
  margin: 0 0 14px;
  overflow-x: auto;
  border: 1px solid #dbe4f5;
  border-radius: 12px;
  background: #fff;
}

.markdown-body :deep(.markdown-table) {
  width: 100%;
  border-collapse: collapse;
  min-width: 240px;
}

.markdown-body :deep(.markdown-table th),
.markdown-body :deep(.markdown-table td) {
  padding: 10px 12px;
  text-align: left;
  border-bottom: 1px solid #e8eef8;
  border-right: 1px solid #eef2f8;
  vertical-align: top;
}

.markdown-body :deep(.markdown-table th:last-child),
.markdown-body :deep(.markdown-table td:last-child) {
  border-right: 0;
}

.markdown-body :deep(.markdown-table thead th) {
  background: #f8fbff;
  color: #1d2939;
  font-weight: 600;
}

.markdown-body :deep(.markdown-table tbody tr:last-child td) {
  border-bottom: 0;
}

.divider {
  height: 1px;
  margin: 16px -14px 14px;
  background: #d9e0ea;
}

.mode-row {
  display: flex;
  align-items: center;
  gap: 8px;
  margin: 0 0 16px;
  padding: 8px 10px;
  background: #fff;
  border: 1px solid #c9d7ff;
  border-radius: 8px;
  box-shadow: inset 0 0 0 1px rgba(51, 112, 255, 0.06);
}

.action-row.compact {
  justify-content: flex-start;
  gap: 18px;
}

.mode-item {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  border: 0;
  background: transparent;
  padding: 4px 2px;
  cursor: pointer;
}

.mode-label {
  font-size: 14px;
  color: #1f2329;
}

.radio-dot {
  width: 16px;
  height: 16px;
  border-radius: 50%;
  position: relative;
  border: 1px solid #b8c2d1;
  background: #fff;
  flex: 0 0 auto;
}

.radio-dot::after {
  content: '';
  position: absolute;
  inset: 3px;
  border-radius: 50%;
  background: transparent;
}

.radio-dot.active {
  border-color: #3370ff;
}

.radio-dot.active::after {
  background: #3370ff;
}

.table-name-row {
  display: flex;
  align-items: stretch;
  margin-bottom: 18px;
}

.select-wrap {
  position: relative;
}

.write-select-wrap {
  margin-bottom: 18px;
}

.field-label {
  flex: 0 0 108px;
  box-sizing: border-box;
  height: 40px;
  min-height: 40px;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0 10px;
  background: #fff;
  border: 1px solid #d0d7e2;
  border-right: 0;
  border-top-left-radius: 8px;
  border-bottom-left-radius: 8px;
  color: #1f2329;
  font-size: 14px;
  font-weight: 600;
}

.prototype-input {
  width: 100%;
  height: 40px;
  box-sizing: border-box;
  border: 1px solid #d0d7e2;
  border-radius: 8px;
  background: #fff;
  text-align: left;
  padding: 0 14px;
  font-size: 14px;
  color: #1f2329;
  outline: none;
  transition: border-color 0.2s ease, box-shadow 0.2s ease;
}

.table-name-input {
  flex: 1;
  display: block;
  border-top-left-radius: 0;
  border-bottom-left-radius: 0;
}

.prototype-input::placeholder {
  color: #8f959e;
  opacity: 1;
}

.prototype-input:focus {
  border-color: #7aa2ff;
  box-shadow: 0 0 0 3px rgba(51, 112, 255, 0.12);
}

.prototype-select {
  appearance: none;
  padding: 0 38px 0 14px;
  text-align: left;
  text-align-last: center;
}

.select-arrow {
  position: absolute;
  top: 50%;
  right: 15px;
  width: 18px;
  height: 18px;
  border-top: 1.5px solid #646a73;
  border-right: 1.5px solid #646a73;
  transform: translateY(-60%) rotate(135deg);
  pointer-events: none;
}

.submit-row {
  display: flex;
  justify-content: flex-end;
}

.submit-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 92px;
  height: 36px;
  padding: 0 18px;
  border: 0;
  border-radius: 8px;
  background: #3370ff;
  color: #fff;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  box-shadow: 0 4px 10px rgba(51, 112, 255, 0.22);
  transition: background 0.2s ease, transform 0.2s ease;
}

.submit-btn:hover {
  background: #295ee6;
}

.submit-btn:active {
  transform: translateY(1px);
}

.submit-btn:disabled {
  background: #94b5ff;
  cursor: not-allowed;
  box-shadow: none;
}

.wide-btn {
  min-width: 116px;
}

.hint-text {
  margin: 18px 2px 0;
  font-size: 14px;
  line-height: 1.6;
  color: #4e5969;
}

.feedback-text {
  margin: 10px 2px 0;
  font-size: 13px;
  line-height: 1.6;
}

.feedback-success {
  color: #0f9f61;
}

.feedback-error {
  color: #d92d20;
}

.feedback-warning {
  color: #b54708;
}

.feedback-info {
  color: #4e5969;
}
</style>