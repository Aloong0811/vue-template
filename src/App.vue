<script setup>
import { ref } from 'vue'
import BitableFormItem from './components/BitableFormItem.vue'
import BitableTagTablePage from './components/BitableTagTablePage.vue'
import { generateTagTable, getFallbackTags } from './services/deepseek'
import { getBitableFieldValues } from './services/bitable'

const generatedPayload = ref(null)
const generating = ref(false)
const generationProgress = ref({
  completedChunks: 0,
  totalChunks: 0,
  isComplete: false
})
const streamingContent = ref('')

const handleGenerate = async (payload) => {
  generating.value = true
  generationProgress.value = {
    completedChunks: 0,
    totalChunks: 0,
    isComplete: false
  }
  generatedPayload.value = null
  streamingContent.value = ''

  generatedPayload.value = {
    ...payload,
    generatedTags: {
      raw: []
    },
    generationMeta: {
      completedChunks: 0,
      totalChunks: 0,
      isComplete: false
    }
  }

  console.group('[App] 开始调用 DeepSeek 生成标签')
  console.log('触发时间:', new Date().toISOString())
  console.log('表单提交 payload:', payload)

  try {
    let nextPayload = { ...payload }

    if (payload.mode === 'data' && payload.tableId && payload.fieldId) {
      const sourceRecords = await getBitableFieldValues({
        tableId: payload.tableId,
        fieldId: payload.fieldId
      })

      nextPayload = {
        ...payload,
        sourceRecords,
        sourceTexts: sourceRecords.map(item => item.text)
      }

      generatedPayload.value = {
        ...generatedPayload.value,
        ...nextPayload,
        generationMeta: {
          ...generationProgress.value,
          isComplete: false
        }
      }

      console.log('[App] 读取到的原始字段数据:', sourceRecords)
    }

    const generatedTags = await generateTagTable(nextPayload, {
      onProgress: ({ result, completedChunks, totalChunks, isComplete }) => {
        const hasAvailableRows = Array.isArray(result?.raw) && result.raw.length > 0

        generationProgress.value = {
          completedChunks,
          totalChunks,
          isComplete
        }

        if (!hasAvailableRows && !isComplete) {
          console.log('[App] 当前批次尚未拿到可渲染数据，继续等待后续响应')
          return
        }

        generatedPayload.value = {
          ...nextPayload,
          generatedTags: result,
          generationMeta: {
            completedChunks,
            totalChunks,
            isComplete
          }
        }

        console.log('[App] 标签分批生成进度:', {
          completedChunks,
          totalChunks,
          isComplete,
          previewCount: result?.raw?.length || 0
        })
      },
      onStreamChunk: (chunk, fullContent) => {
        streamingContent.value = fullContent
      }
    })

    generatedPayload.value = {
      ...nextPayload,
      generatedTags,
      generationMeta: {
        ...generationProgress.value,
        isComplete: true
      }
    }

    generationProgress.value = {
      ...generationProgress.value,
      isComplete: true
    }

    console.log('[App] 标签生成完成，页面展示入参:', generatedPayload.value)
    console.groupEnd()
  } catch (error) {
    const fallbackTags = getFallbackTags()

    console.error('[App] 调用 DeepSeek 生成标签失败:', error)

    generatedPayload.value = {
      ...(generatedPayload.value || payload),
      generatedTags: {
        raw: [],
        ...fallbackTags
      },
      generationMeta: {
        completedChunks: 0,
        totalChunks: 0,
        isComplete: true
      }
    }

    generationProgress.value = {
      completedChunks: 0,
      totalChunks: 0,
      isComplete: true
    }

    console.groupEnd()
  } finally {
    generating.value = false
  }
}
</script>

<template>
  <main>
    <div class="page-stage">
      <BitableFormItem
        :loading="generating"
        @generate="handleGenerate"
      />

      <BitableTagTablePage
        v-if="generatedPayload"
        :summary="generatedPayload?.summary || ''"
        :table-name="generatedPayload?.productName ? `${generatedPayload.productName}-标签体系` : ''"
        :tag-rows="generatedPayload?.generatedTags?.raw || []"
        :first-level-tags="generatedPayload?.generatedTags?.firstLevelTags || []"
        :second-level-tags="generatedPayload?.generatedTags?.secondLevelTags || []"
        :source-table-id="generatedPayload?.tableId || ''"
        :source-table-name="generatedPayload?.table || ''"
        :is-generating="generating"
        :generation-complete="generatedPayload?.generationMeta?.isComplete !== false"
        :completed-chunks="generatedPayload?.generationMeta?.completedChunks || generationProgress.completedChunks"
        :total-chunks="generatedPayload?.generationMeta?.totalChunks || generationProgress.totalChunks"
        :streaming-content="streamingContent"
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

.page-stage {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 10px;
}
</style>
