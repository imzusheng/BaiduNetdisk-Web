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
      // 文件分类页面,页面都是HomeView
      ...['imagelist', 'videolist', 'doclist', 'btlist'].map(path => {
        return {
          path: `/${path}`,
          name: path,
          component: () => import(/* webpackChunkName: "home" */ '../views/HomeOverview.vue'),
          meta: {
            keepalive: true
          }
        }
      }),
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
      },
      {
        path: '/player',
        name: 'FilePlayer',
        component: () => import(/* webpackChunkName: "home" */ '../views/FilePlayer.vue'),
        meta: {
          keepalive: true
        }
      }
    ]
  },
  {
    // 匹配所有路径  vue2使用*
    // vue3使用/:pathMatch(.*)*或/:pathMatch(.*)或/:catchAll(.*)
    path: '/:pathMatch(.*)',
    redirect: '/overview'
  }
]

const router = createRouter({
  history: createWebHistory(),
  routes
})

router.beforeEach((to, from, next) => {
  if (to.name === 'HomeOverview' || (to.name === 'HomeOverview' && !from.name)) { // 当在HomeOverview页面内操作路由时
    // 不存在path参数时默认加上path='/'
    if (!to.query?.path) next({
      name: to.name,
      query: {
        path: encodeURIComponent('/')
      }
    })
    // 清空表单数据
    store.state.fileList = [{}, {}, {}]
    // 从url中提取路径
    const rawPath = decodeURIComponent(to.query.path.toString())
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
  } else if (['imagelist', 'videolist', 'doclist', 'btlist'].includes(to.name.toLowerCase())) { // 进入文件分类界面
    // 清空表单数据
    store.state.fileList = [{}, {}, {}]
    store.dispatch('getFileCategory', {
      category: to.name.toLowerCase()
    })
    store.state.fileListLoading = true
  }
  next()
})

export default router
