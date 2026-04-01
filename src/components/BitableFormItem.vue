<script setup>
import { computed, onBeforeUnmount, onMounted, reactive, ref } from 'vue'
import {
  getBitableBaseSelection,
  getBitableFields,
  getBitableTables,
  watchBitableSelectionChange
} from '../services/bitable'

defineProps({
  loading: {
    type: Boolean,
    default: false
  }
})

const emit = defineEmits(['generate'])
const generatorOptions = [
  { label: '根据数据生成', value: 'data' },
  { label: '根据产品生成', value: 'product' }
]

const dataChannelOptions = [
  { label: '用户评价', value: 'review' },
  { label: '问大家', value: 'qa' },
  { label: '售前咨询', value: 'consulting' },
  { label: '社交媒体', value: 'social' }
]

const visibleDataChannelOptions = dataChannelOptions.filter(
  item => item.value === 'review' || item.value === 'qa'
)

const getChannelLabel = (value) => dataChannelOptions.find(item => item.value === value)?.label || '未选择'

const tableOptions = ref([])
const fieldOptions = ref([])
const bitableMessage = ref('')
const tableLoading = ref(false)
const fieldLoading = ref(false)
let stopSelectionWatch = null

const audienceOptions = [
  '都市GenZ（一二线城市的95后/00后）',
  '小镇GenZ（三四线及以下城市的95后/00后）',
  '都市银发（一二线城市的50岁以上人群）',
  '小镇中老年（三四线及以下城市的50岁以上人群）',
  '精致妈妈（28-45岁，有孩家庭女性）',
  '新锐白领（25-35岁，都市职场精英）',
  '资深中产（35-50岁，事业稳定人群）',
  '都市蓝领（22-45岁，城市服务业/制造业从业者）'
]

const formData = reactive({
  mode: 'data',
  productName: '',
  table: '',
  field: '',
  channel: 'review',
  coreFeature: '',
  audiences: [...audienceOptions]
})

const currentTable = computed(() => tableOptions.value.find(item => item.id === formData.table) || null)
const currentField = computed(() => fieldOptions.value.find(item => item.id === formData.field) || null)
const canGenerate = computed(() => {
  const hasProductName = Boolean(formData.productName.trim())

  if (formData.mode === 'data') {
    return hasProductName && Boolean(formData.table) && Boolean(formData.field)
  }

  const hasCoreFeature = Boolean(formData.coreFeature.trim())
  const hasAudiences = Array.isArray(formData.audiences) && formData.audiences.length > 0

  return hasProductName && hasCoreFeature && hasAudiences
})

const applySelection = async (selection) => {
  if (!selection?.tableId) {
    return
  }

  const hasMatchedTable = tableOptions.value.some(item => item.id === selection.tableId)
  if (!hasMatchedTable) {
    return
  }

  formData.table = selection.tableId
  await loadFields(selection.tableId, selection.fieldId)
}

const loadFields = async (tableId = formData.table, preferredFieldId = '') => {
  formData.field = ''
  fieldOptions.value = []

  if (!tableId) {
    return
  }

  fieldLoading.value = true

  try {
    const fields = await getBitableFields(tableId)
    fieldOptions.value = fields

    const nextFieldId = preferredFieldId && fields.some(item => item.id === preferredFieldId)
      ? preferredFieldId
      : ''

    formData.field = nextFieldId
  } catch (error) {
    bitableMessage.value = error.message || '读取字段失败'
  } finally {
    fieldLoading.value = false
  }
}

const loadTables = async () => {
  tableLoading.value = true
  bitableMessage.value = ''

  try {
    const [tables, selection] = await Promise.all([
      getBitableTables(),
      getBitableBaseSelection().catch(() => null)
    ])

    tableOptions.value = tables

    if (!tables.length) {
      formData.table = ''
      fieldOptions.value = []
      bitableMessage.value = '当前账号暂无可访问的数据表'
      return
    }

    if (selection?.tableId && tables.some(item => item.id === selection.tableId)) {
      formData.table = selection.tableId
      await loadFields(selection.tableId, selection.fieldId)
      return
    }

    if (!tables.some(item => item.id === formData.table)) {
      formData.table = ''
    }

    if (formData.table) {
      await loadFields(formData.table)
    }
  } catch (error) {
    bitableMessage.value = error.message || '读取数据表失败'
    tableOptions.value = []
    fieldOptions.value = []
  } finally {
    tableLoading.value = false
  }
}

const handleModeChange = (mode) => {
  formData.mode = mode
}

const handleTableChange = async () => {
  await loadFields(formData.table)
}

const toggleAudience = (item) => {
  const index = formData.audiences.indexOf(item)
  if (index > -1) {
    formData.audiences.splice(index, 1)
    return
  }
  formData.audiences.push(item)
}

const handleGenerate = () => {
  if (!canGenerate.value) {
    return
  }

  emit('generate', {
    mode: formData.mode,
    productName: formData.productName,
    tableId: formData.table,
    table: currentTable.value?.name || '',
    fieldId: formData.field,
    field: currentField.value?.name || '',
    channel: formData.channel,
    channelLabel: getChannelLabel(formData.channel),
    coreFeature: formData.coreFeature,
    audiences: [...formData.audiences],
    summary: formData.mode === 'data'
      ? `根据数据生成 / ${formData.productName || '未填写'} / ${currentTable.value?.name || '未选择'} / ${currentField.value?.name || '未选择'} / ${getChannelLabel(formData.channel)}`
      : `根据产品生成 / ${formData.productName || '未填写'} / ${formData.coreFeature || '未填写'}`
  })
}

onMounted(async () => {
  await loadTables()

  stopSelectionWatch = watchBitableSelectionChange(async (selection) => {
    await applySelection(selection)
  })
})

onBeforeUnmount(() => {
  if (typeof stopSelectionWatch === 'function') {
    stopSelectionWatch()
  }
})
</script>

<template>
  <section class="prototype-card">
    <div class="title-row">
      <div class="title-icon">&lt;/&gt;</div>
      <h2>饭大打标签</h2>
    </div>

    <div class="mode-row">
      <button
        v-for="item in generatorOptions"
        :key="item.value"
        type="button"
        class="mode-item"
        @click="handleModeChange(item.value)"
      >
        <span class="radio-dot" :class="{ active: formData.mode === item.value }"></span>
        <span class="mode-label">{{ item.label }}</span>
      </button>
    </div>

    <div class="form-stack">
      <input
        v-model="formData.productName"
        class="prototype-input highlight"
        type="text"
        placeholder="输入产品名称"
      >

      <template v-if="formData.mode === 'data'">
        <div class="select-wrap">
          <select v-model="formData.table" class="prototype-input prototype-select" @change="handleTableChange">
            <option disabled value="">{{ tableLoading ? '加载数据表中...' : '选择数据表' }}</option>
            <option v-for="item in tableOptions" :key="item.id" :value="item.id">{{ item.name }}</option>
          </select>
          <span class="select-arrow"></span>
        </div>

        <div class="select-wrap">
          <select v-model="formData.field" class="prototype-input prototype-select">
            <option disabled value="">{{ fieldLoading ? '加载字段中...' : '选择字段' }}</option>
            <option
              v-for="item in fieldOptions"
              :key="item.id"
              :value="item.id"
            >
              {{ item.name }}
            </option>
          </select>
          <span class="select-arrow"></span>
        </div>

        <p v-if="bitableMessage" class="bitable-message">{{ bitableMessage }}</p>

        <div class="choice-grid two-col radio-grid">
          <button
            v-for="item in visibleDataChannelOptions"
            :key="item.value"
            type="button"
            class="choice-card"
            @click="formData.channel = item.value"
          >
            <span class="radio-dot" :class="{ active: formData.channel === item.value }"></span>
            <span>{{ item.label }}</span>
          </button>
        </div>
      </template>

      <template v-else>
        <input
          v-model="formData.coreFeature"
          class="prototype-input highlight"
          type="text"
          placeholder="产品的核心功能"
        >

        <div class="field-title">产品核心人群</div>

        <div class="choice-grid audience-grid">
          <button
            v-for="item in audienceOptions"
            :key="item"
            type="button"
            class="audience-item"
            :class="{ selected: formData.audiences.includes(item) }"
            @click="toggleAudience(item)"
          >
            <span class="checkbox-box" :class="{ checked: formData.audiences.includes(item) }">
              {{ formData.audiences.includes(item) ? '✓' : '' }}
            </span>
            <span>{{ item }}</span>
          </button>
        </div>
      </template>
    </div>

    <button type="button" class="submit-btn" :disabled="loading || !canGenerate" @click="handleGenerate">
      {{ loading ? '生成中...' : '生成标签' }}
    </button>
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
}

.radio-dot::after {
  content: '';
  position: absolute;
  inset: 3px;
  border-radius: 50%;
  background: transparent;
}

.radio-dot.active::after {
  background: #3370ff;
}

.radio-dot.active {
  border-color: #3370ff;
}

.form-stack {
  display: flex;
  flex-direction: column;
  gap: 12px;
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

.highlight {
  color: #1f2329;
}

.prototype-input::placeholder {
  color: #8f959e;
  opacity: 1;
}

.prototype-input:focus,
.prototype-select:focus {
  border-color: #7aa2ff;
  box-shadow: 0 0 0 3px rgba(51, 112, 255, 0.12);
}

.select-wrap {
  position: relative;
}

.prototype-select {
  appearance: none;
  padding: 0 38px 0 14px;
  text-align: left;
  text-align-last: left;
}

.select-arrow {
  position: absolute;
  top: 50%;
  right: 15px;
  width: 7px;
  height: 7px;
  border-right: 1.5px solid #646a73;
  border-bottom: 1.5px solid #646a73;
  transform: translateY(-65%) rotate(45deg);
  pointer-events: none;
}

.bitable-message {
  margin: -4px 2px 2px;
  font-size: 12px;
  line-height: 1.5;
  color: #f53f3f;
}

.field-title {
  margin: 2px 2px -2px;
  font-size: 14px;
  line-height: 1.5;
  color: #1f2329;
  font-weight: 600;
}

.choice-grid {
  display: grid;
  gap: 8px;
}

.two-col {
  grid-template-columns: repeat(2, minmax(0, 1fr));
}

.radio-grid {
  margin-top: 2px;
  padding: 8px;
  background: #fff;
  border: 1px solid #dce3ec;
  border-radius: 8px;
}

.choice-card {
  min-height: 40px;
  border: 1px solid #dce3ec;
  border-radius: 8px;
  background: #f7f9fc;
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 0 12px;
  cursor: pointer;
  font-size: 14px;
  color: #1f2329;
  transition: all 0.2s ease;
}

.choice-card:hover,
.audience-item:hover {
  border-color: #b8cafc;
  background: #f5f8ff;
}

.audience-grid {
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 8px;
}

.audience-item {
  min-height: 40px;
  padding: 8px 10px;
  border: 1px solid #dce3ec;
  border-radius: 8px;
  background: #fff;
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
  color: #1f2329;
  text-align: left;
  cursor: pointer;
  transition: all 0.2s ease;
}

.audience-item.selected {
  border-color: #b8cafc;
  background: #eef4ff;
}

.checkbox-box {
  width: 16px;
  height: 16px;
  flex: 0 0 auto;
  border: 1px solid #b8c2d1;
  border-radius: 4px;
  background: #fff;
  color: transparent;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: 12px;
  line-height: 1;
}

.checkbox-box.checked {
  background: #3370ff;
  border-color: #3370ff;
  color: #fff;
}

.submit-btn {
  margin-top: 18px;
  margin-left: auto;
  display: block;
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

.submit-btn:disabled {
  background: #94b5ff;
  cursor: not-allowed;
  box-shadow: none;
}

.submit-btn:active {
  transform: translateY(1px);
}
</style>