<script setup>
import { reactive, watch } from 'vue'

const props = defineProps({
  tableName: {
    type: String,
    default: ''
  },
  summary: {
    type: String,
    default: ''
  }
})

const firstLevelTags = Array.from({ length: 7 }, () => '描述描述')
const secondLevelTags = Array.from({ length: 7 }, () => '描述描述描述')
const tableOptions = ['产品名称-标签体系', '用户反馈表', '商品评论表', '达人素材表']

const formData = reactive({
  action: 'create',
  tableName: '产品名称-标签体系',
  selectedTable: ''
})

watch(
  () => props.tableName,
  (value) => {
    if (value) {
      formData.tableName = value
    }
  },
  { immediate: true }
)

const handleSubmit = () => {
  console.log('tag table action', { ...formData })
}
</script>

<template>
  <section class="prototype-card tag-page-card">
    <div class="title-row">
      <div class="title-icon">#</div>
      <h2>标签体系数据表</h2>
    </div>

    <div class="tag-board">
      <div class="tag-column">
        <div class="tag-header">1级标签A</div>
        <div v-for="(item, index) in firstLevelTags" :key="`first-${index}`" class="tag-cell">
          {{ item }}
        </div>
      </div>

      <div class="tag-column">
        <div class="tag-header">2级标签A</div>
        <div v-for="(item, index) in secondLevelTags" :key="`second-${index}`" class="tag-cell">
          {{ item }}
        </div>
      </div>
    </div>

    <div class="divider"></div>

    <div class="mode-row action-row compact">
      <button
        type="button"
        class="mode-item"
        @click="formData.action = 'create'"
      >
        <span class="radio-dot" :class="{ active: formData.action === 'create' }"></span>
        <span class="mode-label">创建数据表</span>
      </button>

      <button
        type="button"
        class="mode-item"
        @click="formData.action = 'write'"
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
          placeholder="请输入数据表名称"
        >
      </div>

      <div class="submit-row">
        <button type="button" class="submit-btn wide-btn" @click="handleSubmit">创建</button>
      </div>

      <p class="hint-text">创建新的页签，并写入标签数据</p>
    </template>

    <template v-else>
      <div class="select-wrap write-select-wrap">
        <select v-model="formData.selectedTable" class="prototype-input prototype-select">
          <option disabled value="">选择数据表</option>
          <option v-for="item in tableOptions" :key="item" :value="item">{{ item }}</option>
        </select>
        <span class="select-arrow"></span>
      </div>

      <div class="submit-row">
        <button type="button" class="submit-btn wide-btn" @click="handleSubmit">写入</button>
      </div>

      <p class="hint-text">在选择的数据表中，添加2列新字段</p>
    </template>
  </section>
</template>

<style scoped>
.prototype-card {
  width: 324px;
  min-height: 480px;
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

.tag-board {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;
}

.tag-column {
  display: grid;
  gap: 8px;
}

.tag-header,
.tag-cell {
  min-height: 36px;
  box-sizing: border-box;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 8px 10px;
  border: 1px solid #d5dce7;
  background: #fff;
  color: #1f2329;
}

.tag-header {
  font-size: 14px;
  font-weight: 600;
  background: linear-gradient(180deg, #f8fbff 0%, #eef4ff 100%);
}

.tag-cell {
  font-size: 13px;
  color: #4e5969;
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
  color: #f53f3f;
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

.wide-btn {
  min-width: 116px;
}

.hint-text {
  margin: 18px 2px 0;
  font-size: 14px;
  line-height: 1.6;
  color: #4e5969;
}
</style>