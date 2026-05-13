import { createApp } from 'vue'
import App from './App.vue'
import { installLegacyCollectTaskBridge } from './collect'
import { installLegacyCookieActionBridge } from './cookie'
import { installLegacyDoubleTaskBridge } from './double'
import { installLegacyExpiringTaskBridge } from './expiring'
import { installLegacyKeepaliveTaskBridge } from './keepalive'
import { installLegacyRequestBridge } from './request'
import { installLegacyFansResourceBridge, installLegacySystemResourceBridge } from './resources'
import { installLegacyYubaBridge } from './yuba'

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
  await import('../webui/app-task-pages.js')
  await import('../webui/app-pages.js')
  await import('../webui/app-resource-actions.js')
  await import('../webui/app-actions.js')
  await import('../webui/app-simple-task-actions.js')
  await import('../webui/app-send-task-actions.js')
  await import('../webui/app-task-actions.js')
  await import('../webui/app-events.js')
  await import('../webui/app.js')
}

installLegacyRequestBridge()
installLegacyCookieActionBridge()
installLegacyCollectTaskBridge()
installLegacyKeepaliveTaskBridge()
installLegacyDoubleTaskBridge()
installLegacyExpiringTaskBridge()
installLegacyFansResourceBridge()
installLegacyYubaBridge()
createApp(App).mount('#app')
void bootstrapLegacyBehavior()
