import {createApp} from 'vue'
import App from './App.vue'
import ElementPlus from 'element-plus'
import 'element-plus/dist/index.css'
import '@/less/style/index.less'
import {store} from './store'
import router from './router'
import vodeojs from '@/plugins/video'

// TODO element-ui 开发差不多之后再换成按需引入

createApp(App)
    .use(ElementPlus)
    .use(store)
    .use(router)
    .use(vodeojs)
    .mount('#app')
