import {createRouter, createWebHistory} from 'vue-router'

import {store} from '@/util'

const routes = [
  {
    path: '/',
    redirect: '/overview'
  },
  {
    path: '/',
    component: () => import(/* webpackChunkName: "home" */ '../views/LayoutDefault.vue'),
    children: [
      {
        path: '/overview',
        name: 'HomeOverview',
        component: () => import(/* webpackChunkName: "home" */ '../views/HomeOverview.vue'),
        meta: {
          keepalive: true
        }
      },
      {
        path: '/download',
        name: 'HomeDownload',
        component: () => import(/* webpackChunkName: "home" */ '../views/HomeDownload.vue'),
        meta: {
          keepalive: true
        }
      },
      {
        path: '/transmit',
        name: 'HomeTransmit',
        component: () => import(/* webpackChunkName: "home" */ '../views/HomeTransmit.vue'),
        meta: {
          keepalive: true
        }
      }
    ]
  }
]

const router = createRouter({
  history: createWebHistory(),
  routes
})

router.beforeEach((to, from, next) => {
  if (to.name === 'HomeOverview' && from.name === 'HomeOverview' || !from.name) { // 当在HomeOverview页面内操作路由时
    // 清空表单数据
    store.state.fileList = [{}, {}, {}]
    // 从url中提取路径
    const rawPath = to.query?.path ? decodeURIComponent(to.query.path.toString()) : '/'
    // 用路径获取文件列表
    store.dispatch('getFilesList', rawPath)
    // 处理路径，切割成数组并更新面包屑
    store.state.fileListBreadcrumb = rawPath.replace(/^\//g, '').split('/')
    // 面包屑首项始终是'全部文件'
    store.state.fileListBreadcrumb.unshift('全部文件')
    // 检测面包屑长度是否超标
    store.commit('setBreadcrumb')
    // 加载状态
    store.state.fileListLoading = true
    next()
  } else if (to.name === 'HomeOverview' && from.name !== 'HomeOverview' && !to.query?.path) { // 当从其他页面来到HomeOverview时，重新把path信息写到url(为了看起来正常)
    // 以下这段代码删掉对运行无影响，只是为了url看起来不让人感觉奇怪
    // 从面包屑信息中重新提取路径信息
    const path = store.state.fileListBreadcrumb.join('/').replaceAll('全部文件', '')
    const pathEncode = encodeURIComponent(path)
    next({
      name: 'HomeOverview',
      query: {path: pathEncode}
    })
  } else {
    next()
  }
})

export default router
