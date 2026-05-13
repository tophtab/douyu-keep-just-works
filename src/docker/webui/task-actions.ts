interface SaveOptions {
  revertCheckboxOnError?: boolean
}
type TaskAction = (options?: SaveOptions) => Promise<void>
type DisableAction = () => Promise<void>

interface LegacyCollectTaskActions {
  disableCollectConfig: DisableAction
  saveCollectConfig: TaskAction
}

interface LegacyYubaTaskActions {
  disableYubaConfig: DisableAction
  saveYubaConfig: TaskAction
}

interface LegacyKeepaliveTaskActions {
  disableKeepaliveConfig: DisableAction
  saveKeepaliveConfig: TaskAction
}

interface LegacyDoubleTaskActions {
  disableDoubleConfig: DisableAction
  saveDoubleConfig: TaskAction
}

interface LegacyExpiringTaskActions {
  disableExpiringGiftConfig: DisableAction
  saveExpiringGiftConfig: TaskAction
}

interface LegacySimpleTaskActions extends LegacyCollectTaskActions, LegacyYubaTaskActions {}
interface LegacySendTaskActions extends LegacyKeepaliveTaskActions, LegacyDoubleTaskActions, LegacyExpiringTaskActions {}
interface LegacyTaskActions extends LegacySimpleTaskActions, LegacySendTaskActions {}

declare global {
  interface Window {
    DOUYU_KEEP_WEBUI_SEND_TASK_ACTIONS?: {
      create: (deps: unknown) => LegacySendTaskActions
    }
    DOUYU_KEEP_WEBUI_SIMPLE_TASK_ACTIONS?: {
      create: (deps: unknown) => LegacySimpleTaskActions
    }
    DOUYU_KEEP_WEBUI_TASK_ACTIONS?: {
      create: (deps: unknown) => LegacyTaskActions
    }
  }
}

function requireBridge<T>(bridge: T | undefined, name: string): T {
  if (!bridge) {
    throw new Error(`${name} bridge is not installed`)
  }
  return bridge
}

function createSimpleTaskActions(deps: unknown): LegacySimpleTaskActions {
  const collectActions = requireBridge(window.DOUYU_KEEP_WEBUI_COLLECT_TASK_ACTIONS, 'collect task actions').create(deps as never)
  const yubaActions = requireBridge(window.DOUYU_KEEP_WEBUI_YUBA_TASK_ACTIONS, 'yuba task actions').create(deps as never)

  return {
    saveCollectConfig: collectActions.saveCollectConfig,
    disableCollectConfig: collectActions.disableCollectConfig,
    saveYubaConfig: yubaActions.saveYubaConfig,
    disableYubaConfig: yubaActions.disableYubaConfig,
  }
}

function createSendTaskActions(deps: unknown): LegacySendTaskActions {
  const keepaliveActions = requireBridge(window.DOUYU_KEEP_WEBUI_KEEPALIVE_TASK_ACTIONS, 'keepalive task actions').create(deps as never)
  const doubleActions = requireBridge(window.DOUYU_KEEP_WEBUI_DOUBLE_TASK_ACTIONS, 'double task actions').create(deps as never)
  const expiringActions = requireBridge(window.DOUYU_KEEP_WEBUI_EXPIRING_TASK_ACTIONS, 'expiring task actions').create(deps as never)

  return {
    saveKeepaliveConfig: keepaliveActions.saveKeepaliveConfig,
    disableKeepaliveConfig: keepaliveActions.disableKeepaliveConfig,
    saveDoubleConfig: doubleActions.saveDoubleConfig,
    disableDoubleConfig: doubleActions.disableDoubleConfig,
    saveExpiringGiftConfig: expiringActions.saveExpiringGiftConfig,
    disableExpiringGiftConfig: expiringActions.disableExpiringGiftConfig,
  }
}

function createTaskActions(deps: unknown): LegacyTaskActions {
  const simpleActions = createSimpleTaskActions(deps)
  const sendActions = createSendTaskActions(deps)

  return {
    saveCollectConfig: simpleActions.saveCollectConfig,
    disableCollectConfig: simpleActions.disableCollectConfig,
    saveYubaConfig: simpleActions.saveYubaConfig,
    disableYubaConfig: simpleActions.disableYubaConfig,
    saveKeepaliveConfig: sendActions.saveKeepaliveConfig,
    disableKeepaliveConfig: sendActions.disableKeepaliveConfig,
    saveDoubleConfig: sendActions.saveDoubleConfig,
    disableDoubleConfig: sendActions.disableDoubleConfig,
    saveExpiringGiftConfig: sendActions.saveExpiringGiftConfig,
    disableExpiringGiftConfig: sendActions.disableExpiringGiftConfig,
  }
}

export function installLegacySimpleTaskActionsBridge(): void {
  window.DOUYU_KEEP_WEBUI_SIMPLE_TASK_ACTIONS = {
    create: createSimpleTaskActions,
  }
}

export function installLegacySendTaskActionsBridge(): void {
  window.DOUYU_KEEP_WEBUI_SEND_TASK_ACTIONS = {
    create: createSendTaskActions,
  }
}

export function installLegacyTaskActionsBridge(): void {
  window.DOUYU_KEEP_WEBUI_TASK_ACTIONS = {
    create: createTaskActions,
  }
}
