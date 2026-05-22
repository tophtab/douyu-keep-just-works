import type { Ref, WatchSource } from 'vue'
import type { Fans } from '../../core/types'
import { ref, watch } from 'vue'
import { rawConfig as sharedRawConfig } from './resource-config'
import {
  fansListError as sharedFansListError,
  fansListLoaded as sharedFansListLoaded,
  fansStatus as sharedFansStatus,
  getManagedConfig,
  getManagedFans,
  managed,
  managedLoading as sharedManagedLoading,
} from './resource-fans'
import { overview as sharedOverview } from './resource-state'
import type { CookieSourceConfig } from './task-shared'

export interface FansBackedTaskPageState<TOverview, TRawConfig extends CookieSourceConfig, TFan extends Fans> {
  fans: Ref<TFan[]>
  fansListError: Ref<string>
  fansListLoaded: Ref<boolean>
  managedConfig: Ref<TRawConfig | null>
  managedLoading: Ref<boolean>
  overview: Ref<TOverview | null>
  rawConfig: Ref<TRawConfig | null>
  syncResourceState: () => void
  watchResourceState: (applyResourceState: () => void, extraSources?: WatchSource[]) => void
}

export function createFansBackedTaskPageState<
  TOverview,
  TRawConfig extends CookieSourceConfig,
  TFan extends Fans = Fans,
>(): FansBackedTaskPageState<TOverview, TRawConfig, TFan> {
  const overview = ref<TOverview | null>(null) as Ref<TOverview | null>
  const rawConfig = ref<TRawConfig | null>(null) as Ref<TRawConfig | null>
  const managedConfig = ref<TRawConfig | null>(null) as Ref<TRawConfig | null>
  const fans = ref<TFan[]>([]) as Ref<TFan[]>
  const fansListError = ref('')
  const fansListLoaded = ref(false)
  const managedLoading = ref(false)

  function syncResourceState(): void {
    rawConfig.value = sharedRawConfig.value as TRawConfig | null
    managedConfig.value = getManagedConfig() as TRawConfig
    overview.value = sharedOverview.value as TOverview | null
    fans.value = getManagedFans() as TFan[]
    fansListError.value = sharedFansListError.value
    fansListLoaded.value = sharedFansListLoaded.value
    managedLoading.value = sharedManagedLoading.value
  }

  function watchResourceState(applyResourceState: () => void, extraSources: WatchSource[] = []): void {
    watch([
      sharedRawConfig,
      managed,
      sharedFansStatus,
      sharedOverview,
      sharedManagedLoading,
      sharedFansListError,
      sharedFansListLoaded,
      ...extraSources,
    ], applyResourceState, { immediate: true })
  }

  return {
    fans,
    fansListError,
    fansListLoaded,
    managedConfig,
    managedLoading,
    overview,
    rawConfig,
    syncResourceState,
    watchResourceState,
  }
}
