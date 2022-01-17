<!--
  主内容面板
  表格显示文件信息等...
-->

<template>
  <!-- 主内容 s  -->
  <el-main>
    <div class="home-main-tools">
      <!--  功能按钮 s  -->
      <div class="home-main-btn">
        <el-button-group>
          <el-button type="primary" :icon="Share" round><b>上传</b></el-button>
          <el-button type="primary" :icon="Share" plain round><b>新建文件夹</b></el-button>
        </el-button-group>
        <el-button-group v-if="rowSelection.length > 0" style="margin-left: 12px">
          <el-button type="primary" :icon="Share" plain round @click="toolsShare"><b>分享</b></el-button>
          <el-button type="primary" :icon="Download" plain round @click="toolsDownload"><b>下载</b></el-button>
          <el-button type="primary" :icon="Delete" color="rgba(254, 46, 57, .75)" round @click="toolsDelete"><b>删除</b>
          </el-button>
        </el-button-group>
      </div>
      <!--   面包屑 s     -->
      <el-breadcrumb separator="/" :class="'home-main-breadcrumb'" :id="'homeBreadcrumb'">
        <el-breadcrumb-item v-for="(item, key) in breadcrumb" :key="key" @click="updateBreadcrumb(key)">
          <span>{{
              (breadcrumb.length > 3 || store.state.breadcrumbExceed) && key > 0 ? util.textClip(item, 6) : item
            }}</span>
        </el-breadcrumb-item>
      </el-breadcrumb>
    </div>

    <!-- 文件列表 s -->
    <el-table
        :data="tableData"
        :class="'home-main-table'"
        ref="multipleTableRef"
        style="width: 100%"
        @selection-change="handleSelectionChange"
        @row-click="rowClick"
        empty-text="空目录"
    >
      <!-- 多选框 s -->
      <el-table-column type="selection" width="55"/>
      <!-- 文件名 s -->
      <el-table-column property="server_filename" label="文件名" min-width="200" sortable>
        <template #default="scope">
          <el-skeleton :rows="0" animated v-if="tableLoading"/>
          <span v-else>
                <img v-if="scope.row.isdir === 1"
                     src="http://cdn.zusheng.club/icon/文件夹.svg"
                     class="table-file-icon"
                     alt="icon">
                <img v-else
                     :src="iconPath(util.getFileIcon(scope.row.server_filename))"
                     class="table-file-icon"
                     alt="icon">
                <div class="home-main-filename">{{ scope.row.server_filename }}</div>
              </span>
        </template>
      </el-table-column>
      <!-- 修改日期 s -->
      <el-table-column property="server_mtime" label="修改日期" width="180px" sortable>
        <template #default="scope">
          <el-skeleton :rows="0" animated v-if="tableLoading"/>
          <span v-else>{{ util.formatDate(scope.row.server_mtime * 1000) }}</span>
        </template>
      </el-table-column>
      <!-- 类型 s -->
      <el-table-column property="isdir" label="类型" width="120px" sortable>
        <template #default="scope">
          <el-skeleton :rows="0" animated v-if="tableLoading"/>
          <span v-else>
            {{ scope.row.isdir === 1 ? '目录' : '' }}
            <span v-if="scope.row.isdir !== 1">{{ util.getFileExt(scope.row.server_filename) }}</span>
          </span>
        </template>
      </el-table-column>
      <!-- 大小 s -->
      <el-table-column property="size" label="大小" sortable>
        <template #default="scope">{{ util.formatFileSize(scope.row.size) }}</template>
      </el-table-column>
    </el-table>
  </el-main>
  <!-- 主内容 e  -->
</template>

<script setup>

import {useStore} from 'vuex'
import {api, util} from '@/util'
import {useRouter} from 'vue-router'
import {computed, onMounted, reactive, toRaw} from 'vue'
import {Share, Download, Delete} from '@element-plus/icons-vue'
import {ElLoading, ElMessage, ElMessageBox} from 'element-plus'
import resJson from '@/assets/json/res.json'

const store = useStore()
const router = useRouter()
// icon路径
const iconPath = computed(() => {
  return function (url) {
    return require('@/assets/img/' + url)
  }
})
// 表格信息
const tableData = computed(() => store.state.fileList)
// 表格加载
const tableLoading = computed(() => store.state.fileListLoading)
// 面包屑
const breadcrumb = computed(() => {
  if (store.state.breadcrumbExceed) {
    const staticData = toRaw(store.state.fileListBreadcrumb)
    return [staticData[0], '...', staticData[staticData.length - 1]]
  } else {
    return store.state.fileListBreadcrumb
  }
})
// 多选数据
const rowSelection = reactive([])
// 多选回调
const handleSelectionChange = e => {
  const rawData = e.map(v => toRaw(v))
  rowSelection.length = 0
  rowSelection.push(...rawData)
}
// 分享
const toolsShare = () => ElMessage.warning('暂未开放分享功能')
// 删除文件
const toolsDelete = () => {
  const rawData = toRaw(rowSelection)
  ElMessageBox.confirm(
      `确定要删除这${rawData.length}个文件或文件夹吗?`,
      '提示',
      {
        confirmButtonText: '确定',
        cancelButtonText: '取消',
        type: 'warning',
      })
      .then(() => {
        store.dispatch('postFileManager', {
          opera: 'delete',
          filelist: rawData.map(v => v.path)
        }).then(res => {
          if (res.error) {
            ElMessage.error('删除失败')
          } else {
            ElMessage.success('删除成功')
          }
          store.dispatch('getFilesList')
        })
      })
}
// 批量下载
const toolsDownload = async () => {
  // 全屏加载动画
  const loadingInstance = ElLoading.service({
    fullscreen: true,
    text: '正在整理文件信息...'
  })
  const rawData = toRaw(rowSelection)
  const isDir = []       // 选中的文件夹
  const isDirPath = []   // 选中文件夹的路径
  const notDir = []      // 选中的非文件夹
  rawData.forEach(v => {
    if (v.isdir === 1) { // 1为文件夹
      isDir.push(v)
      isDirPath.push(v.path)
    } else {             // 0为文件
      notDir.push(v)
    }
  })
  const taskList = isDirPath.map(path => { // 创建Promise队列的参数
    // 递归所有文件夹中的子文件并获取文件信息
    const cb = () => store.dispatch('getMultiFileList', path)
    // cb是需要执行的任务, index是任务的标记 正常来说是按顺序执行
    return {
      cb,
      index: path
    }
  })
  const promiseQueue = new util.PromiseQueue(taskList, 100)
  promiseQueue.getResult().then(res => {
    loadingInstance.close() // 关闭全屏动画
    const sum = Object.values(res).reduce((a, b) => a?.cursor ? a.cursor + b.cursor : a + b.cursor, 0) // 总文件数量
    ElMessageBox.confirm(
        `确定要下载这${sum}个文件或文件夹吗?`,
        '提示',
        {
          confirmButtonText: '确定',
          cancelButtonText: '取消',
          type: 'warning',
        })
        .then(() => {
          // 收集fsids准备下载
          const files = []
          // 将不同请求的结果合并成一个数组，保存在files[]
          Object.values(res).forEach(v => {
            if (v?.list) files.push(...v?.list)
          })
          // 将结果中的fsid提取出来
          const fsids = files.map(v => v.fs_id)
          download(fsids)
        })
        .catch(() => {
          console.log('关闭')
        })
  })
}

console.log(resJson)

store.dispatch('postRecordTasks', resJson.list)

function download(fsids) {
  store.dispatch('getFileMeta', fsids).then(res => {
    console.log(res)
  })
}

// 清空响应式数据
const clearData = () => {
  // 空目录返回时，length为0导致没有加载动画，重新赋值为3
  const length = tableData.value.length === 0 ? 3 : tableData.value.length
  tableData.value.length = 0
  // 填充数组， 快速创建数组
  tableData.value.push(...new Array(length).fill({}))
}

// 表格行被点击
const rowClick = e => {
  const rowData = toRaw(e)
  // 是否是文件夹 1 是, 0 否
  const isDir = rowData.isdir
  if (isDir === 1) {
    clearData()
    // 加载状态
    store.state.fileListLoading = true
    router.push({
      query: {
        path: encodeURIComponent(rowData.path)
      }
    })
  } else {
    // 下载文件 TODO 有时候会下载一个无名文件d，很奇怪 有时间给服务器搞个日志好了
    const filenameList = Object.values(toRaw(store.state.download)).map(v => v.filename)
    const existsFileList = [...toRaw(store.state.listLocalFiles).map(v => v.rawFilename)]
    if (filenameList.length > 3) {
      return ElMessage({
        type: 'info',
        message: '当前任务数大于3，再等等'
      })
    } else if (existsFileList.includes(rowData.server_filename)) {
      return ElMessage({
        type: 'info',
        message: '请勿重复下载'
      })
    }
    ElMessage({
      type: 'info',
      message: '正在加入下载队列...'
    })
    api.getFileMeta([rowData.fs_id]).then(res => {
      api.getDownload(res.list[0].dlink, res.list[0].filename, rowData.fs_id)
    })
  }
}

// 更新面包屑
const updateBreadcrumb = index => {
  // 返回上级目录
  if (breadcrumb.value[index] === '...') {
    router.push({
      query: {
        path: encodeURIComponent(`${store.state.fileListBreadcrumb.slice(0, store.state.fileListBreadcrumb.length - 1).join('/').replace('全部文件', '')}`) || '/'
      }
    })
  } else { // 确保不是自己点自己，以及不是在根目录点击根目录的状态下
    router.push({
      query: {
        path: encodeURIComponent(`${breadcrumb.value.slice(0, index + 1).join('/').replace('全部文件', '')}`) || '/'
      }
    })
  }
  store.commit('setBreadcrumb')
}

onMounted(() => {
  store.commit('setBreadcrumb')
})

</script>

<style lang="less">
#HomeOverview {
  width: 100%;
  height: 100vh;

  .el-container {

    // 主要内容
    .el-main {
      height: calc(100vh - 60px);
      display: flex;
      flex-direction: column;

      .home-main-tools {
        width: 100%;

        // 功能按钮
        .el-button-group {
          margin-bottom: 10px;
        }

        // 面包屑
        .home-main-breadcrumb {
          padding: 8px 12px 0;

          .el-breadcrumb__item {
            margin-bottom: 12px;

            &:not(:last-child) {
              .el-breadcrumb__inner {
                cursor: pointer;
                color: #409eff;
              }
            }
          }
        }
      }

      // 表格
      .home-main-table {
        cursor: pointer;
        flex: 1;

        .el-table__inner-wrapper {
          height: 100%;
          display: flex;
          flex-direction: column;

          .el-table__body-wrapper {
            height: 100%;
            overflow-y: auto;

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
  }
}
</style>
