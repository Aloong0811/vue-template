import { bitable, FieldType } from '@lark-base-open/js-sdk'

const DEFAULT_ERROR_MESSAGE = '当前环境未连接飞书多维表，请在飞书多维表扩展中打开插件进行联调。'
const FIRST_LEVEL_TAG_FIELD_NAME = '一级标签'
const SECOND_LEVEL_TAG_FIELD_NAME = '二级标签'
const TAG_COLOR_IDS = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]

const normalizeBitableError = (error) => {
  const message = error?.message || error?.msg || ''

  if (!message) {
    return new Error(DEFAULT_ERROR_MESSAGE)
  }

  if (message.includes('Host not registered') || message.includes('not registered')) {
    return new Error(DEFAULT_ERROR_MESSAGE)
  }

  return new Error(message)
}

export const getBitableBaseSelection = async () => {
  try {
    return await bitable.base.getSelection()
  } catch (error) {
    throw normalizeBitableError(error)
  }
}

export const getBitableTables = async () => {
  try {
    const tables = await bitable.base.getTableMetaList()

    return tables.map(item => ({
      id: item.id,
      name: item.name,
      isSync: item.isSync
    }))
  } catch (error) {
    throw normalizeBitableError(error)
  }
}

export const getBitableFields = async (tableId) => {
  if (!tableId) {
    return []
  }

  try {
    const table = await bitable.base.getTableById(tableId)
    const fields = await table.getFieldMetaList()

    return fields.map(item => ({
      id: item.id,
      name: item.name,
      type: item.type,
      isPrimary: item.isPrimary
    }))
  } catch (error) {
    throw normalizeBitableError(error)
  }
}

const stringifyCellValue = (value) => {
  if (value == null) {
    return ''
  }

  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    return String(value)
  }

  if (Array.isArray(value)) {
    return value
      .map((item) => stringifyCellValue(item))
      .filter(Boolean)
      .join('；')
  }

  if (typeof value === 'object') {
    if (typeof value.text === 'string') {
      return value.text
    }

    if (typeof value.name === 'string') {
      return value.name
    }

    if (typeof value.link === 'string') {
      return value.link
    }

    if (typeof value.address === 'string') {
      return value.address
    }

    return JSON.stringify(value)
  }

  return ''
}

export const getBitableFieldValues = async ({ tableId, fieldId }) => {
  if (!tableId || !fieldId) {
    return []
  }

  try {
    console.group('[Bitable] getBitableFieldValues')
    console.log('目标 tableId:', tableId)
    console.log('目标 fieldId:', fieldId)

    const table = await bitable.base.getTableById(tableId)
    const field = await table.getFieldById(fieldId)
    const fieldValues = await field.getFieldValueList()

    const normalizedValues = []

    for (const item of fieldValues) {
      if (!item?.record_id) {
        continue
      }

      let text = ''

      try {
        text = await field.getCellString(item.record_id)
      } catch (error) {
        text = stringifyCellValue(item?.value)
      }

      const normalizedText = String(text || '').trim()

      if (!normalizedText) {
        continue
      }

      normalizedValues.push({
        recordId: item.record_id,
        text: normalizedText
      })
    }

    console.log('读取到的列数据条数:', normalizedValues.length)
    console.log('读取到的列数据:', normalizedValues)
    console.groupEnd()

    return normalizedValues
  } catch (error) {
    console.error('[Bitable] 读取字段数据失败:', error)
    console.groupEnd()
    throw normalizeBitableError(error)
  }
}

export const watchBitableSelectionChange = (callback) => {
  try {
    return bitable.base.onSelectionChange((event) => {
      callback(event?.data || null)
    })
  } catch (error) {
    return () => {}
  }
}

const normalizeTagRows = (rows = []) => rows
  .map((item, index) => ({
    id: item?.id || index + 1,
    label1Tag: String(item?.label1Tag || '').trim(),
    label2Tag: String(item?.label2Tag || '').trim()
  }))
  .filter(item => item.label1Tag || item.label2Tag)

const uniqueValues = (values = []) => [...new Set(values.filter(Boolean))]

const buildFlatTagDisplayRows = ({ rows = [], firstLevelTags = [], secondLevelTags = [] } = {}) => {
  const normalizedRows = normalizeTagRows(rows)
  const resolvedFirstLevelTags = uniqueValues(
    (Array.isArray(firstLevelTags) && firstLevelTags.length ? firstLevelTags : normalizedRows.map(item => item.label1Tag))
  )
  const resolvedSecondLevelTags = uniqueValues(
    (Array.isArray(secondLevelTags) && secondLevelTags.length ? secondLevelTags : normalizedRows.map(item => item.label2Tag))
  )
  const rowCount = Math.max(resolvedFirstLevelTags.length, resolvedSecondLevelTags.length)

  return Array.from({ length: rowCount }, (_, index) => ({
    id: index + 1,
    label1Tag: resolvedFirstLevelTags[index] || '',
    label2Tag: resolvedSecondLevelTags[index] || ''
  })).filter(item => item.label1Tag || item.label2Tag)
}

const normalizeFieldType = (fieldType) => String(fieldType || '')

const isSingleSelectFieldType = (fieldType) => {
  const normalizedFieldType = normalizeFieldType(fieldType)
  return normalizedFieldType === String(FieldType.SingleSelect) || normalizedFieldType === 'SingleSelect' || normalizedFieldType === '3'
}

const buildColorSeed = (value = '') => String(value)
  .split('')
  .reduce((sum, char, index) => sum + char.charCodeAt(0) * (index + 1), 0)

const resolveTagColor = (value = '') => TAG_COLOR_IDS[buildColorSeed(value) % TAG_COLOR_IDS.length]

const getOrCreateTagField = async (table, fieldName) => {
  const fieldMetaList = await table.getFieldMetaList()
  const matchedField = fieldMetaList.find(item => item.name === fieldName)

  if (matchedField) {
    return {
      fieldId: matchedField.id,
      fieldType: matchedField.type
    }
  }

  const fieldId = await table.addField({
    name: fieldName,
    type: FieldType.SingleSelect,
    property: {
      options: []
    }
  })

  return {
    fieldId,
    fieldType: FieldType.SingleSelect
  }
}

const ensureSelectFieldOptions = async ({ table, fieldId, fieldType, values = [] }) => {
  if (!fieldId || !isSingleSelectFieldType(fieldType)) {
    return
  }

  const optionValues = uniqueValues(values)

  if (!optionValues.length) {
    return
  }

  const field = await table.getFieldById(fieldId)

  if (typeof field?.getOptions !== 'function') {
    return
  }

  const options = await field.getOptions()
  const existingNames = new Set(options.map(option => option?.name).filter(Boolean))
  const missingOptions = optionValues
    .filter(name => !existingNames.has(name))
    .map(name => ({
      name,
      color: resolveTagColor(name)
    }))

  if (!missingOptions.length) {
    return
  }

  if (typeof field.addOptions === 'function') {
    await field.addOptions(missingOptions)
    return
  }

  if (typeof field.addOption === 'function') {
    for (const option of missingOptions) {
      await field.addOption(option.name, option.color)
    }
  }
}

const ensureTagFields = async (table) => {
  const firstLevelField = await getOrCreateTagField(table, FIRST_LEVEL_TAG_FIELD_NAME)
  const secondLevelField = await getOrCreateTagField(table, SECOND_LEVEL_TAG_FIELD_NAME)

  return {
    firstLevelFieldId: firstLevelField.fieldId,
    secondLevelFieldId: secondLevelField.fieldId,
    firstLevelFieldType: firstLevelField.fieldType,
    secondLevelFieldType: secondLevelField.fieldType
  }
}

const getRecordIdsForOverwrite = async ({ table, tableId }) => {
  const selection = await getBitableBaseSelection().catch(() => null)
  const matchedView = selection?.tableId === tableId && selection?.viewId
    ? await table.getViewById(selection.viewId).catch(() => null)
    : null

  const activeView = matchedView || await table.getActiveView().catch(() => null)

  if (activeView?.getVisibleRecordIdList) {
    const visibleRecordIds = (await activeView.getVisibleRecordIdList()).filter(Boolean)

    if (visibleRecordIds.length) {
      return {
        recordIds: visibleRecordIds,
        viewId: activeView.id || selection?.viewId || null,
        matchedBy: 'visible-order'
      }
    }
  }

  const recordIds = (await table.getRecordIdList()).filter(Boolean)

  if (!recordIds.length) {
    throw new Error('目标数据表暂无可写入的记录')
  }

  return {
    recordIds,
    viewId: activeView?.id || selection?.viewId || null,
    matchedBy: 'table-order'
  }
}

export const writeTagRowsToTable = async ({ tableId, rows = [], firstLevelTags = [], secondLevelTags = [], mode = 'append' }) => {
  if (!tableId) {
    throw new Error('缺少 tableId，无法写入数据表')
  }

  const normalizedRows = normalizeTagRows(rows)
  const rowsToWrite = mode === 'append-deduplicated'
    ? buildFlatTagDisplayRows({
      rows: normalizedRows,
      firstLevelTags,
      secondLevelTags
    })
    : normalizedRows

  if (!rowsToWrite.length) {
    throw new Error('暂无可写入的标签数据')
  }

  try {
    console.group('[Bitable] writeTagRowsToTable')
    console.log('目标 tableId:', tableId)
    console.log('写入模式:', mode)
    console.log('原始标签数据:', normalizedRows)
    console.log('实际写入的标签数据:', rowsToWrite)

    const table = await bitable.base.getTableById(tableId)
    const {
      firstLevelFieldId,
      secondLevelFieldId,
      firstLevelFieldType,
      secondLevelFieldType
    } = await ensureTagFields(table)

    await ensureSelectFieldOptions({
      table,
      fieldId: firstLevelFieldId,
      fieldType: firstLevelFieldType,
      values: rowsToWrite.map(item => item.label1Tag)
    })

    await ensureSelectFieldOptions({
      table,
      fieldId: secondLevelFieldId,
      fieldType: secondLevelFieldType,
      values: rowsToWrite.map(item => item.label2Tag)
    })

    console.log('字段映射:', {
      firstLevelFieldId,
      secondLevelFieldId,
      firstLevelFieldType,
      secondLevelFieldType
    })

    if (mode === 'overwrite-selected') {
      const { recordIds, viewId, matchedBy } = await getRecordIdsForOverwrite({ table, tableId })

      console.log('自动匹配到的 recordIds:', recordIds)
      console.log('匹配方式:', matchedBy)
      console.log('匹配视图 viewId:', viewId)

      if (!recordIds.length) {
        throw new Error('目标数据表暂无可匹配记录，无法执行覆盖写入')
      }

      const writableCount = Math.min(recordIds.length, rowsToWrite.length)
      const matchedRows = rowsToWrite.slice(0, writableCount)

      const recordsToUpdate = matchedRows.map((item, index) => ({
        recordId: recordIds[index],
        fields: {
          [firstLevelFieldId]: item.label1Tag,
          [secondLevelFieldId]: item.label2Tag
        }
      }))

      const result = await table.setRecords(recordsToUpdate)

      console.log('本次实际写入条数:', writableCount)
      console.log('未写入的标签条数:', Math.max(rowsToWrite.length - writableCount, 0))

      console.log('覆盖写入结果 recordIds:', result)
      console.groupEnd()

      return {
        tableId,
        mode,
        recordIds: result,
        matchedRecordIds: recordIds,
        updatedCount: recordsToUpdate.length,
        ignoredMatchedRecordCount: Math.max(recordIds.length - recordsToUpdate.length, 0),
        unwrittenRowCount: Math.max(rowsToWrite.length - writableCount, 0),
        requestedRowCount: rowsToWrite.length,
        matchedBy,
        viewId,
        fieldIds: {
          firstLevelFieldId,
          secondLevelFieldId
        }
      }
    }

    const result = await table.addRecords(rowsToWrite.map(item => ({
      fields: {
        [firstLevelFieldId]: item.label1Tag,
        [secondLevelFieldId]: item.label2Tag
      }
    })))

    console.log('写入结果 recordIds:', result)
    console.groupEnd()

    return {
      tableId,
      mode,
      recordIds: result,
      fieldIds: {
        firstLevelFieldId,
        secondLevelFieldId
      }
    }
  } catch (error) {
    console.error('[Bitable] 写入数据表失败:', error)
    console.groupEnd()
    throw normalizeBitableError(error)
  }
}

export const createTagTable = async ({ name, rows = [], firstLevelTags = [], secondLevelTags = [] }) => {
  const tableName = String(name || '').trim()

  if (!tableName) {
    throw new Error('请输入数据表名称')
  }

  const normalizedRows = normalizeTagRows(rows)

  try {
    console.group('[Bitable] createTagTable')
    console.log('新建数据表名称:', tableName)
    console.log('准备写入的标签数据:', normalizedRows)

    const createResult = await bitable.base.addTable({
      name: tableName,
      fields: [
        {
          name: FIRST_LEVEL_TAG_FIELD_NAME,
          type: FieldType.SingleSelect,
          property: {
            options: []
          }
        },
        {
          name: SECOND_LEVEL_TAG_FIELD_NAME,
          type: FieldType.SingleSelect,
          property: {
            options: []
          }
        }
      ]
    })

    console.log('新建数据表结果:', createResult)

    if (normalizedRows.length) {
      await writeTagRowsToTable({
        tableId: createResult.tableId,
        rows: normalizedRows,
        firstLevelTags,
        secondLevelTags,
        mode: 'append-deduplicated'
      })
    }

    console.groupEnd()

    return createResult
  } catch (error) {
    console.error('[Bitable] 创建标签数据表失败:', error)
    console.groupEnd()
    throw normalizeBitableError(error)
  }
}