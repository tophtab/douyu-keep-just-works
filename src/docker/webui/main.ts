import { createApp } from 'vue'
import App from './App.vue'
import { installLegacyActionBridge } from './actions'
import { installLegacyCollectTaskBridge } from './collect'
import { installLegacyCookieActionBridge } from './cookie'
import { installLegacyDoubleTaskBridge } from './double'
import { installLegacyExpiringTaskBridge } from './expiring'
import { installLegacyKeepaliveTaskBridge } from './keepalive'
import { startLegacyApp } from './legacy-app'
import { installLegacyCoreBridge } from './legacy-core'
import { installLegacyRequestBridge } from './request'
import { installLegacyFansResourceBridge, installLegacyResourceActionsBridge, installLegacySystemResourceBridge } from './resources'
import { installLegacyManagedDataBridge, installLegacyProtectedStateBridge, installLegacyStateBridge } from './legacy-state'
import { installLegacyPageBridge } from './pages'
import { installLegacySendTaskActionsBridge, installLegacySimpleTaskActionsBridge, installLegacyTaskActionsBridge } from './task-actions'
import { installLegacyTaskPageBridge } from './task-pages'
import { installLegacyYubaBridge } from './yuba'

import './styles/base.css'
import './styles/shell.css'
import './styles/components.css'
import './styles/tables.css'
import './styles/responsive.css'

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
installLegacySystemResourceBridge()
installLegacyResourceActionsBridge()
installLegacySimpleTaskActionsBridge()
installLegacySendTaskActionsBridge()
installLegacyTaskActionsBridge()
installLegacyTaskPageBridge()
installLegacyPageBridge()
installLegacyActionBridge()
createApp(App).mount('#app')
startLegacyApp()
