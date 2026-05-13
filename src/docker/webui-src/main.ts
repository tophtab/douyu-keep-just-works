import { createApp } from 'vue'
import App from './App.vue'
import { installLegacyCollectTaskBridge } from './collect'
import { installLegacyCookieActionBridge } from './cookie'
import { installLegacyDoubleTaskBridge } from './double'
import { installLegacyExpiringTaskBridge } from './expiring'
import { installLegacyKeepaliveTaskBridge } from './keepalive'
import { installLegacyCoreBridge } from './legacy-core'
import { installLegacyRequestBridge } from './request'
import { installLegacyFansResourceBridge, installLegacyResourceActionsBridge, installLegacySystemResourceBridge } from './resources'
import { installLegacyManagedDataBridge, installLegacyProtectedStateBridge, installLegacyStateBridge } from './legacy-state'
import { installLegacySendTaskActionsBridge, installLegacySimpleTaskActionsBridge, installLegacyTaskActionsBridge } from './task-actions'
import { installLegacyYubaBridge } from './yuba'

import '../webui/styles.css'
import '../webui/styles-components.css'
import '../webui/styles-tables.css'
import '../webui/styles-responsive.css'

async function bootstrapLegacyBehavior(): Promise<void> {
  installLegacySystemResourceBridge()
  await import('../webui/app-task-pages.js')
  await import('../webui/app-pages.js')
  await import('../webui/app-actions.js')
  await import('../webui/app-events.js')
  await import('../webui/app.js')
}

installLegacyCoreBridge()
installLegacyStateBridge()
installLegacyManagedDataBridge()
installLegacyProtectedStateBridge()
installLegacyRequestBridge()
installLegacyCookieActionBridge()
installLegacyCollectTaskBridge()
installLegacyKeepaliveTaskBridge()
installLegacyDoubleTaskBridge()
installLegacyExpiringTaskBridge()
installLegacyFansResourceBridge()
installLegacyYubaBridge()
installLegacyResourceActionsBridge()
installLegacySimpleTaskActionsBridge()
installLegacySendTaskActionsBridge()
installLegacyTaskActionsBridge()
createApp(App).mount('#app')
void bootstrapLegacyBehavior()
