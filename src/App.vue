<script setup>
import { ref } from 'vue'
import BitableFormItem from './components/BitableFormItem.vue'
import BitableTagTablePage from './components/BitableTagTablePage.vue'
import { generateTagTable, getFallbackTags } from './services/deepseek'

const currentPage = ref('form')
const generatedPayload = ref(null)
const generatedTags = ref(getFallbackTags())
const isGenerating = ref(false)
const generateError = ref('')

const handleGenerate = async (payload) => {
  generatedPayload.value = payload
  currentPage.value = 'tag-table'
  isGenerating.value = true
  generateError.value = ''

  try {
    generatedTags.value = await generateTagTable(payload)
  } catch (error) {
    generatedTags.value = getFallbackTags()
    generateError.value = error?.message || '调用 DeepSeek 失败，请稍后重试'
  } finally {
    isGenerating.value = false
  }
}

const handleBack = () => {
  currentPage.value = 'form'
}
</script>

<template>
  <main>
    <div class="page-header">
      <h4>飞书多维表格标签页面原型</h4>
      <button
        v-if="currentPage === 'tag-table'"
        type="button"
        class="back-btn"
        @click="handleBack"
      >
        返回上一页
      </button>
    </div>

    <div class="page-stage">
      <BitableFormItem
        v-if="currentPage === 'form'"
        :loading="isGenerating"
        @generate="handleGenerate"
      />
      <BitableTagTablePage
        v-else
        :summary="generatedPayload?.summary || ''"
        :table-name="generatedPayload?.productName ? `${generatedPayload.productName}-标签体系` : ''"
        :first-level-tags="generatedTags.firstLevelTags"
        :second-level-tags="generatedTags.secondLevelTags"
        :loading="isGenerating"
        :error-message="generateError"
      />
    </div>
  </main>
</template>

<style scoped>
main {
  min-height: 100vh;
  padding: 24px;
  box-sizing: border-box;
  background: linear-gradient(180deg, #f7f9fc 0%, #eef3f9 100%);
}

.page-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  margin-bottom: 18px;
}

h4 {
  margin: 0;
  font-size: 24px;
  line-height: 1.4;
  color: #1f2329;
}

.page-stage {
  display: flex;
  align-items: flex-start;
}

.back-btn {
  height: 36px;
  padding: 0 16px;
  border: 1px solid #c9d7ff;
  border-radius: 8px;
  background: #fff;
  color: #3370ff;
  font-size: 14px;
  cursor: pointer;
  transition: all 0.2s ease;
}

.back-btn:hover {
  background: #f5f8ff;
  border-color: #a8bfff;
}
</style>
