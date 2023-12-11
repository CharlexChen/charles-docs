import { defaultTheme, defineUserConfig } from 'vuepress'

export default defineUserConfig({
  lang: 'zh-CN',
  title: '你好， 我是程序员陈同学',
  description: '个人技术站点',
  theme: defaultTheme({
    sidebar: [
      {
        text: '个人介绍',
        link: '/intro.md',
      },
      {
        text: 'Vue.js学习系列',
        // link: '/contribution.md',
        children: [
          {
            text: 'Vue3 响应式系统',
            link: '/vue-learning/vue3响应式系统.md',
          },
          {
            text: 'Vue3 响应式系统-进阶',
            link: '/vue-learning/vue3响应式系统-进阶.md',
          },
          {
            text: 'Vue3 编译器',
            link: '/vue-learning/vue3编译器.md',
          },
          {
            text: 'Vue3 渲染器',
            link: '/vue-learning/vue3渲染器.md',
          },
          {
            text: 'Vue3 watch实现原理',
            link: '/vue-learning/vue3之watch实现原理.md',
          },
          {
            text: 'Vue3 Diff算法基础',
            link: '/vue-learning/vue3Diff算法-基础.md',
          },
          {
            text: 'Vue3 Diff算法进阶',
            link: '/vue-learning/vue3Diff算法-进阶.md',
          },
        ],
      },
      {
        text: 'Vite学习系列',
        // link: '/contribution.md',
        children: [
          {
            text: 'Vite 初识',
            link: '/vite-learning/vite-初识.md',
          },
          {
            text: 'Vite 依赖预构建',
            link: '/vite-learning/vite-原来这玩意叫依赖预构建.md',
          },
          {
            text: 'Vite 实现第一个插件',
            link: '/vite-learning/vite-实现第一个插件.md',
          },
          {
            text: 'Vite 插件机制与流水线',
            link: '/vite-learning/vite-插件机制与流水线.md',
          },
          {
            text: 'Vite HMR你好',
            link: '/vite-learning/vite-HMR你好.md',
          },
          {
            text: 'Vite 模块联邦',
            link: '/vite-learning/vite-模块联邦.md',
          },
        ]
      }
    ],
    // 默认主题配置
    navbar: [
      {
        text: '首页',
        link: '/',
      },
    ],
    notFound: ['这里没有内容喔', '内容不见了，晚点再来看看吧']
  }),
})