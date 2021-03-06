<!--
  主内容面板
  表格显示文件信息等...
-->

<template>
  <!-- 主内容 s  -->
  <el-main>
    <!--  功能按钮 s  -->
    <div class="home-main-tools">
      <!--  功能按钮 s  -->
      <div class="home-main-btn">
        <el-button-group style="margin-right: 12px; display: none" v-if="!$router.currentRoute.value.query?.category">
          <el-button type="primary" :icon="Share" round @click="upload"><b>上传</b></el-button>
          <el-button type="primary" :icon="Share" plain round @click="mkdir"><b>新建文件夹</b></el-button>
        </el-button-group>
        <el-button-group>
          <el-button type="primary" :icon="Share" plain round @click="toolsShare"
                     :disabled="rowSelection.length === 0"><b>分享</b></el-button>
          <el-button type="primary" :icon="Download" plain round @click="toolsDownload"
                     :disabled="rowSelection.length === 0"><b>下载</b></el-button>
          <el-button type="primary" :icon="Delete" color="rgba(254, 46, 57, .75)" round @click="toolsDelete"
                     :disabled="rowSelection.length === 0"><b>删除</b>
          </el-button>
        </el-button-group>
        <!--  切换显示模式按钮 s  -->
        <div class="displayModeBtn" title="切换显示模式" @click="displayModeBtn = !displayModeBtn">
          <list v-if="!displayModeBtn"/>
          <grid v-else/>
        </div>
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

    <!-- 文件列表 列表模式 s -->
    <el-table
        v-if="displayModeBtn"
        :data="tableData"
        :class="'home-main-table'"
        ref="multipleTableRef"
        style="width: 100%"
        @selection-change="handleSelectionChange"
        @cell-click="cellClick"
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
                <div class="home-main-filename">
                  {{ scope.row.server_filename }}
                </div>
                <div class="home-filename-operate">
                  <download style="width: 18px; height: 18px; cursor: pointer" @click="doDownloadOne(scope.row)"/>
                  <delete style="width: 18px; height: 18px; cursor: pointer" @click="doDeleteOne(scope.row)"/>
                </div>
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

    <!-- 文件夹列表 图标模式 s  -->
    <div class="home-main-list" v-else>
      <ul v-if="tableData.length > 0">
        <li
            class="list-item"
            :title="listItem.server_filename"
            v-for="(listItem, listIndex) in tableData"
            :key="'list' + listIndex"
            @click="iconClick(listItem)">
          <img v-if="listItem.isdir === 1"
               src="http://cdn.zusheng.club/icon/文件夹.svg"
               alt="icon">
          <img v-else-if="listItem.server_filename"
               :src="iconPath(util.getFileIcon(listItem.server_filename))"
               alt="icon">
          <div class="list-item-name">{{ listItem.server_filename }}</div>
        </li>
      </ul>
      <div v-else
           style="width: 100%; height: 100%; display: flex; align-items: center; justify-content: center; color: #999">
        空目录
      </div>
    </div>

  </el-main>
</template>

<script setup>

import {useStore} from 'vuex'
import {api, util} from '@/util'
import {useRouter} from 'vue-router'
import {computed, onMounted, reactive, ref, toRaw} from 'vue'
import {Share, Download, Delete, Grid, List} from '@element-plus/icons-vue'
import {ElLoading, ElMessage, ElMessageBox} from 'element-plus'

const store = useStore()
const router = useRouter()

// 表格ref
const multipleTableRef = ref(null)
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
// 切换显示模式
const displayModeBtn = ref(true)

// 多选回调
const handleSelectionChange = e => {
  const rawData = e.map(v => toRaw(v))
  rowSelection.length = 0
  rowSelection.push(...rawData)
}

// 分享
const toolsShare = () => ElMessage({
  message: '暂未开放该功能',
  type: 'warning',
  grouping: true
})

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
  // 是文件夹所以需要遍历子目录文件
  const taskList = isDirPath.map(path => { // 创建Promise队列的参数
    // 递归所有文件夹中的子文件并获取文件信息
    const cb = () => store.dispatch('getMultiFileList', path)
    // cb是需要执行的任务, index是任务的标记 正常来说是按顺序执行
    return {
      cb,
      index: path
    }
  })
  // 执行请求队列
  const promiseQueue = new util.PromiseQueue(taskList, 100)
  // 获取请求的所有结果
  promiseQueue.getResult().then(res => {
    // res为所有文件信息，包括文件夹。 需要过滤出文件夹，因为文件夹不包含dlink不能直接下载
    let files = []
    // 将不同请求的结果合并成一个数组，保存在files[]
    Object.values(res).forEach(v => {
      if (v?.list) files.push(...v?.list)
    })
    files = files.filter(v => v.isdir === 0)
    loadingInstance.close() // 关闭全屏动画
    ElMessageBox.confirm(
        `
        <p>确定要下载这${files.length + notDir.length}个文件或文件夹吗?</p>
        <p><small style="color: #999">${files.length > 500 ? '(文件数大于500.也不是说我不行,但建议用客户端下载.)' : ''}</small></p>
        `,
        '提示',
        {
          dangerouslyUseHTMLString: true,
          confirmButtonText: '确定',
          cancelButtonText: '取消',
          type: 'warning',
        })
        .then(() => {
          // 将结果中的fsid提取出来
          const fsids = files.map(v => v.fs_id)
          const notDirFsids = notDir.map(v => v.fs_id)
          fsids.push(...notDirFsids)
          doDownload(fsids)
        })
        .catch(() => {
        })
  })
}

// 处理批量下载 toolsDownload 拆分
function doDownload(fsids) {
  const loadingInstance = ElLoading.service({
    fullscreen: true,
    text: '正在添加任务到下载列表...'
  })
  // 将大于100个元素的数组拆分成100个元素组成的小数组
  const fsidsQueue = new Array(Math.ceil(fsids.length / 100)) // 创建一个数组,下标是fsids切割的次数(除以100向上取整)
      .fill('') // 填充为空值
      .map((value, index) => { // 循环次数就是切割的次数
        const start = (index * 100) // 起始点
        const end = (index * 100) + 100 // 结束点
        return fsids.slice(start, end)
      })

  // 创建任务队列参数
  const taskList = fsidsQueue.map((fsidsItems, index) => {
    const cb = () => {
      return new Promise(resolve => {
        store.dispatch('getFileMeta', fsidsItems).then(res => {
          if (res?.list instanceof Array) {
            // 添加任务
            store.dispatch('postRecordTasks', res?.list).then(tasksJson => {
              store.commit('setUndoneList', tasksJson)
              resolve()
            })
          }
        })
      })
    }
    return {
      cb,
      index
    }
  })
  // 传入任务队列参数,请求执行间隔的时间为0(其实并发都可以吧)
  const promiseQueue = new util.PromiseQueue(taskList, 0)
  promiseQueue.getResult().then(() => {
    loadingInstance.close()
    ElMessage.success('已添加任务到下载列表')
    api.wsStartDownload()
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

// 点击了单元格
const cellClick = (rowProxy, column, cell, event) => {
  const row = toRaw(rowProxy)
  if (Array.from(event.target.classList).includes('home-main-filename')) { // 点击了文件名
    if (row.isdir === 1) { // 是文件夹
      clearData()
      store.state.fileListLoading = true
      router.push({
        query: {path: encodeURIComponent(row.path)}
      })
    } else if (row.category.toString() === '1') {
      let routeData = router.resolve({
        path: '/player',
        query: {
          videoName: row.server_filename,
          videoPoster: encodeURIComponent(row.thumbs.url3),
          videoPath: encodeURIComponent(row.path)
        }
      })
      window.open(routeData.href, '_blank')
    } else { // 点击是文件
      doDownloadOne(rowProxy)
    }
  } else if ( // 这个判断真的很没办法，不优雅
      event.target.tagName.toLowerCase() !== 'path' &&
      (Array.from(event.target.classList).length === 0 || Array.from(event.target.classList).includes('cell'))
  ) { // 点击了其他位置，则切换选中状态
    multipleTableRef.value.toggleRowSelection(row, undefined) // 若设置true/false则直接设置选中状态
  }
}

// 图标模式下点击
const iconClick = (rowProxy) => {
  const row = toRaw(rowProxy)
  if (row.isdir === 1) { // 是文件夹
    clearData()
    store.state.fileListLoading = true
    router.push({
      query: {path: encodeURIComponent(row.path)}
    })
  } else if (row.category.toString() === '1') {
    let routeData = router.resolve({
      path: '/player',
      query: {
        videoName: row.server_filename,
        videoPoster: encodeURIComponent(row.thumbs.url3),
        videoPath: encodeURIComponent(row.path)
      }
    })
    window.open(routeData.href, '_blank')
  } else { // 点击是文件
    doDownloadOne(rowProxy)
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
        path: encodeURIComponent(`${breadcrumb.value.slice(0, index + 1).join('/').replace('全部文件', '')}` || '/')
      }
    })
  }
  store.commit('setBreadcrumb')
}

// 下载一个文件
const doDownloadOne = async fileInfo => {
  const rawFileInfo = toRaw(fileInfo)
  let fsids = []
  if (rawFileInfo.isdir === 1) { // 选中的是文件夹,需要遍历子目录
    // 全屏加载动画
    const loadingInstance = ElLoading.service({
      fullscreen: true,
      text: '正在整理文件信息...'
    })
    const res = await store.dispatch('getMultiFileList', rawFileInfo.path)
    fsids = res.list.map(v => v.fs_id)
    loadingInstance.close()
  } else { // 选中的是文件
    fsids.push(rawFileInfo.fs_id)
  }
  ElMessageBox.confirm(
      `
        <p>确定要下载这${fsids.length}个文件或文件夹吗?</p>
        <p><small style="color: #999">${fsids.length > 500 ? '(文件数大于500.也不是说我不行,但建议用客户端下载.)' : ''}</small></p>
        `,
      '提示',
      {
        dangerouslyUseHTMLString: true,
        confirmButtonText: '确定',
        cancelButtonText: '取消',
        type: 'warning',
      })
      .then(() => {
        // 将结果中的fsid提取出来
        doDownload(fsids)
      })
      .catch(() => {
      })
}

// 删除一个文件
const doDeleteOne = fileInfo => {
  ElMessageBox.confirm(
      `确定要删除这1个文件或文件夹吗?`,
      '提示',
      {
        confirmButtonText: '确定',
        cancelButtonText: '取消',
        type: 'warning',
      })
      .then(() => {
        store.dispatch('postFileManager', {
          opera: 'delete',
          filelist: [fileInfo.path]
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

// 上传文件
const upload = () => ElMessage({
  message: '暂未开放该功能',
  type: 'warning',
  grouping: true
})

// 新建文件夹
const mkdir = () => ElMessage({
  message: '暂未开放该功能',
  type: 'warning',
  grouping: true
})

// 更新面包屑
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

      // 功能按钮
      .home-main-tools {
        width: 100%;

        .home-main-btn {
          margin-bottom: 10px;
          display: flex;
          justify-content: space-between;

          // 功能按钮
          .el-button-group {
          }

          // 排序方式按钮
          .displayModeBtn {
            cursor: pointer;

            > svg {
              height: 32px;
              width: 32px;
              color: rgba(120, 120, 120, 1);
            }
          }

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
        flex: 1;

        .el-table__inner-wrapper {
          height: 100%;
          display: flex;
          flex-direction: column;

          .el-table__body-wrapper {
            height: 100%;
            overflow-y: auto;

            .el-table__row {
              > .el-table__cell:nth-of-type(2) {
                cursor: pointer !important; // 文件名那列
              }

              &:hover {
                .home-filename-operate {
                  background: #f5f7fa !important;
                  visibility: visible !important;
                }
              }
            }

            .el-table__cell {
              transition: none !important;
              color: #999;

              .cell {
                > span {
                  display: flex;
                  align-items: center;
                  position: relative;
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
                    color: #409eff !important;
                  }
                }

                .home-filename-operate {
                  background: #fff;
                  transform: translate(0, -50%);
                  position: absolute;
                  z-index: 4;
                  right: 0;
                  top: 50%;
                  display: flex;
                  justify-content: flex-end;
                  align-items: center;
                  visibility: hidden;

                  svg {
                    margin-left: 12px;

                    &:hover {
                      color: #409eff;;
                    }
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

      // 无序列表
      .home-main-list {
        flex: 1;

        ul {
          width: 100%;
          display: grid;
          grid-template-columns: repeat(10, 10%);
          grid-row-gap: 12px;

          > li {
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: space-between;
            padding: 20px 10px;
            border-radius: 8px;
            cursor: pointer;

            &:hover {
              background: rgba(200, 200, 200, .2);
            }

            img {
              height: 50px;
              width: 50px;
            }

            .list-item-name {
              width: 100%;
              text-align: center;
              margin-top: 8px;
              font-size: 12px;
              color: rgba(100, 100, 100, 1);
              display: block;
              white-space: nowrap;
              text-overflow: ellipsis;
              overflow: hidden;
            }
          }
        }
      }
    }
  }
}
</style>
