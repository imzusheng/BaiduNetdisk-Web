import {createApp} from 'vue'
import App from './App.vue'
import ElementPlus from 'element-plus'
import 'element-plus/dist/index.css'
import '@/less/style/index.less'
import router from './router'
import store from './store'

// TODO element-ui 开发差不多之后再换成按需引入

createApp(App).use(store).use(router)
    .use(ElementPlus)
    .mount('#app')
