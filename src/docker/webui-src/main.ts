import { createApp } from 'vue'
import App from './App.vue'
import { installLegacyRequestBridge } from './request'
import { installLegacySystemResourceBridge } from './resources'

import '../webui/styles.css'
import '../webui/styles-components.css'
import '../webui/styles-tables.css'
import '../webui/styles-responsive.css'

async function bootstrapLegacyBehavior(): Promise<void> {
  await import('../webui/app-data.js')
  installLegacySystemResourceBridge()
  await import('../webui/app-routing.js')
  await import('../webui/app-dom.js')
  await import('../webui/app-state.js')
  await import('../webui/app-managed-data.js')
  await import('../webui/app-protected-state.js')
  await import('../webui/app-table-render.js')
  await import('../webui/app-render.js')
  await import('../webui/app-page-cron.js')
  await import('../webui/app-double-task-page.js')
  await import('../webui/app-task-pages.js')
  await import('../webui/app-pages.js')
  await import('../webui/app-cookie-actions.js')
  await import('../webui/app-fans-resource-actions.js')
  await import('../webui/app-yuba-resource-actions.js')
  await import('../webui/app-resource-actions.js')
  await import('../webui/app-actions.js')
  await import('../webui/app-simple-task-actions.js')
  await import('../webui/app-send-task-actions.js')
  await import('../webui/app-task-actions.js')
  await import('../webui/app-events.js')
  await import('../webui/app.js')
}

installLegacyRequestBridge()
createApp(App).mount('#app')
void bootstrapLegacyBehavior()
