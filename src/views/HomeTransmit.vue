<!--
  文件传输页面
-->

<template>
  <!-- 主内容 s  -->
  <el-main>

    <!--  工具栏 s  -->
    <div class="home-transmit-tools">
      <!--  下拉菜单 s  -->
      <div style="display: flex; justify-content: center; align-items: center">
        <el-button-group>
          <el-button type="default" :icon="FolderOpened" @click="api.openExplorer('')">打开文件夹</el-button>
          <el-button type="default" :icon="RefreshLeft" @click="store.dispatch('getLocalFiles')">刷新</el-button>
        </el-button-group>
        <el-button style="margin-left: 8px" type="danger" :icon="FolderDelete" v-if="deleteBtn" @click="deleteFiles">
          删除文件
        </el-button>
      </div>
      <!-- 提示文本 s -->
      <div style="font-size: 14px; padding: 12px; color: rgb(96, 98, 102); display: flex; align-items: center">
        <info-filled style="width: 16px; height: 16px; cursor: pointer; color: rgba(255,186,21,1); margin-right: 6px;"/>
        双击文件名可以打开文件所在文件夹（windows）
      </div>
    </div>

    <!-- 文件列表 s -->
    <el-table
        :class="'home-transmit-table'"
        ref="multipleTableRef"
        :data="listLocalFiles"
        style="width: 100%"
        @selection-change="handleSelectionChange"
        empty-text="空目录"
    >
      <!-- 多选框 s -->
      <el-table-column type="selection" width="55"/>
      <!-- 文件名 s -->
      <el-table-column property="rawFilename" label="文件名" min-width="200" sortable>
        <template #default="scope">
          <span @dblclick="dblclick(scope.row.path)">
                <img
                    :src="`http://cdn.zusheng.club/icon/${util.getFileIcon(scope.row.filename)}`"
                    class="table-file-icon"
                    alt="icon">
                <div class="home-main-filename user-select-not">{{ scope.row?.filename }}</div>
              </span>
        </template>
      </el-table-column>
      <!-- 修改日期 s -->
      <el-table-column property="birthtimeMs" label="修改日期" width="180px" sortable>
        <template #default="scope">
          <span>{{ util.formatDate(parseInt(scope.row.birthtimeMs)) }}</span>
        </template>
      </el-table-column>
      <!-- 类型 s -->
      <el-table-column property="rawFilename" label="类型" width="120px" sortable>
        <template #default="scope">
          <!-- 在未完成项目的一个td单元格中添加了一个span标记，通过他找到父级tr元素 -->
          <span :ref="setNotDownload" v-if="scope.row?.status === 'download'"></span>
          <span :ref="removeNotDownload" v-if="scope.row?.status !== 'download'"></span>
          <span>{{ util.getFileExt(scope.row.filename) }}</span>
        </template>
      </el-table-column>
      <!-- 大小 s -->
      <el-table-column property="size" label="大小" sortable>
        <template #default="scope">{{ util.formatFileSize(scope.row.size) }}</template>
      </el-table-column>
    </el-table>


    <!-- 提示文本 s -->
    <div
        style="font-size: 14px; padding: 12px 0 0 ; color: rgb(96, 98, 102); display: flex; align-items: center; justify-content: center">
      <span
          style="height: 18px; width: 36px; background: rgba(236, 200, 126, 0.4); border-radius: 4px; margin-right: 12px"></span>
      未下载完成的文件
    </div>
  </el-main>
  <!-- 主内容 e  -->
</template>

<script setup>
import {api, util} from "@/util"
import {computed, nextTick, reactive, ref, toRaw} from "vue"
import {InfoFilled, FolderOpened, FolderDelete, RefreshLeft} from '@element-plus/icons-vue'
import {ElMessage} from "element-plus"
import {useStore} from "vuex"

const store = useStore()
const deleteBtn = ref(false)
const selectFiles = reactive([])

// 在未完成项目的一个td单元格中添加了一个span标记，通过他找到父级tr元素, element-ui中无法直接给表格行添加class
const setNotDownload = async el => {
  /**
   * nextTick
   * https://vue3js.cn/global/nextTick.html
   * 定义: 在下次 DOM 更新循环结束之后执行延迟回调。在修改数据之后立即使用这个方法，获取更新后的 DOM
   * nextTick 是 vue 中的更新策略，也是性能优化手段，基于JS执行机制实现
   * vue 中我们改变数据时不会立即触发视图，如果需要实时获取到最新的DOM，这个时候可以手动调用 nextTick
   */
  // 执行nextTick()前 el.parentElement?.parentElement?.parentElement = undefined
  await nextTick()
  // 执行nextTick()后 el.parentElement?.parentElement?.parentElement = ...
  if (!el?.parentElement?.parentElement?.parentElement) return
  const tableRow = el?.parentElement?.parentElement?.parentElement
  const classList = [...tableRow.classList]
  if (!classList.includes('notDownload')) tableRow.classList.add('notDownload')
}

// 下载完成,删除标记
const removeNotDownload = async el => {
  await nextTick()
  if (!el?.parentElement?.parentElement?.parentElement) return
  const tableRow = el?.parentElement?.parentElement?.parentElement
  const classList = [...tableRow.classList]
  if (classList.includes('notDownload')) tableRow.classList.remove('notDownload')
}

// 表格数据
const listLocalFiles = computed(() => {
  // 取下载列表的文件路径(不会重复)
  const args = Object.values(store.state.download).map(v => v.path)
  // map让未下载完成的项目变个颜色
  return store.state.listLocalFiles.map(v => {
    const relativePath = v.relativePath.replace(/\\/g, '/')
    if (args.includes(relativePath)) {
      v.status = 'download'
    } else {
      v.status = 'done'
    }
    return v
  })
  // filter直接不显示未下载完成的任务
  // return store.state.listLocalFiles.filter(v => {
  //   return !args.includes(v.fsid)
  // })
})

// 选中文件
const handleSelectionChange = e => {
  const data = toRaw(e)
  deleteBtn.value = data.length > 0
  selectFiles.length = 0
  Object.assign(selectFiles, data)
}

// 删除下载文件夹中的文件
const deleteFiles = () => {
  // 取文件根路径
  const filePathList = toRaw(selectFiles).map(v => v.path)
  // 删除文件,删除完成后重新获取目录
  store.dispatch('deleteFiles', filePathList).then(() => {
    store.dispatch('getLocalFiles') // 删除完成后刷新本地文件列表
  })
}

// 双击打开文件夹
const dblclick = path => {
  api.openExplorer(path, false)
  ElMessage({
    message: '正在打开文件夹，请稍后..',
    type: 'success',
  })
}

</script>

<style lang="less">
// 主要内容
.el-main {
  height: calc(100vh - 60px);
  display: flex;
  flex-direction: column;

  .home-transmit-tools {
    display: flex;
    align-items: center;
    justify-content: space-between;
  }

  // 表格
  .home-transmit-table {
    cursor: pointer;
    flex: 1;

    .el-table__inner-wrapper {
      height: 100%;

      .el-table__body-wrapper {
        height: 100%;
        overflow-y: auto;

        // 未下载完成的颜色
        .notDownload {
          background: rgba(236, 200, 126, 0.4);
        }

        .el-table__cell {
          color: #999;

          .cell {
            > span {
              display: flex;
              align-items: center;
            }

            // 文件图标
            .table-file-icon {
              width: 16px;
              height: 16px;
              margin-right: 6px;
            }

            // 表格名字列
            .home-main-filename {
              display: -webkit-box;
              overflow: hidden;
              text-overflow: ellipsis;
              -webkit-box-orient: vertical;
              -webkit-line-clamp: 1;
              color: #141414;

              &:hover {
                color: #409eff;
              }
            }
          }
        }

        // 表格无数据时
        .el-table__empty-text {
          display: flex;
          justify-content: center;
          align-items: center;
        }
      }
    }
  }
}
</style>
