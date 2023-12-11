import { defineClientConfig } from '@vuepress/client'
import Footer from './components/Footer.vue'

export default defineClientConfig({
  enhance({ app, router, siteData }) {},
  setup() {},
  rootComponents: [Footer],
  // layouts: {
  //   Layout,
  // },
})